"""Avvisi e Comunicazioni router — /api/avvisi."""
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.avvisi import AvvisoCreate, AvvisoUpdate
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/avvisi", tags=["avvisi"])


def _parent_class_ids_sync(current_user: dict) -> list:
    """Placeholder sincrono — le classi del genitore vengono calcolate dalla query."""
    # Il genitore non ha class_ids direttamente: vengono derivati dai figli nel GET
    return []


# ---------------------------------------------------------------------------
# GET /api/avvisi  — lettura avvisi (tutti i ruoli autenticati)
# ---------------------------------------------------------------------------

@router.get("")
async def get_avvisi(
    class_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    role = current_user.get("role")
    query: dict = {}

    if role == "admin":
        # Admin vede tutto
        if class_id:
            query["$or"] = [{"target": "global"}, {"class_id": class_id}]

    elif role == "teacher":
        # Maestra vede: avvisi globali + avvisi delle sue classi
        class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in class_ids:
            class_ids.append(legacy)
        if class_ids:
            query["$or"] = [{"target": "global"}, {"class_id": {"$in": class_ids}}]
        else:
            query["target"] = "global"

    elif role == "parent":
        # Genitore vede: avvisi globali + avvisi della classe dei propri figli
        child_ids = list(current_user.get("child_ids") or [])
        legacy_child = current_user.get("child_id")
        if legacy_child and legacy_child not in child_ids:
            child_ids.append(legacy_child)
        if child_ids:
            students = await db.students.find(
                {"id": {"$in": child_ids}}, {"_id": 0, "class_id": 1}
            ).to_list(100)
            parent_class_ids = list({s["class_id"] for s in students if s.get("class_id")})
            if parent_class_ids:
                query["$or"] = [
                    {"target": "global"},
                    {"class_id": {"$in": parent_class_ids}},
                ]
            else:
                query["target"] = "global"
        else:
            query["target"] = "global"

    avvisi = await db.avvisi.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return avvisi


# ---------------------------------------------------------------------------
# POST /api/avvisi  — crea avviso (admin o maestra)
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_avviso(
    payload: AvvisoCreate,
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")
    if role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Solo admin o maestra possono creare avvisi")

    # Maestra può creare solo avvisi per le sue classi
    if role == "teacher":
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
    doc["author_id"] = current_user.get("id", "")
    doc["author_name"] = current_user.get("name", "")
    doc["author_role"] = role
    doc["created_at"] = datetime.now(timezone.utc).isoformat()

    await db.avvisi.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# DELETE /api/avvisi/{avviso_id}  — elimina (admin o autore)
# ---------------------------------------------------------------------------

@router.delete("/{avviso_id}")
async def delete_avviso(avviso_id: str, current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    db = get_db()
    avviso = await db.avvisi.find_one({"id": avviso_id}, {"_id": 0})
    if not avviso:
        raise HTTPException(status_code=404, detail="Avviso non trovato")

    # Solo admin o l'autore possono eliminare
    if role != "admin" and avviso.get("author_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    await db.avvisi.delete_one({"id": avviso_id})
    return {"message": "Avviso eliminato"}
