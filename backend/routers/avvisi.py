"""Avvisi e Comunicazioni router — /api/avvisi — multi-tenant."""
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header

from services.database import get_db
from models.avvisi import AvvisoCreate, AvvisoUpdate
from middleware.auth import get_current_user, validate_admin_sede_access, get_teacher_sede_id

router = APIRouter(prefix="/api/avvisi", tags=["avvisi"])


@router.get("")
async def get_avvisi(
    class_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    role = current_user.get("role")
    query: dict = {}

    if role == "admin":
        # Admin: vede solo avvisi della sede attiva
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        query["sede_id"] = sede_id
        if class_id:
            query["$or"] = [{"target": "global"}, {"class_id": class_id}]

    elif role == "teacher":
        # Maestra: vede avvisi della sua sede (profilo) + avvisi della sua classe
        # SICUREZZA: sede deriva dal profilo, NON da alcun parametro esterno
        sede_id = get_teacher_sede_id(current_user)
        class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in class_ids:
            class_ids.append(legacy)

        query["sede_id"] = sede_id
        if class_ids:
            query["$or"] = [{"target": "global"}, {"class_id": {"$in": class_ids}}]
        else:
            query["target"] = "global"

    elif role == "parent":
        # Genitore: vede avvisi della sua sede + avvisi delle classi dei figli
        # Sede implicita dai figli
        child_ids = list(current_user.get("child_ids") or [])
        legacy_child = current_user.get("child_id")
        if legacy_child and legacy_child not in child_ids:
            child_ids.append(legacy_child)

        if child_ids:
            students = await db.students.find(
                {"id": {"$in": child_ids}}, {"_id": 0, "class_id": 1, "sede_id": 1}
            ).to_list(100)
            parent_class_ids = list({s["class_id"] for s in students if s.get("class_id")})
            # Usa la sede del primo figlio trovato
            sede_id = next((s.get("sede_id") for s in students if s.get("sede_id")), None)
            query["sede_id"] = sede_id
            if parent_class_ids:
                query["$or"] = [
                    {"target": "global"},
                    {"class_id": {"$in": parent_class_ids}},
                ]
            else:
                query["target"] = "global"
        else:
            # Nessun figlio associato — restituisci lista vuota
            return []

    avvisi = await db.avvisi.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return avvisi


@router.post("", status_code=201)
async def create_avviso(
    payload: AvvisoCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    role = current_user.get("role")
    if role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Solo admin o maestra possono creare avvisi")

    # Determina sede
    if role == "admin":
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
    else:
        # Maestra: sede fissa dal profilo
        sede_id = get_teacher_sede_id(current_user)
        if payload.target == "global":
            raise HTTPException(status_code=403, detail="La maestra può pubblicare avvisi solo per la propria classe, non globali")
        class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in class_ids:
            class_ids.append(legacy)
        if payload.class_id and payload.class_id not in class_ids:
            raise HTTPException(status_code=403, detail="Non puoi pubblicare avvisi per classi non assegnate a te")

    db = get_db()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["sede_id"] = sede_id
    doc["author_id"] = current_user.get("id", "")
    doc["author_name"] = current_user.get("name", "")
    doc["author_role"] = role
    doc["created_at"] = datetime.now(timezone.utc).isoformat()

    await db.avvisi.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/{avviso_id}")
async def delete_avviso(
    avviso_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    role = current_user.get("role")
    db = get_db()
    avviso = await db.avvisi.find_one({"id": avviso_id}, {"_id": 0})
    if not avviso:
        raise HTTPException(status_code=404, detail="Avviso non trovato")

    # Verifica appartenenza alla sede corretta (prevenzione cross-tenant)
    if role == "admin":
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        if avviso.get("sede_id") != sede_id:
            raise HTTPException(status_code=403, detail="Avviso non appartiene alla sede selezionata")
    elif role != "admin" and avviso.get("author_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    await db.avvisi.delete_one({"id": avviso_id})
    return {"message": "Avviso eliminato"}
