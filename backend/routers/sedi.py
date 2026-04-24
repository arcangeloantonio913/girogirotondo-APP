"""Sedi router — /api/sedi (lettura sedi, admin-only per scrittura)."""
from fastapi import APIRouter, HTTPException, Depends
from services.database import get_db
from middleware.auth import get_current_user

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
