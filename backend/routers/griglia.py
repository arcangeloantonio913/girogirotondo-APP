"""Griglia (daily activity grid) router."""
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from services.database import get_db
from models.griglia import GrigliaEntry
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/griglia", tags=["griglia"])


@router.get("")
async def get_griglia(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    student_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date
    if student_id:
        query["student_id"] = student_id
    entries = await db.griglia.find(query, {"_id": 0}).to_list(1000)
    return entries


@router.post("")
async def save_griglia(
    entry: GrigliaEntry,
    current_user: dict = Depends(get_current_user),
):
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
            "colazione": entry.colazione,
            "pranzo": entry.pranzo,
            "frutta": entry.frutta,
            "merenda": entry.merenda,
            "cacca": entry.cacca,
            "pisolino": entry.pisolino,
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
