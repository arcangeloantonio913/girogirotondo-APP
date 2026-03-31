"""Auth router — register (Firebase + MongoDB), login (legacy dev), me."""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Header, Depends, Request

from services.database import get_db
from models.user import UserRegister
from middleware.auth import get_current_user
from middleware.rate_limiter import limiter
from utils.firebase_client import get_auth, is_initialized

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, payload: UserRegister):
    """
    Create a Firebase Auth user + extended MongoDB profile.
    Returns the new user profile (without password).
    """
    db = get_db()

    # Check email already in MongoDB
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già in uso")

    firebase_uid: Optional[str] = None

    # Create Firebase Auth user (if SDK is configured)
    if is_initialized():
        try:
            auth = get_auth()
            fb_user = auth.create_user(
                email=payload.email,
                password=payload.password,
                display_name=f"{payload.name} {payload.cognome}",
            )
            firebase_uid = fb_user.uid
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Errore Firebase Auth: {exc}")
    else:
        logger.warning("Firebase not configured — creating user in MongoDB only (DEV_MODE)")

    user_dict = {
        "id": str(uuid.uuid4()),
        "firebase_uid": firebase_uid,
        "name": payload.name,
        "cognome": payload.cognome,
        "email": payload.email,
        "password": bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode(),
        "role": payload.role,
        "class_id": payload.class_id,
        "child_id": payload.child_id,
        "avatar_url": payload.avatar_url,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user_dict)
    user_dict.pop("_id", None)
    user_dict.pop("password", None)
    return user_dict


# ---------------------------------------------------------------------------
# POST /api/auth/login  (legacy — custom JWT, kept for DEV_MODE / backward compat)
# ---------------------------------------------------------------------------

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, payload: dict):
    """Legacy login endpoint. Returns custom JWT token."""
    db = get_db()
    email = payload.get("email", "")
    password = payload.get("password", "")

    user = await db.users.find_one({"email": email, "active": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    stored_pw = user.get("password", "")
    if not stored_pw or not bcrypt.checkpw(password.encode(), stored_pw.encode()):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET non configurato sul server")
    from datetime import timedelta
    token_payload = {
        "user_id": user["id"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    safe_user = {k: v for k, v in user.items() if k != "password"}
    return {"token": token, "user": safe_user}


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
