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
        # Only enable TLS for Atlas (mongodb+srv://) connections.
        # Railway-internal connections use plain TCP — no TLS needed.
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


async def seed_database():
    db = get_db()
    existing = await db.users.find_one({"role": "admin"})
    if existing:
        return

    logger.info("Seeding database...")

    classes = [
        {"id": str(uuid.uuid4()), "name": "Farfalle", "teacher_id": None},
        {"id": str(uuid.uuid4()), "name": "Coccinelle", "teacher_id": None},
        {"id": str(uuid.uuid4()), "name": "Apine", "teacher_id": None},
    ]

    admin = {
        "id": str(uuid.uuid4()),
        "firebase_uid": None,
        "name": "Maria Rossi",
        "cognome": "Rossi",
        "email": "admin@girogirotondo.it",
        "password": hash_password("admin123"),
        "role": "admin",
        "class_id": None,
        "child_id": None,
        "avatar_url": None,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    teachers = [
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Giulia Bianchi",
            "cognome": "Bianchi",
            "email": "giulia@girogirotondo.it",
            "password": hash_password("teacher123"),
            "role": "teacher",
            "class_id": classes[0]["id"],
            "child_id": None,
            "avatar_url": None,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Anna Verdi",
            "cognome": "Verdi",
            "email": "anna@girogirotondo.it",
            "password": hash_password("teacher123"),
            "role": "teacher",
            "class_id": classes[1]["id"],
            "child_id": None,
            "avatar_url": None,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    classes[0]["teacher_id"] = teachers[0]["id"]
    classes[1]["teacher_id"] = teachers[1]["id"]

    students = [
        {"id": str(uuid.uuid4()), "name": "Luca Marino", "class_id": classes[0]["id"], "parent_id": None, "date_of_birth": "2021-03-15", "child_code": "GGT-001"},
        {"id": str(uuid.uuid4()), "name": "Sofia Ferrari", "class_id": classes[0]["id"], "parent_id": None, "date_of_birth": "2021-06-22", "child_code": "GGT-002"},
        {"id": str(uuid.uuid4()), "name": "Marco Russo", "class_id": classes[0]["id"], "parent_id": None, "date_of_birth": "2021-01-10", "child_code": "GGT-003"},
        {"id": str(uuid.uuid4()), "name": "Emma Colombo", "class_id": classes[1]["id"], "parent_id": None, "date_of_birth": "2020-11-05", "child_code": "GGT-004"},
        {"id": str(uuid.uuid4()), "name": "Leonardo Ricci", "class_id": classes[1]["id"], "parent_id": None, "date_of_birth": "2021-08-18", "child_code": "GGT-005"},
    ]

    parents = [
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Paolo Marino",
            "cognome": "Marino",
            "email": "paolo@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "class_id": classes[0]["id"],
            "child_id": students[0]["id"],
            "avatar_url": None,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Laura Ferrari",
            "cognome": "Ferrari",
            "email": "laura@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "class_id": classes[0]["id"],
            "child_id": students[1]["id"],
            "avatar_url": None,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": "Andrea Colombo",
            "cognome": "Colombo",
            "email": "andrea@famiglia.it",
            "password": hash_password("parent123"),
            "role": "parent",
            "class_id": classes[1]["id"],
            "child_id": students[3]["id"],
            "avatar_url": None,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    students[0]["parent_id"] = parents[0]["id"]
    students[1]["parent_id"] = parents[1]["id"]
    students[3]["parent_id"] = parents[2]["id"]

    await db.users.insert_many([admin] + teachers + parents)
    await db.classes.insert_many(classes)
    await db.students.insert_many(students)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    griglia_entries = []
    for s in students[:3]:
        griglia_entries.append({
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "student_id": s["id"],
            "date": today,
            "colazione": True,
            "pranzo": True,
            "frutta": s["name"] != "Marco Russo",
            "merenda": True,
            "cacca": s["name"] == "Luca Marino",
            "pisolino": s["name"] != "Marco Russo",
            "notes": "Giornata serena" if s == students[0] else "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.griglia.insert_many(griglia_entries)

    await db.diary.insert_many([
        {
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "date": today,
            "summary": "Oggi abbiamo fatto attività creative con colori a tempera. I bambini hanno dipinto il loro animale preferito. Dopo la merenda abbiamo giocato in giardino.",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ])

    gallery_items = [
        {
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "student_ids": [students[0]["id"], students[1]["id"]],
            "media_url": "https://images.unsplash.com/photo-1627764940620-90393d0e8c34?w=600",
            "thumbnail_url": None,
            "storage_path": None,
            "media_type": "photo",
            "caption": "Attività in giardino",
            "tags": [],
            "uploaded_by": teachers[0]["id"],
            "published": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    await db.gallery.insert_many(gallery_items)

    await db.meals.insert_many([
        {
            "id": str(uuid.uuid4()),
            "class_id": classes[0]["id"],
            "date": today,
            "primo": "Pasta al pomodoro",
            "secondo": "Petto di pollo alla griglia",
            "contorno": "Carote al vapore",
            "frutta": "Mela",
            "merenda_mattina": "Crackers integrali",
            "merenda_pomeriggio": "Yogurt alla frutta",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ])

    await db.documents.insert_many([
        {
            "id": str(uuid.uuid4()),
            "title": "Autorizzazione Gita Scolastica",
            "description": "Modulo di autorizzazione per la gita al parco naturale.",
            "file_url": "https://example.com/docs/gita.pdf",
            "storage_path": None,
            "categoria": "autorizzazioni",
            "classe_id": classes[0]["id"],
            "uploader_id": admin["id"],
            "scadenza": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Circolare N.5 - Orari Festivi",
            "description": "Comunicazione degli orari modificati durante il periodo festivo.",
            "file_url": "https://example.com/docs/circolare5.pdf",
            "storage_path": None,
            "categoria": "circolari",
            "classe_id": None,
            "uploader_id": admin["id"],
            "scadenza": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Informativa Privacy GDPR",
            "description": "Documento informativo sul trattamento dei dati personali.",
            "file_url": "https://example.com/docs/privacy.pdf",
            "storage_path": None,
            "categoria": "altro",
            "classe_id": None,
            "uploader_id": admin["id"],
            "scadenza": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ])

    await db.appointments.insert_many([
        {
            "id": str(uuid.uuid4()),
            "parent_id": parents[0]["id"],
            "parent_name": parents[0]["name"],
            "date": (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"),
            "time_slot": "10:00",
            "reason": "Colloquio su andamento scolastico",
            "status": "confirmed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ])

    # Create MongoDB indexes
    await db.users.create_index("firebase_uid", sparse=True)
    await db.users.create_index("email", unique=True)
    await db.push_tokens.create_index("user_id")
    await db.push_tokens.create_index("token", unique=True)
    await db.calendar_events.create_index("class_id")
    await db.calendar_events.create_index("data_inizio")

    logger.info("Database seeded successfully!")
