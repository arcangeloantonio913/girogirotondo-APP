"""Sedi router — /api/sedi. Lettura per tutti gli autenticati; scrittura solo SuperAdmin."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from services.database import get_db
from models.sede import SedeCreate, SedeUpdate
from middleware.auth import get_current_user, require_superadmin

router = APIRouter(prefix="/api/sedi", tags=["sedi"])


@router.get("")
async def get_sedi(current_user: dict = Depends(get_current_user)):
    """Restituisce tutte le sedi attive. Accessibile da tutti i ruoli autenticati."""
    db = get_db()
    sedi = await db.sedi.find({"active": True}, {"_id": 0}).to_list(20)
    return sedi


@router.get("/{sede_id}")
async def get_sede(sede_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    sede = await db.sedi.find_one({"id": sede_id}, {"_id": 0})
    if not sede:
        raise HTTPException(status_code=404, detail="Sede non trovata")
    return sede


# ---------------------------------------------------------------------------
# Provisioning multi-tenant — SOLO SuperAdmin
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_sede(payload: SedeCreate, current_user: dict = Depends(require_superadmin)):
    """
    Crea una nuova sede/tenant. Solo SuperAdmin. Lo slug (id) deve essere univoco.
    La sede diventa valida SUBITO: VALID_SEDE_IDS è data-driven da db.sedi (nessun restart).
    """
    db = get_db()
    if await db.sedi.find_one({"id": payload.id}):
        raise HTTPException(status_code=400, detail=f"Sede '{payload.id}' già esistente")
    doc = payload.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.sedi.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{sede_id}")
async def update_sede(sede_id: str, payload: SedeUpdate, current_user: dict = Depends(require_superadmin)):
    """
    Aggiorna name/color/indirizzo/active di una sede. Solo SuperAdmin (non modifica lo slug).
    active=False = soft-delete: la sede esce da VALID_SEDE_IDS.
    """
    db = get_db()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    result = await db.sedi.update_one({"id": sede_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sede non trovata")
    sede = await db.sedi.find_one({"id": sede_id}, {"_id": 0})
    return sede
