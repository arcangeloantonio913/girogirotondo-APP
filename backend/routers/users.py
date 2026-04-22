"""Users router — CRUD + by-class, admin-protected."""
import uuid
import bcrypt
import random
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from services.database import get_db
from models.user import UserCreate, UserUpdate, IscrizioneCreate
from middleware.auth import get_current_user
from services.email_service import send_credentials_email

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eseguire questa operazione")


def _generate_password(length: int = 10) -> str:
    """Genera una password casuale sicura."""
    chars = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(random.choices(chars, k=length))


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
    user_dict["cognome"] = payload.cognome or ""
    user_dict["avatar_url"] = None
    user_dict["active"] = True
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["password"] = bcrypt.hashpw(
        payload.password.encode(), bcrypt.gensalt()
    ).decode()

    # Normalizza class_ids: se passato class_id legacy, aggiungilo a class_ids
    class_ids = list(payload.class_ids or [])
    if payload.class_id and payload.class_id not in class_ids:
        class_ids.append(payload.class_id)
    user_dict["class_ids"] = class_ids
    user_dict["class_id"] = class_ids[0] if class_ids else None

    # Normalizza child_ids: se passato child_id legacy, aggiungilo a child_ids
    child_ids = list(payload.child_ids or [])
    if payload.child_id and payload.child_id not in child_ids:
        child_ids.append(payload.child_id)
    user_dict["child_ids"] = child_ids
    user_dict["child_id"] = child_ids[0] if child_ids else None

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
# POST /api/users/iscrizione  — crea bambino + genitore + invia email
# ---------------------------------------------------------------------------

@router.post("/iscrizione", status_code=201)
async def iscrizione_bambino(
    payload: IscrizioneCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Registrazione completa: crea studente + account genitore in un unico step.
    Invia le credenziali via email a scuolagirogirotondo@libero.it → genitore.
    Solo admin.
    """
    _require_admin(current_user)
    db = get_db()

    # Controlla unicità email genitore
    existing = await db.users.find_one({"email": payload.genitore_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email genitore già in uso")

    # Password: usa quella fornita o generane una
    password_plain = payload.genitore_password or _generate_password()

    # 1. Crea il record studente
    student_id = str(uuid.uuid4())
    student = {
        "id": student_id,
        "name": payload.bambino_nome,
        "cognome": payload.bambino_cognome,
        "class_id": payload.class_id,
        "date_of_birth": payload.bambino_data_nascita or "",
        "child_code": f"GGT-{str(uuid.uuid4())[:4].upper()}",
        "allergies": [],
        "notes": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.students.insert_one(student)

    # 2. Crea l'account genitore
    genitore_nome = payload.genitore_nome or f"Famiglia {payload.bambino_cognome}"
    parent = {
        "id": str(uuid.uuid4()),
        "name": genitore_nome,
        "cognome": payload.bambino_cognome,
        "email": payload.genitore_email,
        "password": bcrypt.hashpw(password_plain.encode(), bcrypt.gensalt()).decode(),
        "role": "parent",
        "child_id": student_id,        # legacy compat
        "child_ids": [student_id],
        "class_id": None,
        "class_ids": [],
        "firebase_uid": None,
        "avatar_url": None,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(parent)

    # 3. Invia email con le credenziali al genitore
    await send_credentials_email(
        to_email=payload.genitore_email,
        bambino_nome=payload.bambino_nome,
        bambino_cognome=payload.bambino_cognome,
        password=password_plain,
    )

    # Risposta pulita (no _id, no password hash)
    student.pop("_id", None)
    parent.pop("_id", None)
    parent.pop("password", None)

    return {
        "student": student,
        "parent": parent,
        "email_inviata": True,
        "genitore_email": payload.genitore_email,
    }


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
