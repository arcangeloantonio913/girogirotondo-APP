"""Meals / menu router — /api/meals and /api/meals/menu."""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.meals import MealCreate
from middleware.auth import get_current_user

router = APIRouter(tags=["meals"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


async def _get_meals(class_id: Optional[str], date: Optional[str]):
    db = get_db()
    query: dict = {}
    if class_id:
        query["class_id"] = class_id
    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["date"] = date
    return await db.meals.find(query, {"_id": 0}).to_list(100)


async def _create_meal(payload: MealCreate, uploader_id: str):
    db = get_db()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.meals.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/api/meals")
@router.get("/api/meals/menu")
async def get_meals(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    return await _get_meals(class_id, date)


@router.post("/api/meals/menu", status_code=201)
async def create_meal(
    payload: MealCreate,
    current_user: dict = Depends(get_current_user),
):
    # Solo admin e maestre possono creare menu
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato: solo admin o maestra può creare menu")
    return await _create_meal(payload, current_user.get("id", ""))
