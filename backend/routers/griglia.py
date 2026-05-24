"""Griglia (daily activity grid) router."""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from utils.expo_push import notify_parents_of_class
from models.griglia import GrigliaEntry
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/griglia", tags=["griglia"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _parent_child_ids(current_user: dict) -> list:
    ids = list(current_user.get("child_ids") or [])
    legacy = current_user.get("child_id")
    if legacy and legacy not in ids:
        ids.append(legacy)
    return ids


@router.get("")
async def get_griglia(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    student_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    role = current_user.get("role")

    if role == "parent":
        allowed = _parent_child_ids(current_user)
        if not allowed:
            return []
        if student_id:
            if student_id not in allowed:
                raise HTTPException(status_code=403, detail="Accesso negato")
            query["student_id"] = student_id
        else:
            query["student_id"] = {"$in": allowed}
    else:
        if class_id:
            query["class_id"] = class_id
        if student_id:
            query["student_id"] = student_id

    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["date"] = date

    entries = await db.griglia.find(query, {"_id": 0}).to_list(1000)
    return entries


@router.post("")
async def save_griglia(
    entry: GrigliaEntry,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    entries_created = []

    # Deriva boolean da qty se qty è impostato
    # "no" = esplicitamente non mangiato → boolean False
    def _active(flag: bool, qty: str) -> bool:
        if qty == "no": return False
        return bool(qty) or flag

    for sid in entry.student_ids:
        existing = await db.griglia.find_one(
            {"student_id": sid, "date": entry.date, "class_id": entry.class_id}
        )
        doc = {
            "id": str(uuid.uuid4()) if not existing else existing.get("id", str(uuid.uuid4())),
            "class_id":    entry.class_id,
            "student_id":  sid,
            "date":        entry.date,
            # boolean (true se qty impostata e non "no", o flag esplicito)
            "merenda":  _active(entry.merenda, entry.merenda_qty or ""),
            "pasta":    _active(entry.pasta,   entry.pasta_qty   or ""),
            "secondo":  _active(entry.secondo, entry.secondo_qty or ""),
            "pane":     _active(entry.pane,    entry.pane_qty    or ""),
            "frutta":   _active(entry.frutta,  entry.frutta_qty  or ""),
            # quantità (tutto | bis | poca | metà | no | "")
            "merenda_qty": entry.merenda_qty or "",
            "pasta_qty":   entry.pasta_qty   or "",
            "secondo_qty": entry.secondo_qty or "",
            "pane_qty":    entry.pane_qty    or "",
            "frutta_qty":  entry.frutta_qty  or "",
            # igiene e riposo
            "pupu":  entry.pupu,
            "nanna": entry.nanna,
            "notes": entry.notes,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            await db.griglia.replace_one({"_id": existing["_id"]}, doc)
        else:
            await db.griglia.insert_one(doc)
            try:
                cid = doc.get("class_id")
                if cid:
                    await notify_parents_of_class(db, cid, "🍝 Griglia pasti aggiornata",
                        "La maestra ha registrato i pasti di oggi")
            except Exception:
                pass
        doc.pop("_id", None)
        entries_created.append(doc)
    return entries_created
