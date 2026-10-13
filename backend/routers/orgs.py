"""Orgs router — /api/orgs. Provisioning delle organizzazioni (= scuole, nel modello FISM).

Lettura/scrittura SOLO SuperAdmin. Serve a creare il livello "org" via API (prima nasceva
solo dal seed): nel modello FISM ogni scuola è una org isolata, e una org va creata PRIMA
della sua sede (create_sede richiede un org_id esistente).
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from services.database import get_db
from models.org import OrgCreate, OrgUpdate
from middleware.auth import require_superadmin

router = APIRouter(prefix="/api/orgs", tags=["orgs"])


@router.get("")
async def list_orgs(current_user: dict = Depends(require_superadmin)):
    """Elenco organizzazioni. Un superadmin GLOBALE (senza org_id) le vede tutte; un
    superadmin legato a una org vede solo la propria (isolamento cross-org)."""
    db = get_db()
    caller_org = current_user.get("org_id")
    q = {} if not caller_org else {"id": caller_org}
    return await db.orgs.find(q, {"_id": 0}).sort("created_at", 1).to_list(1000)


@router.post("", status_code=201)
async def create_org(payload: OrgCreate, current_user: dict = Depends(require_superadmin)):
    """Crea una nuova org/scuola. Solo SuperAdmin GLOBALE (senza org_id): un superadmin già
    legato a una org non può crearne altre (eviterebbe l'isolamento). Slug univoco."""
    if current_user.get("org_id"):
        raise HTTPException(
            status_code=403,
            detail="Solo un SuperAdmin globale può creare nuove organizzazioni",
        )
    db = get_db()
    if await db.orgs.find_one({"id": payload.id}):
        raise HTTPException(status_code=400, detail=f"Org '{payload.id}' già esistente")
    doc = payload.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.orgs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{org_id}")
async def update_org(org_id: str, payload: OrgUpdate, current_user: dict = Depends(require_superadmin)):
    """Aggiorna name/active di una org (non modifica lo slug)."""
    caller_org = current_user.get("org_id")
    if caller_org and caller_org != org_id:
        raise HTTPException(status_code=404, detail="Org non trovata")
    db = get_db()
    existing = await db.orgs.find_one({"id": org_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Org non trovata")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    await db.orgs.update_one({"id": org_id}, {"$set": updates})
    return await db.orgs.find_one({"id": org_id}, {"_id": 0})
