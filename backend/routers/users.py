"""Users router — CRUD + by-class, admin-protected."""
import uuid
import bcrypt
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from services.database import get_db
from models.user import UserCreate, UserUpdate
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eseguire questa operazione")


# ---------------------------------------------------------------------------
# GET /api/users  (admin only)
# ---------------------------------------------------------------------------

@router.get("")
async def get_users(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users


# ---------------------------------------------------------------------------
# GET /api/users/by-class/{class_id}
# ---------------------------------------------------------------------------

@router.get("/by-class/{class_id}")
async def get_users_by_class(class_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    users = await db.users.find(
        {"class_id": class_id}, {"_id": 0, "password": 0}
    ).to_list(500)
    return users


# ---------------------------------------------------------------------------
# GET /api/users/{user_id}
# ---------------------------------------------------------------------------

@router.get("/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    # User can fetch their own profile; admin can fetch any
    if current_user.get("role") != "admin" and current_user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return user


# ---------------------------------------------------------------------------
# POST /api/users  (admin only)
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_user(payload: UserCreate, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()

    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già in uso")

    user_dict = payload.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["firebase_uid"] = None
    user_dict["cognome"] = ""
    user_dict["avatar_url"] = None
    user_dict["active"] = True
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["password"] = bcrypt.hashpw(
        payload.password.encode(), bcrypt.gensalt()
    ).decode()

    await db.users.insert_one(user_dict)
    user_dict.pop("_id", None)
    user_dict.pop("password", None)
    return user_dict


# ---------------------------------------------------------------------------
# PUT /api/users/{user_id}
# ---------------------------------------------------------------------------

@router.put("/{user_id}")
async def update_user(
    user_id: str,
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin" and current_user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return user


# ---------------------------------------------------------------------------
# DELETE /api/users/{user_id}  — hard delete (admin only, cannot delete self)
# ---------------------------------------------------------------------------

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    # Prevent admin from deleting their own account
    if current_user.get("id") == user_id:
        raise HTTPException(status_code=400, detail="Non puoi eliminare il tuo account")
    db = get_db()
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    # Clean up related data
    await db.push_tokens.delete_many({"user_id": user_id})
    return {"message": "Utente eliminato"}
