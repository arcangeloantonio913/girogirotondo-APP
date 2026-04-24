"""Students router — multi-tenant: isolamento per sede_id."""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header

from services.database import get_db
from models.student import StudentCreate
from middleware.auth import get_current_user, validate_admin_sede_access, get_teacher_sede_id

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("")
async def get_students(
    class_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    query = {}
    role = current_user.get("role")

    if role == "parent":
        # Genitori: solo i propri figli (isolamento totale, sede implicita)
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if not child_ids:
            return []
        return await db.students.find({"id": {"$in": child_ids}}, {"_id": 0}).to_list(100)

    elif role == "teacher":
        # Maestre: solo i bambini delle proprie classi
        # SICUREZZA: sede_id viene dal profilo della maestra, NON dall'header
        teacher_class_ids = list(current_user.get("class_ids") or [])
        legacy_class = current_user.get("class_id")
        if legacy_class and legacy_class not in teacher_class_ids:
            teacher_class_ids.append(legacy_class)

        if class_id:
            # Verifica che la classe richiesta appartenga alla maestra
            if class_id not in teacher_class_ids:
                raise HTTPException(status_code=403, detail="Accesso negato: classe non assegnata")
            query["class_id"] = class_id
        elif teacher_class_ids:
            query["class_id"] = {"$in": teacher_class_ids}

        return await db.students.find(query, {"_id": 0}).to_list(1000)

    else:
        # Admin: filtra per sede dalla header X-Sede-Id
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        query["sede_id"] = sede_id
        if class_id:
            # Verifica che la classe appartenga alla sede
            cls = await db.classes.find_one({"id": class_id, "sede_id": sede_id})
            if not cls:
                raise HTTPException(status_code=403, detail="Classe non appartiene alla sede selezionata")
            query["class_id"] = class_id

        return await db.students.find(query, {"_id": 0}).to_list(1000)


@router.get("/{student_id}")
async def get_student(
    student_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    role = current_user.get("role")

    if role == "parent":
        # Parent isolation: verifica che il figlio appartenga al genitore
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if student_id not in child_ids:
            raise HTTPException(status_code=403, detail="Accesso negato: questo bambino non è associato al tuo account")

    elif role == "teacher":
        # Teacher: verifica che lo studente appartenga alle classi della maestra
        teacher_class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in teacher_class_ids:
            teacher_class_ids.append(legacy)
        student = await db.students.find_one({"id": student_id}, {"_id": 0})
        if not student or student.get("class_id") not in teacher_class_ids:
            raise HTTPException(status_code=403, detail="Accesso negato")

    else:
        # Admin: verifica sede
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        student = await db.students.find_one({"id": student_id, "sede_id": sede_id}, {"_id": 0})
        if not student:
            raise HTTPException(status_code=404, detail="Studente non trovato o non appartiene alla sede selezionata")
        return student

    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Studente non trovato")
    return student


@router.post("", status_code=201)
async def create_student(
    payload: StudentCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()

    # Determina sede_id
    if current_user.get("role") == "admin":
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
    else:
        sede_id = get_teacher_sede_id(current_user)

    student_dict = payload.model_dump()
    student_dict["id"] = str(uuid.uuid4())
    student_dict["sede_id"] = sede_id
    student_dict["child_code"] = f"GGT-{str(uuid.uuid4())[:4].upper()}"
    await db.students.insert_one(student_dict)
    student_dict.pop("_id", None)
    return student_dict
