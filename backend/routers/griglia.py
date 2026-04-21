"""Griglia (daily activity grid) router."""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.griglia import GrigliaEntry
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/griglia", tags=["griglia"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _parent_child_ids(current_user: dict) -> list:
    """Restituisce la lista di child_ids autorizzati per un genitore.
    Supporta sia il campo child_ids (nuovo) sia child_id (legacy).
    """
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

    # ── Parent isolation: il genitore vede solo i propri figli ───────────────
    if role == "parent":
        allowed = _parent_child_ids(current_user)
        if not allowed:
            return []
        if student_id:
            if student_id not in allowed:
                raise HTTPException(status_code=403, detail="Accesso negato: questo bambino non è associato al tuo account")
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
    # Solo admin e maestre possono aggiornare la griglia giornaliera
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato: solo admin o maestra può aggiornare la griglia")
    db = get_db()
    entries_created = []
    for sid in entry.student_ids:
        existing = await db.griglia.find_one(
            {"student_id": sid, "date": entry.date, "class_id": entry.class_id}
        )
        doc = {
            "id": str(uuid.uuid4()),
            "class_id": entry.class_id,
            "student_id": sid,
            "date": entry.date,
            "pasta": entry.pasta,
            "secondo": entry.secondo,
            "pane": entry.pane,
            "frutta": entry.frutta,
            "pupu": entry.pupu,
            "notes": entry.notes,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            await db.griglia.replace_one({"_id": existing["_id"]}, doc)
        else:
            await db.griglia.insert_one(doc)
        doc.pop("_id", None)
        entries_created.append(doc)
    return entries_created
