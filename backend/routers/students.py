"""Students router."""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from services.database import get_db
from models.student import StudentCreate
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("")
async def get_students(
    class_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    role = current_user.get("role")

    if role == "parent":
        # I genitori vedono solo il proprio figlio
        child_id = current_user.get("child_id")
        if not child_id:
            return []
        student = await db.students.find_one({"id": child_id}, {"_id": 0})
        return [student] if student else []

    if class_id:
        query["class_id"] = class_id
    elif role == "teacher":
        # Le maestre vedono solo la loro classe
        teacher_class = current_user.get("class_id")
        if teacher_class:
            query["class_id"] = teacher_class

    students = await db.students.find(query, {"_id": 0}).to_list(1000)
    return students


@router.get("/{student_id}")
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Studente non trovato")
    return student


@router.post("", status_code=201)
async def create_student(payload: StudentCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    student_dict = payload.model_dump()
    student_dict["id"] = str(uuid.uuid4())
    student_dict["child_code"] = f"GGT-{str(uuid.uuid4())[:4].upper()}"
    await db.students.insert_one(student_dict)
    student_dict.pop("_id", None)
    return student_dict
