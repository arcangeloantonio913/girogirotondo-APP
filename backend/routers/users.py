"""Users router — CRUD + iscrizione bambino — multi-tenant."""
import uuid
import bcrypt
import random
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header, BackgroundTasks

from services.database import get_db
from models.user import UserCreate, UserUpdate, IscrizioneCreate, SecondoGenitoreCreate
from middleware.auth import get_current_user, validate_admin_sede_access
from services.email_service import send_credentials_email, send_resend_credentials_email

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eseguire questa operazione")


def _generate_password(length: int = 10) -> str:
    """Genera una password casuale sicura."""
    chars = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(random.choices(chars, k=length))


# ---------------------------------------------------------------------------
# GET /api/users  (admin only — filtrato per sede)
# ---------------------------------------------------------------------------

@router.get("")
async def get_users(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    _require_admin(current_user)
    sede_id = validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    # SuperAdmin che non ha sede_id fissa — filtra per header
    # Admin normale — filtra per la propria sede
    query: dict = {"sede_id": sede_id}

    # Includi anche i superadmin nella lista (sede_id=None)
    if current_user.get("is_superadmin"):
        query = {"$or": [{"sede_id": sede_id}, {"is_superadmin": True}]}

    users = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
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
async def create_user(
    payload: UserCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    _require_admin(current_user)
    sede_id = validate_admin_sede_access(current_user, x_sede_id)
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
    user_dict["is_superadmin"] = False
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["password"] = bcrypt.hashpw(
        payload.password.encode(), bcrypt.gensalt()
    ).decode()
    user_dict["admin_password"] = payload.password   # visibile all'admin

    # Assegna sede (usa quella del payload se fornita, altrimenti quella attiva)
    user_dict["sede_id"] = payload.sede_id or sede_id

    # Normalizza class_ids
    class_ids = list(payload.class_ids or [])
    if payload.class_id and payload.class_id not in class_ids:
        class_ids.append(payload.class_id)
    user_dict["class_ids"] = class_ids
    user_dict["class_id"] = class_ids[0] if class_ids else None

    # Normalizza child_ids
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
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """
    Registrazione completa: crea studente + account genitore in un unico step.
    Invia le credenziali via email. Solo admin.
    """
    _require_admin(current_user)

    # Valida sede: usa sede_id dal payload, verificando che l'admin abbia accesso
    sede_id = validate_admin_sede_access(current_user, payload.sede_id or x_sede_id)

    db = get_db()

    # Verifica che la classe appartenga alla sede
    cls = await db.classes.find_one({"id": payload.class_id, "sede_id": sede_id})
    if not cls:
        raise HTTPException(
            status_code=400,
            detail=f"La classe selezionata non appartiene alla sede '{sede_id}'"
        )

    password_plain = payload.genitore_password or _generate_password()

    # 1. Crea il record studente
    student_id = str(uuid.uuid4())
    student = {
        "id": student_id,
        "name": payload.bambino_nome,
        "cognome": payload.bambino_cognome,
        "class_id": payload.class_id,
        "sede_id": sede_id,
        "date_of_birth": payload.bambino_data_nascita or "",
        "child_code": f"GGT-{str(uuid.uuid4())[:4].upper()}",
        "allergies": [],
        "notes": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.students.insert_one(student)

    # 2a. Genitore già esistente? Aggiungi figlio all'account esistente (gemelli/fratelli)
    existing_parent = await db.users.find_one({"email": payload.genitore_email})
    sibling_mode = False  # True = aggiornato account esistente

    if existing_parent and existing_parent.get("role") == "parent":
        sibling_mode = True
        await db.users.update_one(
            {"email": payload.genitore_email},
            {
                "$addToSet": {"child_ids": student_id},
                "$set":      {"child_id": student_id},  # aggiorna anche il legacy field
            }
        )
        # Ricarica il parent aggiornato
        parent = await db.users.find_one(
            {"email": payload.genitore_email}, {"_id": 0, "password": 0}
        )
    elif existing_parent:
        # Email usata da un account non-parent (admin/teacher) — rifiuta
        raise HTTPException(
            status_code=400,
            detail="Email già in uso da un account staff. Usare un'email diversa per il genitore."
        )
    else:
        # 2b. Nessun account esistente → crea account genitore nuovo
        genitore_nome = payload.genitore_nome or f"Famiglia {payload.bambino_cognome}"
        parent_doc = {
            "id": str(uuid.uuid4()),
            "name": genitore_nome,
            "cognome": payload.bambino_cognome,
            "email": payload.genitore_email,
            "password": bcrypt.hashpw(password_plain.encode(), bcrypt.gensalt()).decode(),
            "admin_password": password_plain,   # visibile all'admin
            "role": "parent",
            "is_superadmin": False,
            "sede_id": sede_id,
            "child_id": student_id,
            "child_ids": [student_id],
            "class_id": None,
            "class_ids": [],
            "firebase_uid": None,
            "avatar_url": None,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(parent_doc)
        parent = {k: v for k, v in parent_doc.items() if k not in ("_id", "password")}

    # 3. Email in background — non blocca la risposta (risposta immediata ~0.3s)
    if sibling_mode:
        # Genitore già esistente: NON inviare email con nuova password
        # (il genitore usa già le sue credenziali attuali — la password_plain
        # era stata generata ma non è stata salvata nel DB)
        email_inviata = False
    else:
        # Nuovo genitore: invia email con credenziali in background
        background_tasks.add_task(
            send_credentials_email,
            payload.genitore_email,
            payload.bambino_nome,
            payload.bambino_cognome,
            password_plain,
            cls.get("sede_id", sede_id),
        )
        email_inviata = True

    student.pop("_id", None)
    if isinstance(parent, dict):
        parent.pop("_id", None)
        parent.pop("password", None)

    return {
        "student": student,
        "parent": parent,
        "email_inviata": email_inviata,
        "genitore_email": payload.genitore_email,
        "sibling_added": sibling_mode,  # True se aggiunto a genitore esistente
    }


# ---------------------------------------------------------------------------
# POST /api/users/secondo-genitore  — aggiunge un secondo genitore a un bambino
# ---------------------------------------------------------------------------

@router.post("/secondo-genitore", status_code=201)
async def aggiungi_secondo_genitore(
    payload: SecondoGenitoreCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Aggiunge un secondo account genitore associato allo stesso bambino.
    Utile per genitori divorziati che vogliono accessi separati.
    - Se l'email è già un account genitore: aggiunge il bambino ai suoi child_ids.
    - Se l'email non esiste: crea nuovo account genitore con credenziali proprie.
    Solo admin.
    """
    _require_admin(current_user)
    db = get_db()

    # Verifica che lo studente esista
    student = await db.students.find_one({"id": payload.student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Bambino non trovato")

    password_plain = payload.genitore_password or _generate_password()
    existing_parent = await db.users.find_one({"email": payload.genitore_email})

    if existing_parent and existing_parent.get("role") == "parent":
        # Aggiungi bambino al genitore esistente
        await db.users.update_one(
            {"email": payload.genitore_email},
            {
                "$addToSet": {"child_ids": payload.student_id},
                "$set":      {"child_id": payload.student_id},
            }
        )
        parent = await db.users.find_one(
            {"email": payload.genitore_email}, {"_id": 0, "password": 0}
        )
        email_inviata = False
        created = False
    elif existing_parent:
        raise HTTPException(
            status_code=400,
            detail="Questa email è già usata da un account staff. Usa un'email diversa."
        )
    else:
        # Crea nuovo account genitore
        nome = payload.genitore_nome or f"Famiglia {student.get('cognome', '')}"
        parent_doc = {
            "id":           str(uuid.uuid4()),
            "name":         nome,
            "cognome":      student.get("cognome", ""),
            "email":        payload.genitore_email,
            "password":     bcrypt.hashpw(password_plain.encode(), bcrypt.gensalt()).decode(),
            "admin_password": password_plain,
            "role":         "parent",
            "is_superadmin": False,
            "sede_id":      student.get("sede_id"),
            "child_id":     payload.student_id,
            "child_ids":    [payload.student_id],
            "class_id":     None,
            "class_ids":    [],
            "firebase_uid": None,
            "avatar_url":   None,
            "active":       True,
            "created_at":   datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(parent_doc)
        parent = {k: v for k, v in parent_doc.items() if k not in ("_id", "password")}

        # Invia email con credenziali
        background_tasks.add_task(
            send_credentials_email,
            payload.genitore_email,
            student.get("name", ""),
            student.get("cognome", ""),
            password_plain,
            student.get("sede_id", "girogirotondo"),
        )
        email_inviata = True
        created = True

    if isinstance(parent, dict):
        parent.pop("_id", None)
        parent.pop("password", None)

    return {
        "parent":        parent,
        "student":       student,
        "created":       created,
        "email_inviata": email_inviata,
        "new_password":  password_plain if created else None,
    }


# ---------------------------------------------------------------------------
# PATCH /api/users/{user_id}/email  — modifica email (self o admin)
# ---------------------------------------------------------------------------

@router.patch("/{user_id}/email")
async def update_user_email(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Permette all'utente di aggiornare la propria email, o all'admin di cambiarla.
    Verifica unicità email e aggiorna anche il campo admin_password se necessario.
    """
    is_admin = current_user.get("role") == "admin"
    is_self  = current_user.get("id") == user_id
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Permesso negato")

    new_email = (payload.get("email") or "").strip().lower()
    if not new_email:
        raise HTTPException(status_code=400, detail="Email obbligatoria")

    db = get_db()
    existing = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
    if existing:
        raise HTTPException(status_code=400, detail="Email già in uso da un altro account")

    await db.users.update_one({"id": user_id}, {"$set": {"email": new_email}})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return user


# ---------------------------------------------------------------------------
# PUT /api/users/{user_id}/credentials  — modifica email e/o password (admin only)
# ---------------------------------------------------------------------------

@router.put("/{user_id}/credentials")
async def update_user_credentials(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """Aggiorna email e/o password di un utente. Solo admin."""
    _require_admin(current_user)
    db = get_db()

    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if target.get("is_superadmin") and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Non puoi modificare un SuperAmministratore")

    updates = {}
    new_email = payload.get("email", "").strip()
    new_password = payload.get("password", "").strip()

    if new_email:
        # Verifica unicità email
        existing = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email già in uso da un altro account")
        updates["email"] = new_email

    if new_password:
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="La password deve essere di almeno 6 caratteri")
        updates["password"] = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        updates["admin_password"] = new_password   # visibile all'admin

    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    await db.users.update_one({"id": user_id}, {"$set": updates})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return user


# ---------------------------------------------------------------------------
# POST /api/users/{user_id}/resend-credentials  — reinvia credenziali (admin)
# ---------------------------------------------------------------------------

@router.post("/{user_id}/resend-credentials")
async def resend_credentials(
    user_id: str,
    payload: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Genera nuova password (o usa quella fornita), aggiorna l'utente
    e invia email con le nuove credenziali.
    Restituisce la nuova password in chiaro (per consegna manuale).
    Solo admin.
    """
    _require_admin(current_user)
    db = get_db()

    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if target.get("is_superadmin") and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Non puoi modificare un SuperAmministratore")

    new_password = payload.get("password") or _generate_password()

    # Aggiorna la password nel DB + salva in chiaro per admin
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "password":       bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode(),
            "admin_password": new_password,   # visibile all'admin
        }}
    )

    # Invia email — sincrono per restituire feedback reale all'admin
    email_sent = await send_resend_credentials_email(
        target["email"],
        target.get("name", ""),
        new_password,
        target.get("role", "parent"),
    )

    return {
        "message": "Credenziali aggiornate" + (" e email inviata" if email_sent else " (email NON inviata — verifica RESEND_API_KEY su Railway)"),
        "email": target["email"],
        "new_password": new_password,
        "email_sent": email_sent,
    }


# ---------------------------------------------------------------------------
# DELETE /api/users/{user_id}  — hard delete (admin only)
# ---------------------------------------------------------------------------

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    _require_admin(current_user)
    if current_user.get("id") == user_id:
        raise HTTPException(status_code=400, detail="Non puoi eliminare il tuo account")

    sede_id = validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    # Verifica che l'utente appartenga alla sede (SuperAdmin esclusi)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if target.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Non puoi eliminare un SuperAmministratore")
    if not current_user.get("is_superadmin") and target.get("sede_id") != sede_id:
        raise HTTPException(status_code=403, detail="Utente non appartiene alla sede selezionata")

    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    await db.push_tokens.delete_many({"user_id": user_id})
    return {"message": "Utente eliminato"}
