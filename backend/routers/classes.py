"""Classes router — multi-tenant: filtro per sede_id via header X-Sede-Id."""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from services.database import get_db
from middleware.auth import get_current_user, validate_admin_sede_access, get_teacher_sede_id

router = APIRouter(prefix="/api/classes", tags=["classes"])


class ClassCreate(BaseModel):
    name: str
    teacher_id: Optional[str] = None


@router.get("")
async def get_classes(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    role = current_user.get("role")

    if role == "admin":
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        classes = await db.classes.find({"sede_id": sede_id}, {"_id": 0}).to_list(100)

    elif role == "teacher":
        # Teacher: vede solo le sue classi — sede implicita dal profilo utente
        teacher_class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in teacher_class_ids:
            teacher_class_ids.append(legacy)
        if not teacher_class_ids:
            return []
        classes = await db.classes.find(
            {"id": {"$in": teacher_class_ids}}, {"_id": 0}
        ).to_list(100)

    else:
        # Parent: vede solo le classi dei propri figli
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if not child_ids:
            return []
        students = await db.students.find(
            {"id": {"$in": child_ids}}, {"_id": 0, "class_id": 1}
        ).to_list(100)
        class_ids = list({s["class_id"] for s in students if s.get("class_id")})
        if not class_ids:
            return []
        classes = await db.classes.find(
            {"id": {"$in": class_ids}}, {"_id": 0}
        ).to_list(100)

    return classes


@router.post("", status_code=201)
async def create_class(
    payload: ClassCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono creare classi")

    # Valida sede e ottieni sede_id
    sede_id = validate_admin_sede_access(current_user, x_sede_id)

    db = get_db()
    class_dict = payload.model_dump()
    class_dict["id"] = str(uuid.uuid4())
    class_dict["sede_id"] = sede_id          # assegna alla sede attiva
    await db.classes.insert_one(class_dict)
    class_dict.pop("_id", None)
    return class_dict


@router.delete("/{class_id}")
async def delete_class(
    class_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Permesso negato")

    sede_id = validate_admin_sede_access(current_user, x_sede_id)

    db = get_db()
    # Verifica che la classe appartenga alla sede attiva (prevenzione cross-tenant)
    cls = await db.classes.find_one({"id": class_id})
    if not cls:
        raise HTTPException(status_code=404, detail="Classe non trovata")
    if cls.get("sede_id") != sede_id:
        raise HTTPException(status_code=403, detail="Classe non appartiene alla sede selezionata")

    await db.classes.delete_one({"id": class_id})
    return {"message": "Classe eliminata"}
