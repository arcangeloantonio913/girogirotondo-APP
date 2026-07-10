"""Database service — Motor async client + multi-tenant seed."""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        mongo_url = os.environ["MONGO_URL"]
        if mongo_url.startswith("mongodb+srv://"):
            import certifi
            _client = AsyncIOMotorClient(
                mongo_url,
                tlsCAFile=certifi.where(),
                tlsAllowInvalidCertificates=True,
                tlsAllowInvalidHostnames=True,
                serverSelectionTimeoutMS=20000,
                connectTimeoutMS=20000,
                socketTimeoutMS=20000,
            )
        else:
            _client = AsyncIOMotorClient(
                mongo_url,
                serverSelectionTimeoutMS=20000,
                connectTimeoutMS=20000,
                socketTimeoutMS=20000,
            )
    return _client


def get_db():
    return get_client()[os.environ.get("DB_NAME", "girogirotondo")]


def hash_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ---------------------------------------------------------------------------
# Multi-Tenant Seed — Two sedi, two superadmins, isolated data per sede
# ---------------------------------------------------------------------------

async def ensure_superadmins():
    """
    Eseguito ad OGNI avvio: garantisce che Mariagrazia e Teresa
    esistano con le email e password corrette, indipendentemente
    dallo stato del database. Usa upsert — sicuro da chiamare più volte.
    """
    db = get_db()

    superadmin_defs = [
        {
            "email": "mariucciasc@gmail.com",
            "name": "Mariagrazia",
            "cognome": "Direttrice",
            "password_plain": "Mariagrazia2026!",
        },
        {
            "email": "melignanoteresa@gmail.com",
            "name": "Teresa",
            "cognome": "Coordinatrice",
            "password_plain": "Teresa2026!",
        },
    ]

    for sa in superadmin_defs:
        existing = await db.users.find_one({"email": sa["email"]})
        new_hash = hash_password(sa["password_plain"])

        if existing:
            # Aggiorna sempre password, nome e flag superadmin
            await db.users.update_one(
                {"email": sa["email"]},
                {"$set": {
                    "name": sa["name"],
                    "cognome": sa["cognome"],
                    "password": new_hash,
                    "role": "admin",
                    "is_superadmin": True,
                    "active": True,
                    "sede_id": None,
                }},
            )
            logger.info("[SUPERADMIN] Credenziali aggiornate per %s", sa["email"])
        else:
            # Crea da zero se non esiste
            doc = {
                "id": str(uuid.uuid4()),
                "firebase_uid": None,
                "name": sa["name"],
                "cognome": sa["cognome"],
                "email": sa["email"],
                "password": new_hash,
                "role": "admin",
                "is_superadmin": True,
                "sede_id": None,
                "class_id": None,
                "class_ids": [],
                "child_id": None,
                "child_ids": [],
                "avatar_url": None,
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(doc)
            logger.info("[SUPERADMIN] Creato nuovo account per %s", sa["email"])

    # Rimuovi vecchi account con email obsolete
    old_emails = ["mariagrazia@girogirotondo.it", "teresa@girogirotondo.it"]
    result = await db.users.delete_many({"email": {"$in": old_emails}})
    if result.deleted_count:
        logger.info("[SUPERADMIN] Rimossi %d account obsoleti", result.deleted_count)

    # ── Deduplicazione: rimuove eventuali doppioni con la stessa email ────────
    sa_emails = [sa["email"] for sa in superadmin_defs]
    for email in sa_emails:
        dupes = await db.users.find({"email": email}).to_list(20)
        if len(dupes) > 1:
            # Tieni solo il primo trovato, cancella gli altri
            ids_to_remove = [d["id"] for d in dupes[1:] if "id" in d]
            if ids_to_remove:
                await db.users.delete_many({"id": {"$in": ids_to_remove}})
                logger.info("[SUPERADMIN] Rimossi %d doppioni per %s", len(ids_to_remove), email)


async def _deduplicate_users(db):
    """Rimuove utenti con la stessa email (tieni il più recente). Eseguita ad ogni avvio."""
    pipeline = [
        {"$group": {
            "_id": "$email",
            "ids": {"$push": "$id"},
            "count": {"$sum": 1}
        }},
        {"$match": {"count": {"$gt": 1}}}
    ]
    dupes = await db.users.aggregate(pipeline).to_list(200)
    removed = 0
    for group in dupes:
        # Tieni il primo, rimuovi i duplicati
        ids_to_remove = group["ids"][1:]
        if ids_to_remove:
            await db.users.delete_many({"id": {"$in": ids_to_remove}})
            removed += len(ids_to_remove)
    if removed:
        logger.info("[SEED] Rimossi %d utenti duplicati", removed)


async def _deduplicate_students(db):
    """Rimuove studenti duplicati (stesso name + class_id). Tieni il più vecchio."""
    pipeline = [
        {"$group": {
            "_id": {"name": "$name", "class_id": "$class_id"},
            "ids": {"$push": "$id"},
            "count": {"$sum": 1}
        }},
        {"$match": {"count": {"$gt": 1}}}
    ]
    dupes = await db.students.aggregate(pipeline).to_list(200)
    removed = 0
    for group in dupes:
        # Tieni il primo ID, elimina gli altri
        ids_to_remove = group["ids"][1:]
        if ids_to_remove:
            await db.students.delete_many({"id": {"$in": ids_to_remove}})
            removed += len(ids_to_remove)
    if removed:
        logger.info("[SEED] Rimossi %d studenti duplicati", removed)


async def ensure_demo_accounts():
    """
    Garantisce che gli account demo (maestre e genitori del seed) esistano sempre
    con le password corrette. Eseguita ad ogni avvio, sicura da chiamare più volte.
    """
    db = get_db()

    demo_users = [
        # ── Girogirotondo ──────────────────────────────────────────────────
        {"email": "giulia@girogirotondo.it",  "name": "Giulia Bianchi",    "role": "teacher", "sede_id": "girogirotondo",  "password": "teacher123"},
        {"email": "anna@girogirotondo.it",    "name": "Anna Verdi",         "role": "teacher", "sede_id": "girogirotondo",  "password": "teacher123"},
        {"email": "paolo@famiglia.it",        "name": "Paolo Marino",       "role": "parent",  "sede_id": "girogirotondo",  "password": "parent123"},
        {"email": "laura@famiglia.it",        "name": "Laura Ferrari",      "role": "parent",  "sede_id": "girogirotondo",  "password": "parent123"},
        {"email": "andrea@famiglia.it",       "name": "Andrea Colombo",     "role": "parent",  "sede_id": "girogirotondo",  "password": "parent123"},
        # ── Il Magico Mondo ────────────────────────────────────────────────
        {"email": "carla@magicomondo.it",     "name": "Carla Rossi",        "role": "teacher", "sede_id": "il-magico-mondo", "password": "teacher123"},
        {"email": "marta@magicomondo.it",     "name": "Marta Verde",        "role": "teacher", "sede_id": "il-magico-mondo", "password": "teacher123"},
        {"email": "francesca@famiglia.it",    "name": "Francesca Fontana",  "role": "parent",  "sede_id": "il-magico-mondo", "password": "parent123"},
        {"email": "riccardo@famiglia.it",     "name": "Riccardo Mancini",   "role": "parent",  "sede_id": "il-magico-mondo", "password": "parent123"},
    ]

    for u in demo_users:
        existing = await db.users.find_one({"email": u["email"]})
        new_hash = hash_password(u["password"])
        if existing:
            # Aggiorna solo la password (non sovrascrivere class_ids/child_ids)
            await db.users.update_one(
                {"email": u["email"]},
                {"$set": {"password": new_hash, "active": True}},
            )
        else:
            # Crea account minimale — le classi/figli vengono linkati dal seed completo
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "firebase_uid": None,
                "name": u["name"],
                "cognome": u["name"].split()[-1] if " " in u["name"] else "",
                "email": u["email"],
                "password": new_hash,
                "role": u["role"],
                "is_superadmin": False,
                "sede_id": u["sede_id"],
                "class_id": None, "class_ids": [],
                "child_id": None, "child_ids": [],
                "avatar_url": None,
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info("[DEMO] Account creato: %s (%s)", u["email"], u["role"])


async def seed_database():
    db = get_db()

    # Aggiorna/crea sempre i SuperAdmin (email + password corrette garantite)
    await ensure_superadmins()

    # Aggiorna/crea sempre gli account demo (maestre e genitori)
    # await ensure_demo_accounts()  # DISABILITATO: creava account di test in produzione ad ogni riavvio

    # NOTE (2026-06-23): _deduplicate_users()/_deduplicate_students() were REMOVED
    # from the startup path. They delete-by-heuristic on every boot — students keyed
    # on (name, class_id), users on email — and on a deploy restart silently deleted
    # 14 real student records (two children sharing a common first name in the same
    # class are NOT duplicates). Dedup must never run unattended against prod data.
    # The function definitions are retained (unused) for reference only.

    # Skip il resto del seed se i dati demo esistono già
    existing = await db.classes.find_one({})
    if existing:
        return

    logger.info("Seeding multi-tenant database...")

    now = datetime.now(timezone.utc).isoformat()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── 0. ORGS (livello organizzazione sopra le sedi) ───────────────────────
    # Solo seed fresco (dev/test). In PROD la org 1 viene creata dal backfill mongosh.
    await db.orgs.drop()
    await db.orgs.insert_one({
        "id": "girogirotondo-group",
        "name": "Gruppo Girogirotondo",
        "active": True,
        "created_at": now,
    })

    # ── 1. SEDI ──────────────────────────────────────────────────────────────

    sedi = [
        {
            "id": "girogirotondo",
            "name": "Girogirotondo",
            "color": "#4169E1",
            "indirizzo": "Via Roma 12, Napoli",
            "active": True,
            "org_id": "girogirotondo-group",
            "created_at": now,
        },
        {
            "id": "il-magico-mondo",
            "name": "Il Magico Mondo",
            "color": "#FF69B4",
            "indirizzo": "Via Nazionale 45, Napoli",
            "active": True,
            "org_id": "girogirotondo-group",
            "created_at": now,
        },
    ]

    await db.sedi.drop()
    await db.sedi.insert_many(sedi)

    # ── 2. SUPERADMIN (accesso a entrambe le sedi) ────────────────────────────

    superadmins = [
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Mariagrazia",
            "cognome": "Direttrice",
            "email": "mariucciasc@gmail.com",
            "password": hash_password("Mariagrazia2026!"),
            "role": "admin",
            "is_superadmin": True,
            "org_id": "girogirotondo-group",
            "sede_id": None,            # SuperAdmin: nessuna sede fissa
            "class_id": None,
            "class_ids": [],
            "child_id": None,
            "child_ids": [],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Teresa",
            "cognome": "Coordinatrice",
            "email": "melignanoteresa@gmail.com",
            "password": hash_password("Teresa2026!"),
            "role": "admin",
            "is_superadmin": True,
            "org_id": "girogirotondo-group",
            "sede_id": None,
            "class_id": None,
            "class_ids": [],
            "child_id": None,
            "child_ids": [],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
    ]

    # ── 3. SEDE GIROGIROTONDO ─────────────────────────────────────────────────

    SEDE_GGT = "girogirotondo"

    classes_ggt = [
        {"id": str(uuid.uuid4()), "name": "Farfalle",   "teacher_id": None, "sede_id": SEDE_GGT},
        {"id": str(uuid.uuid4()), "name": "Coccinelle", "teacher_id": None, "sede_id": SEDE_GGT},
        {"id": str(uuid.uuid4()), "name": "Apine",      "teacher_id": None, "sede_id": SEDE_GGT},
    ]

    # Admin locale sede Girogirotondo
    admin_ggt = {
        "id": str(uuid.uuid4()),
        "firebase_uid": None,
        "name": "Maria Rossi",
        "cognome": "Rossi",
        "email": "admin@girogirotondo.it",
        "password": hash_password("admin123"),
        "role": "admin",
        "is_superadmin": False,
        "sede_id": SEDE_GGT,
        "class_id": None,
        "class_ids": [],
        "child_id": None,
        "child_ids": [],
        "avatar_url": None,
        "active": True,
        "created_at": now,
    }

    teachers_ggt = [
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Giulia Bianchi",
            "cognome": "Bianchi",
            "email": "giulia@girogirotondo.it",
            "password": hash_password("teacher123"),
            "role": "teacher",
            "is_superadmin": False,
            "sede_id": SEDE_GGT,
            "class_id": classes_ggt[0]["id"],
            "class_ids": [classes_ggt[0]["id"]],
            "child_id": None,
            "child_ids": [],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Anna Verdi",
            "cognome": "Verdi",
            "email": "anna@girogirotondo.it",
            "password": hash_password("teacher123"),
            "role": "teacher",
            "is_superadmin": False,
            "sede_id": SEDE_GGT,
            "class_id": classes_ggt[1]["id"],
            "class_ids": [classes_ggt[1]["id"]],
            "child_id": None,
            "child_ids": [],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
    ]

    classes_ggt[0]["teacher_id"] = teachers_ggt[0]["id"]
    classes_ggt[1]["teacher_id"] = teachers_ggt[1]["id"]

    students_ggt = [
        {"id": str(uuid.uuid4()), "name": "Luca Marino",     "class_id": classes_ggt[0]["id"], "sede_id": SEDE_GGT, "parent_id": None, "date_of_birth": "2021-03-15", "child_code": "GGT-001", "allergies": [], "notes": ""},
        {"id": str(uuid.uuid4()), "name": "Sofia Ferrari",   "class_id": classes_ggt[0]["id"], "sede_id": SEDE_GGT, "parent_id": None, "date_of_birth": "2021-06-22", "child_code": "GGT-002", "allergies": [], "notes": ""},
        {"id": str(uuid.uuid4()), "name": "Marco Russo",     "class_id": classes_ggt[0]["id"], "sede_id": SEDE_GGT, "parent_id": None, "date_of_birth": "2021-01-10", "child_code": "GGT-003", "allergies": [], "notes": ""},
        {"id": str(uuid.uuid4()), "name": "Emma Colombo",    "class_id": classes_ggt[1]["id"], "sede_id": SEDE_GGT, "parent_id": None, "date_of_birth": "2020-11-05", "child_code": "GGT-004", "allergies": [], "notes": ""},
        {"id": str(uuid.uuid4()), "name": "Leonardo Ricci",  "class_id": classes_ggt[1]["id"], "sede_id": SEDE_GGT, "parent_id": None, "date_of_birth": "2021-08-18", "child_code": "GGT-005", "allergies": [], "notes": ""},
    ]

    parents_ggt = [
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Paolo Marino",
            "cognome": "Marino",
            "email": "paolo@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "is_superadmin": False,
            "sede_id": SEDE_GGT,
            "class_id": None,
            "class_ids": [],
            "child_id": students_ggt[0]["id"],
            "child_ids": [students_ggt[0]["id"]],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Laura Ferrari",
            "cognome": "Ferrari",
            "email": "laura@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "is_superadmin": False,
            "sede_id": SEDE_GGT,
            "class_id": None,
            "class_ids": [],
            "child_id": students_ggt[1]["id"],
            "child_ids": [students_ggt[1]["id"]],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Andrea Colombo",
            "cognome": "Colombo",
            "email": "andrea@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "is_superadmin": False,
            "sede_id": SEDE_GGT,
            "class_id": None,
            "class_ids": [],
            "child_id": students_ggt[3]["id"],
            "child_ids": [students_ggt[3]["id"]],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
    ]

    students_ggt[0]["parent_id"] = parents_ggt[0]["id"]
    students_ggt[1]["parent_id"] = parents_ggt[1]["id"]
    students_ggt[3]["parent_id"] = parents_ggt[2]["id"]

    # ── 4. SEDE IL MAGICO MONDO ───────────────────────────────────────────────

    SEDE_MM = "il-magico-mondo"

    classes_mm = [
        {"id": str(uuid.uuid4()), "name": "Stelline",    "teacher_id": None, "sede_id": SEDE_MM},
        {"id": str(uuid.uuid4()), "name": "Arcobaleno",  "teacher_id": None, "sede_id": SEDE_MM},
    ]

    teachers_mm = [
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Carla Rossi",
            "cognome": "Rossi",
            "email": "carla@magicomondo.it",
            "password": hash_password("teacher123"),
            "role": "teacher",
            "is_superadmin": False,
            "sede_id": SEDE_MM,
            "class_id": classes_mm[0]["id"],
            "class_ids": [classes_mm[0]["id"]],
            "child_id": None,
            "child_ids": [],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Marta Verde",
            "cognome": "Verde",
            "email": "marta@magicomondo.it",
            "password": hash_password("teacher123"),
            "role": "teacher",
            "is_superadmin": False,
            "sede_id": SEDE_MM,
            "class_id": classes_mm[1]["id"],
            "class_ids": [classes_mm[1]["id"]],
            "child_id": None,
            "child_ids": [],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
    ]

    classes_mm[0]["teacher_id"] = teachers_mm[0]["id"]
    classes_mm[1]["teacher_id"] = teachers_mm[1]["id"]

    students_mm = [
        {"id": str(uuid.uuid4()), "name": "Alice Fontana",    "class_id": classes_mm[0]["id"], "sede_id": SEDE_MM, "parent_id": None, "date_of_birth": "2021-05-10", "child_code": "MM-001", "allergies": [], "notes": ""},
        {"id": str(uuid.uuid4()), "name": "Beatrice Mancini", "class_id": classes_mm[1]["id"], "sede_id": SEDE_MM, "parent_id": None, "date_of_birth": "2020-09-20", "child_code": "MM-002", "allergies": [], "notes": ""},
    ]

    parents_mm = [
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Francesca Fontana",
            "cognome": "Fontana",
            "email": "francesca@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "is_superadmin": False,
            "sede_id": SEDE_MM,
            "class_id": None,
            "class_ids": [],
            "child_id": students_mm[0]["id"],
            "child_ids": [students_mm[0]["id"]],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Riccardo Mancini",
            "cognome": "Mancini",
            "email": "riccardo@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "is_superadmin": False,
            "sede_id": SEDE_MM,
            "class_id": None,
            "class_ids": [],
            "child_id": students_mm[1]["id"],
            "child_ids": [students_mm[1]["id"]],
            "avatar_url": None,
            "active": True,
            "created_at": now,
        },
    ]

    students_mm[0]["parent_id"] = parents_mm[0]["id"]
    students_mm[1]["parent_id"] = parents_mm[1]["id"]

    # ── 5. INSERT ALL USERS, CLASSES, STUDENTS ────────────────────────────────

    # I SuperAdmin (Mariagrazia e Teresa) sono già gestiti da ensure_superadmins()
    # Non li includiamo qui per evitare doppioni se il seed viene eseguito più volte
    all_users = [admin_ggt] + teachers_ggt + parents_ggt + teachers_mm + parents_mm
    all_classes = classes_ggt + classes_mm
    all_students = students_ggt + students_mm

    await db.users.drop()
    await db.classes.drop()
    await db.students.drop()
    await db.users.insert_many(all_users)
    await db.classes.insert_many(all_classes)
    await db.students.insert_many(all_students)

    # ── 6. GRIGLIA (solo GGT demo) ────────────────────────────────────────────

    griglia_entries = []
    for s in students_ggt[:3]:
        griglia_entries.append({
            "id": str(uuid.uuid4()),
            "class_id": classes_ggt[0]["id"],
            "sede_id": SEDE_GGT,
            "student_id": s["id"],
            "date": today,
            "pasta": True,
            "secondo": s["name"] != "Marco Russo",
            "pane": True,
            "frutta": s["name"] != "Marco Russo",
            "pupu": s["name"] == "Luca Marino",
            "notes": "Giornata serena" if s == students_ggt[0] else "",
            "created_at": now,
        })
    await db.griglia.drop()
    await db.griglia.insert_many(griglia_entries)

    # ── 7. DIARY ──────────────────────────────────────────────────────────────

    await db.diary.drop()
    await db.diary.insert_many([
        {
            "id": str(uuid.uuid4()),
            "class_id": classes_ggt[0]["id"],
            "sede_id": SEDE_GGT,
            "date": today,
            "summary": "Oggi abbiamo fatto attività creative con colori a tempera. I bambini hanno dipinto il loro animale preferito. Dopo la merenda abbiamo giocato in giardino.",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "class_id": classes_mm[0]["id"],
            "sede_id": SEDE_MM,
            "date": today,
            "summary": "Giornata dedicata alla musica e al ritmo. I bambini delle Stelline hanno imparato nuove canzoncine.",
            "created_at": now,
        },
    ])

    # ── 8. GALLERY ────────────────────────────────────────────────────────────

    await db.gallery.drop()
    await db.gallery.insert_many([
        {
            "id": str(uuid.uuid4()),
            "class_id": classes_ggt[0]["id"],
            "sede_id": SEDE_GGT,
            "student_ids": [students_ggt[0]["id"], students_ggt[1]["id"]],
            "media_url": "https://images.unsplash.com/photo-1627764940620-90393d0e8c34?w=600",
            "thumbnail_url": None,
            "storage_path": None,
            "media_type": "photo",
            "caption": "Attività in giardino — Girogirotondo",
            "tags": [],
            "uploaded_by": teachers_ggt[0]["id"],
            "published": True,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "class_id": classes_mm[0]["id"],
            "sede_id": SEDE_MM,
            "student_ids": [students_mm[0]["id"]],
            "media_url": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600",
            "thumbnail_url": None,
            "storage_path": None,
            "media_type": "photo",
            "caption": "Attività musicale — Il Magico Mondo",
            "tags": [],
            "uploaded_by": teachers_mm[0]["id"],
            "published": True,
            "created_at": now,
        },
    ])

    # ── 9. MEALS ─────────────────────────────────────────────────────────────

    await db.meals.drop()
    await db.meals.insert_many([
        {
            "id": str(uuid.uuid4()),
            "class_id": classes_ggt[0]["id"],
            "sede_id": SEDE_GGT,
            "date": today,
            "primo": "Pasta al pomodoro",
            "secondo": "Petto di pollo alla griglia",
            "contorno": "Carote al vapore",
            "frutta": "Mela",
            "merenda_mattina": "Crackers integrali",
            "merenda_pomeriggio": "Yogurt alla frutta",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "class_id": classes_mm[0]["id"],
            "sede_id": SEDE_MM,
            "date": today,
            "primo": "Risotto ai piselli",
            "secondo": "Pesce al forno",
            "contorno": "Fagiolini",
            "frutta": "Pera",
            "merenda_mattina": "Biscotti",
            "merenda_pomeriggio": "Succo di frutta",
            "created_at": now,
        },
    ])

    # ── 10. DOCUMENTS ─────────────────────────────────────────────────────────

    await db.documents.drop()
    await db.documents.insert_many([
        {
            "id": str(uuid.uuid4()),
            "title": "Autorizzazione Gita Scolastica",
            "description": "Modulo di autorizzazione per la gita al parco naturale.",
            "file_url": "https://example.com/docs/gita.pdf",
            "storage_path": None,
            "categoria": "autorizzazioni",
            "classe_id": classes_ggt[0]["id"],
            "sede_id": SEDE_GGT,
            "uploader_id": admin_ggt["id"],
            "scadenza": None,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Circolare N.5 — Orari Festivi",
            "description": "Comunicazione orari modificati periodo festivo — Girogirotondo.",
            "file_url": "https://example.com/docs/circolare5.pdf",
            "storage_path": None,
            "categoria": "circolari",
            "classe_id": None,
            "sede_id": SEDE_GGT,
            "uploader_id": admin_ggt["id"],
            "scadenza": None,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Informativa Privacy GDPR",
            "description": "Documento informativo sul trattamento dei dati personali — Il Magico Mondo.",
            "file_url": "https://example.com/docs/privacy.pdf",
            "storage_path": None,
            "categoria": "altro",
            "classe_id": None,
            "sede_id": SEDE_MM,
            "uploader_id": superadmins[0]["id"],
            "scadenza": None,
            "created_at": now,
        },
    ])

    # ── 11. AVVISI ────────────────────────────────────────────────────────────

    await db.avvisi.drop()
    await db.avvisi.insert_many([
        {
            "id": str(uuid.uuid4()),
            "titolo": "Riunione genitori — Girogirotondo",
            "testo": "Si comunica che la riunione genitori si terrà mercoledì 30 aprile alle ore 16:00.",
            "target": "global",
            "class_id": None,
            "sede_id": SEDE_GGT,
            "author_id": admin_ggt["id"],
            "author_name": "Maria Rossi",
            "author_role": "admin",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "titolo": "Festa di primavera — Il Magico Mondo",
            "testo": "Vi invitiamo alla festa di primavera il 10 maggio alle ore 10:00 presso la nostra sede.",
            "target": "global",
            "class_id": None,
            "sede_id": SEDE_MM,
            "author_id": superadmins[0]["id"],
            "author_name": "Mariagrazia",
            "author_role": "admin",
            "created_at": now,
        },
    ])

    # ── 12. APPOINTMENTS ──────────────────────────────────────────────────────

    await db.appointments.drop()
    await db.appointments.insert_many([
        {
            "id": str(uuid.uuid4()),
            "parent_id": parents_ggt[0]["id"],
            "parent_name": parents_ggt[0]["name"],
            "sede_id": SEDE_GGT,
            "date": (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"),
            "time_slot": "10:00",
            "reason": "Colloquio su andamento scolastico",
            "status": "confirmed",
            "created_at": now,
        },
    ])

    # ── 13. MONGODB INDEXES ───────────────────────────────────────────────────

    await db.users.create_index("firebase_uid", sparse=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("sede_id")
    await db.classes.create_index("sede_id")
    await db.students.create_index("sede_id")
    await db.students.create_index("class_id")
    await db.avvisi.create_index("sede_id")
    await db.meals.create_index("sede_id")
    await db.documents.create_index("sede_id")
    await db.push_tokens.create_index("user_id")
    await db.push_tokens.create_index("token", unique=True)
    await db.calendar_events.create_index("class_id")
    await db.calendar_events.create_index("data_inizio")

    logger.info("Multi-tenant database seeded successfully! Sedi: Girogirotondo + Il Magico Mondo")
    logger.info("SuperAdmin: mariucciasc@gmail.com / Mariagrazia2026!")
    logger.info("SuperAdmin: melignanoteresa@gmail.com / Teresa2026!")
