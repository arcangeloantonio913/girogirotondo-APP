"""Registro Presenze/Assenze router."""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.presenze import PresenzaDay
from middleware.auth import get_current_user, validate_admin_sede_access

router = APIRouter(prefix="/api/presenze", tags=["presenze"])

_DATE_RE  = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
_YEAR_RE  = re.compile(r"^\d{4}$")


def _teacher_class_ids(u: dict) -> list:
    ids = list(u.get("class_ids") or [])
    if u.get("class_id") and u["class_id"] not in ids:
        ids.append(u["class_id"])
    return ids


# ---------------------------------------------------------------------------
# POST /api/presenze  — salva registro giornaliero (maestra o admin)
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def save_presenze(
    payload: PresenzaDay,
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")
    if role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    # Maestra: può salvare solo per le proprie classi
    if role == "teacher":
        allowed = _teacher_class_ids(current_user)
        if payload.class_id not in allowed:
            raise HTTPException(status_code=403, detail="Classe non autorizzata")

    if not _DATE_RE.match(payload.date):
        raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")

    db = get_db()

    # Salva/aggiorna ogni record come documento separato
    saved = []
    for rec in payload.records:
        existing = await db.presenze.find_one({
            "class_id":  payload.class_id,
            "date":      payload.date,
            "student_id": rec.student_id,
        })
        doc = {
            "id":         str(uuid.uuid4()) if not existing else existing.get("id", str(uuid.uuid4())),
            "class_id":  payload.class_id,
            "date":      payload.date,
            "student_id": rec.student_id,
            "presente":  rec.presente,
            "nota":      rec.nota,
            "saved_by":  current_user["id"],
            "saved_at":  datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            await db.presenze.replace_one({"_id": existing["_id"]}, doc)
        else:
            await db.presenze.insert_one(doc)
        doc.pop("_id", None)
        saved.append(doc)

    return {"saved": len(saved), "date": payload.date, "class_id": payload.class_id}


# ---------------------------------------------------------------------------
# GET /api/presenze  — recupera presenze (giorno / mese / anno)
# ---------------------------------------------------------------------------

@router.get("")
async def get_presenze(
    class_id:  Optional[str] = None,
    date:      Optional[str] = None,   # YYYY-MM-DD  → giorno esatto
    mese:      Optional[str] = None,   # YYYY-MM     → tutto il mese
    anno:      Optional[str] = None,   # YYYY        → tutto l'anno
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = None,
):
    role = current_user.get("role")
    db   = get_db()

    # Costruisce il filtro per le classi autorizzate
    if role == "teacher":
        allowed = _teacher_class_ids(current_user)
        if not allowed:
            return []
        if class_id:
            if class_id not in allowed:
                raise HTTPException(status_code=403, detail="Classe non autorizzata")
            query = {"class_id": class_id}
        else:
            query = {"class_id": {"$in": allowed}}
    elif role == "admin":
        # Admin vede tutte le classi della propria sede
        from fastapi import Header
        query = {}
        if class_id:
            query["class_id"] = class_id
        # nessun filtro di sede sui record (la sede è implicita nell'ID classe)
    else:
        raise HTTPException(status_code=403, detail="Permesso negato")

    # Filtro temporale
    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["date"] = date
    elif mese:
        if not _MONTH_RE.match(mese):
            raise HTTPException(status_code=400, detail="Formato mese non valido (YYYY-MM)")
        query["date"] = {"$regex": f"^{mese}"}
    elif anno:
        if not _YEAR_RE.match(anno):
            raise HTTPException(status_code=400, detail="Formato anno non valido (YYYY)")
        query["date"] = {"$regex": f"^{anno}"}

    records = await db.presenze.find(query, {"_id": 0}).to_list(10000)
    return records


# ---------------------------------------------------------------------------
# GET /api/presenze/classi-summary  — riepilogo admin: tutte le classi oggi
# ---------------------------------------------------------------------------

@router.get("/classi-summary")
async def get_classi_summary(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Admin only: quante presenze/assenze per ogni classe in una data."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")

    today = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not _DATE_RE.match(today):
        raise HTTPException(status_code=400, detail="Formato data non valido")

    db = get_db()
    records = await db.presenze.find({"date": today}, {"_id": 0}).to_list(5000)

    summary: dict = {}
    for r in records:
        cid = r["class_id"]
        if cid not in summary:
            summary[cid] = {"presenti": 0, "assenti": 0, "totale": 0}
        summary[cid]["totale"] += 1
        if r["presente"]:
            summary[cid]["presenti"] += 1
        else:
            summary[cid]["assenti"] += 1

    return {"date": today, "classes": summary}
