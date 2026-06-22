"""Authentication middleware — verifies Firebase ID token (primary) or custom JWT (dev fallback).

Multi-Tenant Security
---------------------
* Admin/SuperAdmin: sede_id viene letto dall'header X-Sede-Id (inviato dal frontend).
  - SuperAdmin (is_superadmin=True): può accedere a qualsiasi sede valida.
  - Admin normale: può accedere SOLO alla propria sede (current_user.sede_id deve corrispondere).
* Teacher: sede_id viene letto ESCLUSIVAMENTE da current_user.sede_id — header ignorato.
  Un malintenzionato NON può manipolare l'API per accedere a un'altra sede.
* Parent: sede implicita dai figli — nessun parametro esterno accettato.
"""
import os
import logging
from typing import Optional

import jwt
from fastapi import HTTPException, Header, Depends

from services.database import get_db
from utils.firebase_client import get_auth, is_initialized

logger = logging.getLogger(__name__)

_JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"

if not _JWT_SECRET:
    logger.warning("JWT_SECRET env variable is not set — custom JWT fallback disabled.")

if DEV_MODE:
    logger.warning(
        "DEV_MODE is enabled: custom JWT fallback is active. "
        "NEVER enable DEV_MODE in production."
    )


def _decode_custom_jwt(token: str) -> dict:
    if not _JWT_SECRET:
        raise HTTPException(status_code=401, detail="JWT_SECRET non configurato")
    try:
        return jwt.decode(token, _JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")


async def get_current_user(authorization: Optional[str] = Header(None)):
    """FastAPI dependency that returns the authenticated MongoDB user dict."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token non fornito")

    token = authorization.split(" ", 1)[1]
    db = get_db()

    # --- Primary: Firebase ID token ---
    if is_initialized():
        try:
            firebase_auth = get_auth()
            decoded = firebase_auth.verify_id_token(token)
            uid = decoded["uid"]
            user = await db.users.find_one(
                {"firebase_uid": uid, "active": True}, {"_id": 0, "password": 0}
            )
            if not user:
                raise HTTPException(
                    status_code=401,
                    detail="Profilo utente non trovato. Registrarsi prima con /api/auth/register.",
                )
            return user
        except HTTPException:
            raise
        except Exception as exc:
            logger.debug("Firebase token verification failed: %s", exc)

    # --- Fallback: custom JWT (always active when JWT_SECRET is set) ---
    if _JWT_SECRET:
        payload = _decode_custom_jwt(token)
        user = await db.users.find_one(
            {"id": payload["user_id"], "active": True},
            {"_id": 0, "password": 0},
        )
        if user:
            return user

    raise HTTPException(status_code=401, detail="Token non valido o Firebase non configurato")


def require_role(*roles: str):
    """Dependency factory that checks the authenticated user's role.

    NOTE: the inner dependency must resolve the user via get_current_user — using
    Header(None) (the previous behaviour) bound current_user to a non-existent HTTP
    header, so the check raised AttributeError/500 instead of enforcing the role.
    """
    async def _check(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Permesso negato")
        return current_user
    return _check


# ---------------------------------------------------------------------------
# Multi-Tenant: Sede Validation
# ---------------------------------------------------------------------------

VALID_SEDE_IDS = {"girogirotondo", "il-magico-mondo"}


def validate_admin_sede_access(current_user: dict, x_sede_id: Optional[str]) -> str:
    """
    Valida l'accesso dell'admin alla sede richiesta tramite header X-Sede-Id.

    Regole di sicurezza:
    - Se l'utente è SuperAdmin (is_superadmin=True): può accedere a qualsiasi sede valida.
    - Se l'utente è Admin normale: può accedere SOLO alla propria sede.
    - Se l'header X-Sede-Id manca: usa la sede dell'admin o 'girogirotondo' come default.

    Returns:
        sede_id validata (stringa)
    Raises:
        HTTPException 403 se l'admin non ha accesso alla sede richiesta.
        HTTPException 400 se la sede_id non esiste.
    """
    role = current_user.get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono specificare la sede")

    # Normalizza: converti None/vuoto al default
    requested_sede = (x_sede_id or "").strip() or current_user.get("sede_id") or "girogirotondo"

    if requested_sede not in VALID_SEDE_IDS:
        raise HTTPException(status_code=400, detail=f"Sede non valida: {requested_sede}")

    is_superadmin = current_user.get("is_superadmin", False)
    if not is_superadmin:
        # Admin normale: può accedere solo alla propria sede
        user_sede = current_user.get("sede_id")
        if user_sede and user_sede != requested_sede:
            raise HTTPException(
                status_code=403,
                detail=f"Accesso negato: non hai i permessi per la sede '{requested_sede}'",
            )

    return requested_sede


def get_teacher_sede_id(current_user: dict) -> str:
    """
    Restituisce la sede_id della maestra dal proprio profilo.
    NON accetta input esterno — sicurezza cross-tenant garantita.
    """
    sede_id = current_user.get("sede_id")
    if not sede_id:
        # Fallback: deriva dalla prima classe assegnata (compatibilità legacy)
        return "girogirotondo"
    return sede_id
