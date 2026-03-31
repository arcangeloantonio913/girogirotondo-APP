"""Classes router."""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.database import get_db
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/classes", tags=["classes"])


class ClassCreate(BaseModel):
    name: str
    teacher_id: Optional[str] = None


@router.get("")
async def get_classes(current_user: dict = Depends(get_current_user)):
    db = get_db()
    classes = await db.classes.find({}, {"_id": 0}).to_list(100)
    return classes


@router.post("", status_code=201)
async def create_class(payload: ClassCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono creare classi")
    db = get_db()
    class_dict = payload.model_dump()
    class_dict["id"] = str(uuid.uuid4())
    await db.classes.insert_one(class_dict)
    class_dict.pop("_id", None)
    return class_dict


@router.delete("/{class_id}")
async def delete_class(class_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    result = await db.classes.delete_one({"id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Classe non trovata")
    return {"message": "Classe eliminata"}
