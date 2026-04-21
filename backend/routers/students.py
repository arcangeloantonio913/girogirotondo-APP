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
        # I genitori vedono solo i propri figli (supporta child_ids e legacy child_id)
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if not child_ids:
            return []
        students = await db.students.find({"id": {"$in": child_ids}}, {"_id": 0}).to_list(100)
        return students

    if class_id:
        query["class_id"] = class_id
    elif role == "teacher":
        # Le maestre vedono le loro classi (supporta class_ids e legacy class_id)
        teacher_class_ids = list(current_user.get("class_ids") or [])
        legacy_class = current_user.get("class_id")
        if legacy_class and legacy_class not in teacher_class_ids:
            teacher_class_ids.append(legacy_class)
        if teacher_class_ids:
            query["class_id"] = {"$in": teacher_class_ids}

    students = await db.students.find(query, {"_id": 0}).to_list(1000)
    return students


@router.get("/{student_id}")
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    role = current_user.get("role")

    # Parent isolation: verifica che il figlio richiesto appartenga al genitore
    if role == "parent":
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if student_id not in child_ids:
            raise HTTPException(status_code=403, detail="Accesso negato: questo bambino non è associato al tuo account")

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
