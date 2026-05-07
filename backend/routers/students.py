"""Students router — multi-tenant: isolamento per sede_id. CRUD completo."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header

from services.database import get_db
from models.student import StudentCreate, StudentUpdate
from middleware.auth import get_current_user, validate_admin_sede_access, get_teacher_sede_id

router = APIRouter(prefix="/api/students", tags=["students"])


def _teacher_class_ids(current_user: dict) -> list:
    ids = list(current_user.get("class_ids") or [])
    legacy = current_user.get("class_id")
    if legacy and legacy not in ids:
        ids.append(legacy)
    return ids


# ---------------------------------------------------------------------------
# GET /api/students
# ---------------------------------------------------------------------------

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
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if not child_ids:
            return []
        return await db.students.find({"id": {"$in": child_ids}}, {"_id": 0}).to_list(100)

    elif role == "teacher":
        teacher_class_ids = _teacher_class_ids(current_user)
        # BUG FIX CRITICO: classe non assegnata → restituisce [] invece di TUTTI gli studenti
        if not teacher_class_ids:
            return []
        if class_id:
            if class_id not in teacher_class_ids:
                raise HTTPException(status_code=403, detail="Accesso negato: classe non assegnata")
            query["class_id"] = class_id
        else:
            query["class_id"] = {"$in": teacher_class_ids}
        return await db.students.find(query, {"_id": 0}).to_list(1000)

    else:
        # Admin: filtra per classi della sede attiva (non solo per sede_id sul bambino,
        # per garantire coerenza con teacher che filtra per class_id)
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        if class_id:
            cls = await db.classes.find_one({"id": class_id, "sede_id": sede_id})
            if not cls:
                raise HTTPException(status_code=403, detail="Classe non appartiene alla sede selezionata")
            query["class_id"] = class_id
        else:
            # Ottieni tutti gli ID delle classi di questa sede
            sede_classes = await db.classes.find(
                {"sede_id": sede_id}, {"_id": 0, "id": 1}
            ).to_list(200)
            sede_class_ids = [c["id"] for c in sede_classes]
            if not sede_class_ids:
                return []
            # Mostra studenti nelle classi della sede (indipendentemente dal campo sede_id
            # dello studente, che potrebbe mancare su record vecchi)
            query["class_id"] = {"$in": sede_class_ids}
        return await db.students.find(query, {"_id": 0}).to_list(1000)


# ---------------------------------------------------------------------------
# GET /api/students/{student_id}
# ---------------------------------------------------------------------------

@router.get("/{student_id}")
async def get_student(
    student_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    role = current_user.get("role")

    if role == "parent":
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if student_id not in child_ids:
            raise HTTPException(status_code=403, detail="Accesso negato")

    elif role == "teacher":
        teacher_class_ids = _teacher_class_ids(current_user)
        student = await db.students.find_one({"id": student_id}, {"_id": 0})
        if not student or student.get("class_id") not in teacher_class_ids:
            raise HTTPException(status_code=403, detail="Accesso negato")
        return student

    else:
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        student = await db.students.find_one({"id": student_id, "sede_id": sede_id}, {"_id": 0})
        if not student:
            raise HTTPException(status_code=404, detail="Studente non trovato")
        return student

    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Studente non trovato")
    return student


# ---------------------------------------------------------------------------
# POST /api/students
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_student(
    payload: StudentCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()

    if current_user.get("role") == "admin":
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
    else:
        sede_id = get_teacher_sede_id(current_user)

    student_dict = payload.model_dump()
    student_dict["id"] = str(uuid.uuid4())
    student_dict["sede_id"] = sede_id
    student_dict["child_code"] = f"GGT-{str(uuid.uuid4())[:4].upper()}"
    student_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.students.insert_one(student_dict)
    student_dict.pop("_id", None)
    return student_dict


# ---------------------------------------------------------------------------
# PUT /api/students/{student_id} — modifica dati studente
# ---------------------------------------------------------------------------

@router.put("/{student_id}")
async def update_student(
    student_id: str,
    payload: StudentUpdate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """
    Admin e maestre possono modificare nome, cognome, data nascita, allergie, note.
    Admin può anche cambiare classe (sede_id viene aggiornato di conseguenza).
    """
    db = get_db()
    role = current_user.get("role")

    if role == "parent":
        raise HTTPException(status_code=403, detail="Permesso negato")

    # Recupera lo studente e verifica accesso
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Studente non trovato")

    if role == "teacher":
        teacher_class_ids = _teacher_class_ids(current_user)
        if student.get("class_id") not in teacher_class_ids:
            raise HTTPException(status_code=403, detail="Accesso negato: studente non nella tua classe")
        # Maestra può modificare solo campi anagrafici, non la classe
        allowed_fields = {"name", "cognome", "date_of_birth", "allergies", "notes"}
    else:
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        if student.get("sede_id") != sede_id:
            raise HTTPException(status_code=403, detail="Studente non appartiene alla sede selezionata")
        allowed_fields = {"name", "cognome", "date_of_birth", "allergies", "notes", "class_id", "parent_id"}

    updates = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        if field in allowed_fields:
            updates[field] = value

    # Se viene cambiata la classe, aggiorna anche sede_id in base alla nuova classe
    if "class_id" in updates and role == "admin":
        new_cls = await db.classes.find_one({"id": updates["class_id"]})
        if not new_cls:
            raise HTTPException(status_code=400, detail="Classe non trovata")
        updates["sede_id"] = new_cls.get("sede_id", student.get("sede_id"))

    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.students.update_one({"id": student_id}, {"$set": updates})
    updated = await db.students.find_one({"id": student_id}, {"_id": 0})
    return updated


# ---------------------------------------------------------------------------
# DELETE /api/students/{student_id} — elimina studente (solo admin)
# ---------------------------------------------------------------------------

@router.delete("/{student_id}")
async def delete_student(
    student_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eliminare studenti")

    sede_id = validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Studente non trovato")
    if student.get("sede_id") != sede_id:
        raise HTTPException(status_code=403, detail="Studente non appartiene alla sede selezionata")

    await db.students.delete_one({"id": student_id})

    # Rimuovi riferimento dal genitore
    if student.get("parent_id"):
        await db.users.update_one(
            {"id": student["parent_id"]},
            {"$pull": {"child_ids": student_id}, "$unset": {"child_id": ""}}
        )

    # Pulizia dati correlati
    await db.griglia.delete_many({"student_id": student_id})
    await db.gallery.update_many(
        {"student_ids": student_id},
        {"$pull": {"student_ids": student_id}}
    )

    return {"message": "Studente eliminato"}


# ---------------------------------------------------------------------------
# PATCH /api/students/{student_id}/remove-from-class — rimuovi dalla classe
# ---------------------------------------------------------------------------

@router.patch("/{student_id}/remove-from-class")
async def remove_student_from_class(
    student_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Rimuove il bambino dalla classe (class_id = None) senza eliminarlo."""
    db = get_db()
    role = current_user.get("role")

    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Studente non trovato")

    if role == "admin":
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        if student.get("sede_id") != sede_id:
            raise HTTPException(status_code=403, detail="Accesso negato")
    elif role == "teacher":
        teacher_class_ids = _teacher_class_ids(current_user)
        if student.get("class_id") not in teacher_class_ids:
            raise HTTPException(status_code=403, detail="Accesso negato")
    else:
        raise HTTPException(status_code=403, detail="Permesso negato")

    await db.students.update_one(
        {"id": student_id},
        {"$set": {"class_id": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    updated = await db.students.find_one({"id": student_id}, {"_id": 0})
    return updated
