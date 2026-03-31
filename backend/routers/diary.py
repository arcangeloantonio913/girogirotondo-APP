"""Diary router — /api/diary and /api/diary/entries (alias)."""
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from services.database import get_db
from models.diary import DiaryEntryCreate
from middleware.auth import get_current_user

router = APIRouter(tags=["diary"])


async def _get_diary(class_id: Optional[str], date: Optional[str]):
    db = get_db()
    query: dict = {}
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date
    return await db.diary.find(query, {"_id": 0}).to_list(100)


async def _create_diary(entry: DiaryEntryCreate):
    db = get_db()
    doc = entry.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.diary.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/api/diary")
@router.get("/api/diary/entries")
async def get_diary(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    return await _get_diary(class_id, date)


@router.post("/api/diary", status_code=201)
@router.post("/api/diary/entries", status_code=201)
async def create_diary(
    entry: DiaryEntryCreate,
    current_user: dict = Depends(get_current_user),
):
    return await _create_diary(entry)
