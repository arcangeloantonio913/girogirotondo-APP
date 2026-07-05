"""Sedi router — /api/sedi. Lettura per tutti gli autenticati; scrittura solo SuperAdmin."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from services.database import get_db
from models.sede import SedeCreate, SedeUpdate
from middleware.auth import get_current_user, require_superadmin

router = APIRouter(prefix="/api/sedi", tags=["sedi"])


@router.get("")
async def get_sedi(current_user: dict = Depends(get_current_user)):
    """Sedi attive della PROPRIA org (sorgente dello switcher). Se il caller non ha ancora
    org_id (pre-backfill) → tutte le attive (fallback = comportamento odierno)."""
    db = get_db()
    caller_org = current_user.get("org_id")
    q = {"active": True}
    if caller_org:
        q["org_id"] = caller_org
    sedi = await db.sedi.find(q, {"_id": 0}).to_list(20)
    return sedi


@router.get("/{sede_id}")
async def get_sede(sede_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    sede = await db.sedi.find_one({"id": sede_id}, {"_id": 0})
    if not sede:
        raise HTTPException(status_code=404, detail="Sede non trovata")
    # Cross-org → 404 (non riveliamo l'esistenza di una sede di un'altra org).
    caller_org = current_user.get("org_id")
    if caller_org and sede.get("org_id") and sede["org_id"] != caller_org:
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
    # org_id AUTORITATIVO server-side: un superadmin crea sedi SOLO nella propria org (mai
    # dal body). Fallback pre-backfill: usa il body. Obbligatorio sul documento → 400 se assente.
    doc["org_id"] = current_user.get("org_id") or doc.get("org_id")
    if not doc.get("org_id"):
        raise HTTPException(status_code=400, detail="org_id obbligatorio per la sede")
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
    existing = await db.sedi.find_one({"id": sede_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Sede non trovata")
    # Cross-org → 404 (un superadmin non modifica sedi di un'altra org).
    caller_org = current_user.get("org_id")
    if caller_org and existing.get("org_id") and existing["org_id"] != caller_org:
        raise HTTPException(status_code=404, detail="Sede non trovata")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    await db.sedi.update_one({"id": sede_id}, {"$set": updates})
    sede = await db.sedi.find_one({"id": sede_id}, {"_id": 0})
    return sede
