"""Diary router — /api/diary and /api/diary/entries (alias)."""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.diary import DiaryEntryCreate
from middleware.auth import get_current_user

router = APIRouter(tags=["diary"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


async def _get_diary(class_id: Optional[str], date: Optional[str], current_user: dict,
                     student_id: Optional[str] = None):
    db = get_db()
    query: dict = {}
    role = current_user.get("role")

    # ── Parent isolation: il genitore vede solo il diario della classe del figlio ─
    if role == "parent":
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if not child_ids:
            return []

        # Se passato student_id, usa SOLO la classe di quel figlio (figlio attivo)
        if student_id:
            if student_id not in child_ids:
                raise HTTPException(status_code=403, detail="Accesso negato")
            lookup_ids = [student_id]
        else:
            lookup_ids = child_ids

        students = await db.students.find(
            {"id": {"$in": lookup_ids}}, {"_id": 0, "class_id": 1}
        ).to_list(100)
        allowed_classes = list({s["class_id"] for s in students if s.get("class_id")})
        if not allowed_classes:
            return []
        if class_id:
            if class_id not in allowed_classes:
                raise HTTPException(status_code=403, detail="Accesso negato")
            query["class_id"] = class_id
        else:
            query["class_id"] = {"$in": allowed_classes}
    else:
        if class_id:
            query["class_id"] = class_id

    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["date"] = date
    return await db.diary.find(query, {"_id": 0}).to_list(100)


async def _create_diary(entry: DiaryEntryCreate, user_id: str):
    db = get_db()
    doc = entry.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_by"] = user_id
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.diary.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/api/diary")
@router.get("/api/diary/entries")
async def get_diary(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    student_id: Optional[str] = None,   # filtro per figlio attivo (fratellini)
    current_user: dict = Depends(get_current_user),
):
    return await _get_diary(class_id, date, current_user, student_id)


@router.post("/api/diary", status_code=201)
@router.post("/api/diary/entries", status_code=201)
async def create_diary(
    entry: DiaryEntryCreate,
    current_user: dict = Depends(get_current_user),
):
    # Solo admin e maestre possono scrivere nel diario
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato: solo admin o maestra può scrivere nel diario")
    return await _create_diary(entry, current_user.get("id", ""))
