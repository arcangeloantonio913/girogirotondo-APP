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
from middleware.auth import get_current_user, validate_admin_sede_access, get_valid_sede_ids
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
# Helper multi-tenant condivisi (isolamento sede — dati di MINORI)
# ---------------------------------------------------------------------------

async def _admin_allowed_sedi(db, current_user: dict, sede_id: str) -> set:
    """Sedi su cui l'admin può operare.

    - Admin normale → solo la propria sede validata.
    - SuperAdmin → tutte le sedi attive della propria org (fallback pre-backfill:
      nessun org_id → tutte, comportamento odierno).
    """
    if current_user.get("is_superadmin"):
        return await get_valid_sede_ids(db, current_user.get("org_id"))
    return {sede_id}


def _assert_can_modify_target(current_user: dict, target: dict, sede_id: str) -> None:
    """Convenzione consolidata (come /credentials, /resend, DELETE): il SuperAdmin
    bypassa il controllo sede; l'admin normale può toccare solo utenti della propria
    sede e mai un SuperAmministratore."""
    if target.get("is_superadmin") and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Non puoi modificare un SuperAmministratore")
    if not current_user.get("is_superadmin") and target.get("sede_id") != sede_id:
        raise HTTPException(status_code=403, detail="Utente non appartiene alla sede selezionata")


async def _validate_children_in_sedi(db, child_ids, allowed_sedi: set) -> None:
    """Ogni figlio assegnato deve appartenere a una sede consentita (404 = no leak)."""
    for cid in child_ids or []:
        st = await db.students.find_one({"id": cid}, {"_id": 0, "sede_id": 1})
        if not st or st.get("sede_id") not in allowed_sedi:
            raise HTTPException(status_code=404, detail="Bambino non trovato nella sede selezionata")


async def _validate_classes_in_sedi(db, class_ids, allowed_sedi: set) -> None:
    """Ogni classe assegnata deve appartenere a una sede consentita (404 = no leak)."""
    for clid in class_ids or []:
        cl = await db.classes.find_one({"id": clid}, {"_id": 0, "sede_id": 1})
        if not cl or cl.get("sede_id") not in allowed_sedi:
            raise HTTPException(status_code=404, detail="Classe non trovata nella sede selezionata")


# ---------------------------------------------------------------------------
# GET /api/users  (admin only — filtrato per sede)
# ---------------------------------------------------------------------------

@router.get("")
async def get_users(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    _require_admin(current_user)
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    # SuperAdmin che non ha sede_id fissa — filtra per header
    # Admin normale — filtra per la propria sede
    query: dict = {"sede_id": sede_id}

    # Includi anche i superadmin nella lista (sede_id=None), MA solo quelli della propria org
    # (post-backfill). Fallback pre-backfill (caller senza org_id): tutti i superadmin (odierno).
    if current_user.get("is_superadmin"):
        caller_org = current_user.get("org_id")
        super_clause = {"is_superadmin": True}
        if caller_org:
            super_clause["org_id"] = caller_org
        query = {"$or": [{"sede_id": sede_id}, super_clause]}

    users = await db.users.find(query, {"_id": 0, "password": 0, "admin_password": 0}).to_list(1000)
    return users


# ---------------------------------------------------------------------------
# GET /api/users/by-class/{class_id}
# ---------------------------------------------------------------------------

@router.get("/by-class/{class_id}")
async def get_users_by_class(
    class_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    role = current_user.get("role")
    if role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    # Una maestra può interrogare SOLO le proprie classi (l'endpoint espone i genitori
    # della classe → niente enumerazione di classi altrui).
    if role == "teacher":
        tclasses = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in tclasses:
            tclasses.append(legacy)
        if class_id not in tclasses:
            raise HTTPException(status_code=403, detail="Accesso negato: classe non assegnata")
    else:
        # Admin: la classe deve appartenere alla propria sede (superadmin: alla propria org).
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        allowed = await _admin_allowed_sedi(db, current_user, sede_id)
        cls = await db.classes.find_one({"id": class_id}, {"_id": 0, "sede_id": 1})
        if not cls or cls.get("sede_id") not in allowed:
            raise HTTPException(status_code=404, detail="Classe non trovata")
    _proj = {"_id": 0, "password": 0, "admin_password": 0}
    # 1) Utenti con class_id diretto (es. maestre assegnate)
    direct = await db.users.find({"class_id": class_id}, _proj).to_list(500)
    # 2) Genitori dei bambini di questa classe — i genitori NON hanno class_id,
    #    sono collegati alla classe tramite i figli (child_ids -> students.class_id).
    students = await db.students.find({"class_id": class_id}, {"_id": 0, "id": 1}).to_list(500)
    student_ids = [s["id"] for s in students]
    parents = []
    if student_ids:
        parents = await db.users.find(
            {"role": "parent", "child_ids": {"$in": student_ids}}, _proj
        ).to_list(500)
    seen = {u["id"] for u in direct}
    return direct + [p for p in parents if p["id"] not in seen]


# ---------------------------------------------------------------------------
# GET /api/users/{user_id}
# ---------------------------------------------------------------------------

@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    is_self = current_user.get("id") == user_id
    if current_user.get("role") != "admin" and not is_self:
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "admin_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    # Un admin non-super può leggere solo utenti della propria sede (no disclosure PII
    # cross-tenant). 404, non 403, per non rivelare l'esistenza dell'utente.
    if not is_self and current_user.get("role") == "admin":
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        allowed = await _admin_allowed_sedi(db, current_user, sede_id)
        if not current_user.get("is_superadmin") and user.get("sede_id") not in allowed:
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
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
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

    # Assegna sede. L'admin normale NON può creare utenti fuori dalla propria sede:
    # la sede del payload è accettata solo dal superadmin (bounded alla sua org).
    allowed_sedi = await _admin_allowed_sedi(db, current_user, sede_id)
    if current_user.get("is_superadmin"):
        requested_sede = payload.sede_id or sede_id
        if requested_sede not in allowed_sedi:
            raise HTTPException(status_code=404, detail="Sede non valida")
        user_dict["sede_id"] = requested_sede
    else:
        # Ignora un eventuale payload.sede_id manipolato → sempre la sede validata.
        user_dict["sede_id"] = sede_id
    target_sedi = {user_dict["sede_id"]}

    # Normalizza class_ids
    class_ids = list(payload.class_ids or [])
    if payload.class_id and payload.class_id not in class_ids:
        class_ids.append(payload.class_id)
    # Le classi assegnate devono appartenere alla sede dell'utente creato.
    await _validate_classes_in_sedi(db, class_ids, target_sedi)
    user_dict["class_ids"] = class_ids
    user_dict["class_id"] = class_ids[0] if class_ids else None

    # Normalizza child_ids
    child_ids = list(payload.child_ids or [])
    if payload.child_id and payload.child_id not in child_ids:
        child_ids.append(payload.child_id)
    # I figli assegnati devono appartenere alla sede dell'utente creato (dati minori).
    await _validate_children_in_sedi(db, child_ids, target_sedi)
    user_dict["child_ids"] = child_ids
    user_dict["child_id"] = child_ids[0] if child_ids else None

    await db.users.insert_one(user_dict)
    user_dict.pop("_id", None)
    user_dict.pop("password", None)
    user_dict.pop("admin_password", None)
    return user_dict


# ---------------------------------------------------------------------------
# PUT /api/users/{user_id}
# ---------------------------------------------------------------------------

@router.put("/{user_id}")
async def update_user(
    user_id: str,
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    is_admin = current_user.get("role") == "admin"
    is_self = current_user.get("id") == user_id
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    # Anti privilege-escalation: un utente non-admin (self-service) NON può modificare
    # sede/classi/figli — altrimenti si auto-concederebbe accesso ad altri tenant/bambini.
    if not is_admin:
        _PRIVILEGED = {"sede_id", "class_id", "class_ids", "child_id", "child_ids"}
        updates = {k: v for k, v in updates.items() if k not in _PRIVILEGED}
    else:
        # Admin: verifica che il target appartenga alla propria sede (isolamento
        # multi-tenant su dati di minori) e che i campi privilegiati restino nella sede.
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        target = await db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        _assert_can_modify_target(current_user, target, sede_id)
        allowed_sedi = await _admin_allowed_sedi(db, current_user, sede_id)
        # La sede di destinazione (se modificata) deve restare consentita al chiamante.
        if "sede_id" in updates and updates["sede_id"] not in allowed_sedi:
            raise HTTPException(status_code=404, detail="Sede non valida")
        dest_sedi = {updates.get("sede_id", target.get("sede_id"))}
        cl_ids = list(updates.get("class_ids") or [])
        if updates.get("class_id"):
            cl_ids.append(updates["class_id"])
        await _validate_classes_in_sedi(db, cl_ids, dest_sedi)
        ch_ids = list(updates.get("child_ids") or [])
        if updates.get("child_id"):
            ch_ids.append(updates["child_id"])
        await _validate_children_in_sedi(db, ch_ids, dest_sedi)

    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "admin_password": 0})
    return user


# ---------------------------------------------------------------------------
# POST /api/users/iscrizione  — crea bambino + genitore + invia email
# ---------------------------------------------------------------------------

@router.post("/iscrizione", status_code=201)
async def iscrizione_bambino(
    payload: IscrizioneCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """
    Registrazione completa: crea studente + account genitore in un unico step.
    Invia le credenziali via email. Solo admin.
    """
    _require_admin(current_user)

    # Valida sede: usa sede_id dal payload, verificando che l'admin abbia accesso
    sede_id = await validate_admin_sede_access(current_user, payload.sede_id or x_sede_id)

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
            {"email": payload.genitore_email}, {"_id": 0, "password": 0, "admin_password": 0}
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
        parent = {k: v for k, v in parent_doc.items() if k not in ("_id", "password", "admin_password")}

    # 3. Email — sincrona per garantire l'invio reale su Railway
    if sibling_mode or getattr(payload, 'skip_email', False):
        email_inviata = False
    else:
        email_inviata = await send_credentials_email(
            payload.genitore_email,
            payload.bambino_nome,
            payload.bambino_cognome,
            password_plain,
            cls.get("sede_id", sede_id),
            org_id=current_user.get("org_id"),
        )

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
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """
    Aggiunge un secondo account genitore associato allo stesso bambino.
    Utile per genitori divorziati che vogliono accessi separati.
    - Se l'email è già un account genitore: aggiunge il bambino ai suoi child_ids.
    - Se l'email non esiste: crea nuovo account genitore con credenziali proprie.
    Solo admin.
    """
    _require_admin(current_user)
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    # Verifica che lo studente esista E appartenga alla sede dell'admin (dati di minori:
    # niente collegamento di account genitore a bambini di un'altra sede). 404 = no leak.
    student = await db.students.find_one({"id": payload.student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Bambino non trovato")
    allowed_sedi = await _admin_allowed_sedi(db, current_user, sede_id)
    if not current_user.get("is_superadmin") and student.get("sede_id") not in allowed_sedi:
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
            {"email": payload.genitore_email}, {"_id": 0, "password": 0, "admin_password": 0}
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
        parent = {k: v for k, v in parent_doc.items() if k not in ("_id", "password", "admin_password")}

        # Invia email con credenziali — sincrona
        email_inviata = await send_credentials_email(
            payload.genitore_email,
            student.get("name", ""),
            student.get("cognome", ""),
            password_plain,
            student.get("sede_id", "girogirotondo"),
            org_id=current_user.get("org_id"),
        )
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
    x_sede_id: Optional[str] = Header(None),
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

    # Admin che cambia l'email di un ALTRO utente → solo se della propria sede
    # (cambiare l'email è il primo passo di un account takeover cross-tenant).
    if is_admin and not is_self:
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        target = await db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        _assert_can_modify_target(current_user, target, sede_id)

    existing = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
    if existing:
        raise HTTPException(status_code=400, detail="Email già in uso da un altro account")

    await db.users.update_one({"id": user_id}, {"$set": {"email": new_email}})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "admin_password": 0})
    return user


# ---------------------------------------------------------------------------
# PATCH /api/users/{user_id}/password  — cambio password self-service (o admin)
# ---------------------------------------------------------------------------

@router.patch("/{user_id}/password")
async def update_own_password(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """Cambio password SELF-service. Gli admin cambiano la password altrui via
    /credentials (che applica i controlli di sede)."""
    if current_user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Puoi cambiare solo la tua password")

    new_password = (payload.get("password") or "").strip()
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="La password deve essere di almeno 6 caratteri")

    db = get_db()
    hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    result = await db.users.update_one({"id": user_id}, {"$set": {"password": hashed}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return {"message": "Password aggiornata"}


# ---------------------------------------------------------------------------
# PUT /api/users/{user_id}/credentials  — modifica email e/o password (admin only)
# ---------------------------------------------------------------------------

@router.put("/{user_id}/credentials")
async def update_user_credentials(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Aggiorna email e/o password di un utente. Solo admin della stessa sede."""
    _require_admin(current_user)
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if target.get("is_superadmin") and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Non puoi modificare un SuperAmministratore")
    if not current_user.get("is_superadmin") and target.get("sede_id") != sede_id:
        raise HTTPException(status_code=403, detail="Utente non appartiene alla sede selezionata")

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

    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    await db.users.update_one({"id": user_id}, {"$set": updates})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "admin_password": 0})
    return user


# ---------------------------------------------------------------------------
# POST /api/users/{user_id}/resend-credentials  — reinvia credenziali (admin)
# ---------------------------------------------------------------------------

@router.post("/{user_id}/resend-credentials")
async def resend_credentials(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """
    Genera nuova password (o usa quella fornita), aggiorna l'utente
    e invia email con le nuove credenziali.
    Restituisce la nuova password in chiaro (per consegna manuale, mostrata una volta).
    Solo admin della stessa sede.
    """
    _require_admin(current_user)
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if target.get("is_superadmin") and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Non puoi modificare un SuperAmministratore")
    if not current_user.get("is_superadmin") and target.get("sede_id") != sede_id:
        raise HTTPException(status_code=403, detail="Utente non appartiene alla sede selezionata")

    new_password = payload.get("password") or _generate_password()

    # Aggiorna la password nel DB + salva in chiaro per admin
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "password":       bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode(),
        }}
    )

    # Invia email — sincrono per restituire feedback reale all'admin
    email_sent = await send_resend_credentials_email(
        target["email"],
        target.get("name", ""),
        new_password,
        target.get("role", "parent"),
        sede_id=target.get("sede_id"),
        org_id=target.get("org_id"),
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

    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
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
