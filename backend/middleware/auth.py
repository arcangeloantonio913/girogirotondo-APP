"""Authentication middleware — verifies Firebase ID token (primary) or custom JWT (dev fallback)."""
import os
import logging
from typing import Optional

import jwt
from fastapi import HTTPException, Header

from services.database import get_db
from utils.firebase_client import get_auth, is_initialized

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "girogirotondo-secret-key-2024")
JWT_ALGORITHM = "HS256"
DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"


def _decode_custom_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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

    # --- Fallback: custom JWT (DEV_MODE only) ---
    if DEV_MODE:
        payload = _decode_custom_jwt(token)
        user = await db.users.find_one(
            {"id": payload["user_id"], "active": True},
            {"_id": 0, "password": 0},
        )
        if user:
            return user

    raise HTTPException(status_code=401, detail="Token non valido o Firebase non configurato")


def require_role(*roles: str):
    """Dependency factory that checks the user's role."""
    async def _check(current_user: dict = Header(None)):
        # actual injection handled by FastAPI; this wrapper is used via Depends
        if current_user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Permesso negato")
        return current_user
    return _check
