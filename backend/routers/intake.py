"""Raccolta Iscrizioni — /api/intake.

- Token per scuola: creato/gestito solo da admin, legato all'org del creatore.
  Nel DB si salva SOLO l'hash SHA-256 del token; il valore in chiaro è mostrato una volta.
- Endpoint pubblici (config/submission/scan): autenticati SOLO dal token (query ?t=).
- Endpoint admin (lista/dettaglio/patch/export): get_current_user + isolamento per org_id.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from services.database import get_db
from middleware.auth import get_current_user
from models.intake import (
    IntakeTokenCreate, IntakeSubmissionUpsert, IntakeSubmissionPatch,
)

router = APIRouter(prefix="/api/intake", tags=["intake"])


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eseguire questa operazione")


def _caller_org(current_user: dict) -> str:
    org = current_user.get("org_id")
    if not org:
        raise HTTPException(status_code=400, detail="Account senza org_id: impossibile gestire iscrizioni")
    return org


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Dependency: autenticazione via token pubblico (?t=) ──────────────────────
async def get_intake_token(t: Optional[str] = None) -> dict:
    if not t:
        raise HTTPException(status_code=401, detail="Token mancante")
    db = get_db()
    doc = await db.intake_tokens.find_one(
        {"token_hash": _hash_token(t), "active": True}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=401, detail="Link non valido o revocato")
    exp = doc.get("expires_at")
    if exp and exp < _now_iso():
        raise HTTPException(status_code=401, detail="Link scaduto")
    return doc


# ── Token admin CRUD ─────────────────────────────────────────────────────────
@router.post("/tokens", status_code=201)
async def create_token(payload: IntakeTokenCreate, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    raw = secrets.token_urlsafe(24)
    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org,
        "label": payload.label,
        "token_hash": _hash_token(raw),
        "expires_at": payload.expires_at,
        "active": True,
        "created_by": current_user.get("id"),
        "created_at": _now_iso(),
    }
    await db.intake_tokens.insert_one(doc)
    # token in chiaro restituito UNA sola volta
    return {"id": doc["id"], "org_id": org, "label": doc["label"], "token": raw}


@router.get("/tokens")
async def list_tokens(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    rows = await db.intake_tokens.find(
        {"org_id": org}, {"_id": 0, "token_hash": 0}
    ).to_list(200)
    return rows


@router.delete("/tokens/{token_id}")
async def revoke_token(token_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    res = await db.intake_tokens.update_one(
        {"id": token_id, "org_id": org}, {"$set": {"active": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Token non trovato")
    return {"ok": True, "id": token_id}
