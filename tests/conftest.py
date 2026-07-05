"""Shared pytest fixtures for Girogirotondo API tests.

Uses an in-memory mongomock-motor database (no MongoDB server required) seeded with
a small multi-tenant dataset (two sedi, classes, students, users, media) so that
authorization / tenant-isolation behaviour can be exercised end-to-end.
"""
import os
import pytest
import pytest_asyncio
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

# Set environment variables before importing the app
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ggt_test")
os.environ.setdefault("JWT_SECRET", "test-secret-key")
os.environ.setdefault("DEV_MODE", "true")
os.environ.setdefault("FIREBASE_PROJECT_ID", "test-project")
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "test-key")
os.environ.setdefault("FIREBASE_CLIENT_EMAIL", "test@test.iam.gserviceaccount.com")
os.environ.setdefault("FIREBASE_STORAGE_BUCKET", "test.appspot.com")


# ---------------------------------------------------------------------------
# Seed ids (stable, referenced by tests)
# ---------------------------------------------------------------------------
SEDE_GGT = "girogirotondo"
SEDE_MM = "il-magico-mondo"
GGT_CLASS = "ggt-class-1"
MM_CLASS = "mm-class-1"
GGT_STUDENT = "ggt-student-1"
MM_STUDENT = "mm-student-1"

# ── Livello org (faseB-org): org 1 = Girogirotondo+MM, org 2 = Dimensione Bimbo ──
ORG1 = "girogirotondo-group"
ORG2 = "dimensione-bimbo"
SEDE_DB2 = "db-sede-1"          # id sede org 2 — DISTINTO da "dimensione-bimbo" (usato da test_sedi)
DB2_CLASS = "db-class-1"
DB2_STUDENT = "db-student-1"


@pytest.fixture(scope="session")
def mock_firebase():
    """Disable Firebase Admin so the custom-JWT path is used in tests.

    Patch the names actually referenced by middleware.auth (imported there), not
    only the source module, otherwise the imported reference stays live.
    """
    with patch("utils.firebase_client.init_firebase"), \
         patch("utils.firebase_client.is_initialized", return_value=False), \
         patch("middleware.auth.is_initialized", return_value=False):
        yield


@pytest.fixture(scope="session")
def mock_db():
    """Install an in-memory mongomock-motor client into services.database."""
    from mongomock_motor import AsyncMongoMockClient
    import services.database as dbmod
    client = AsyncMongoMockClient()
    orig_get_client = dbmod.get_client
    orig_client = dbmod._client
    dbmod._client = client
    dbmod.get_client = lambda: client
    yield client
    dbmod.get_client = orig_get_client
    dbmod._client = orig_client


@pytest_asyncio.fixture(scope="session", autouse=True)
async def seed_db(mock_db, mock_firebase):
    """Seed a minimal multi-tenant dataset into the in-memory DB."""
    import bcrypt
    db = mock_db[os.environ["DB_NAME"]]
    admin_pw_hash = bcrypt.hashpw(b"admin-pass-123", bcrypt.gensalt()).decode()

    await db.orgs.insert_many([
        {"id": ORG1, "name": "Gruppo Girogirotondo", "active": True, "created_at": "2026-01-01T00:00:00+00:00"},
        {"id": ORG2, "name": "Dimensione Bimbo",      "active": True, "created_at": "2026-06-01T00:00:00+00:00"},
    ])
    await db.sedi.insert_many([
        # org 1: stesso created_at → il default deterministico dipende dal tiebreak id
        {"id": SEDE_GGT, "name": "Girogirotondo",  "active": True, "org_id": ORG1, "created_at": "2026-01-01T00:00:00+00:00"},
        {"id": SEDE_MM,  "name": "Il Magico Mondo", "active": True, "org_id": ORG1, "created_at": "2026-01-01T00:00:00+00:00"},
        # org 2: created_at PIÙ RECENTE → non diventa mai il default globale "più vecchio"
        {"id": SEDE_DB2, "name": "Dimensione Bimbo Centro", "active": True, "org_id": ORG2, "created_at": "2026-06-01T00:00:00+00:00"},
    ])
    await db.classes.insert_many([
        {"id": GGT_CLASS, "name": "Farfalle", "sede_id": SEDE_GGT, "teacher_id": "teacher-test-id"},
        {"id": MM_CLASS, "name": "Stelline", "sede_id": SEDE_MM, "teacher_id": "mm-teacher-id"},
        {"id": DB2_CLASS, "name": "Orsetti", "sede_id": SEDE_DB2, "teacher_id": "db2-teacher-id"},
    ])
    await db.students.insert_many([
        {"id": GGT_STUDENT, "name": "Luca", "cognome": "Bianchi", "class_id": GGT_CLASS, "sede_id": SEDE_GGT, "parent_id": "parent-test-id"},
        {"id": MM_STUDENT, "name": "Alice", "cognome": "Fontana", "class_id": MM_CLASS, "sede_id": SEDE_MM, "parent_id": "mm-parent-id"},
        {"id": DB2_STUDENT, "name": "Marco", "cognome": "Rossi", "class_id": DB2_CLASS, "sede_id": SEDE_DB2, "parent_id": "db2-parent-id"},
    ])
    await db.users.insert_many([
        {"id": "admin-test-id", "role": "admin", "is_superadmin": False, "sede_id": SEDE_GGT, "org_id": ORG1, "active": True, "email": "admin@ggt.it", "password": admin_pw_hash},
        {"id": "teacher-test-id", "role": "teacher", "sede_id": SEDE_GGT, "org_id": ORG1, "class_ids": [GGT_CLASS], "active": True, "email": "t@ggt.it"},
        {"id": "parent-test-id", "role": "parent", "sede_id": SEDE_GGT, "org_id": ORG1, "child_ids": [GGT_STUDENT], "active": True, "email": "p@ggt.it"},
        {"id": "mm-teacher-id", "role": "teacher", "sede_id": SEDE_MM, "org_id": ORG1, "class_ids": [MM_CLASS], "active": True, "email": "t@mm.it"},
        {"id": "mm-parent-id", "role": "parent", "sede_id": SEDE_MM, "org_id": ORG1, "child_ids": [MM_STUDENT], "active": True, "email": "p@mm.it"},
        {"id": "super-test-id", "role": "admin", "is_superadmin": True, "sede_id": None, "org_id": ORG1, "active": True, "email": "super@ggt.it"},
        # ── Org 2 (Dimensione Bimbo) — per i test cross-org ──
        {"id": "super2-test-id", "role": "admin", "is_superadmin": True, "sede_id": None, "org_id": ORG2, "active": True, "email": "super2@db.it"},
        {"id": "db2-admin-id", "role": "admin", "is_superadmin": False, "sede_id": SEDE_DB2, "org_id": ORG2, "active": True, "email": "admin@db2.it"},
        {"id": "db2-parent-id", "role": "parent", "sede_id": SEDE_DB2, "org_id": ORG2, "child_ids": [DB2_STUDENT], "active": True, "email": "p@db2.it"},
    ])
    await db.gallery.insert_many([
        {"id": "ggt-media-1", "class_id": GGT_CLASS, "sede_id": SEDE_GGT, "student_ids": [GGT_STUDENT], "media_type": "photo", "media_url": "https://x/ggt.jpg", "published": True, "created_at": "2026-01-01T00:00:00+00:00"},
        {"id": "mm-media-1", "class_id": MM_CLASS, "sede_id": SEDE_MM, "student_ids": [MM_STUDENT], "media_type": "photo", "media_url": "https://x/mm.jpg", "published": True, "created_at": "2026-01-01T00:00:00+00:00"},
    ])
    await db.diary.insert_many([
        {"id": "ggt-diary-1", "class_id": GGT_CLASS, "sede_id": SEDE_GGT, "date": "2026-01-02", "summary": "Giornata GGT", "created_at": "2026-01-02T00:00:00+00:00"},
        {"id": "mm-diary-1", "class_id": MM_CLASS, "sede_id": SEDE_MM, "date": "2026-01-02", "summary": "Giornata MM", "created_at": "2026-01-02T00:00:00+00:00"},
    ])
    await db.documents.insert_many([
        {"id": "ggt-doc-1", "title": "Circolare GGT", "classe_id": GGT_CLASS, "sede_id": SEDE_GGT, "categoria": "circolari", "created_at": "2026-01-03T00:00:00+00:00"},
        {"id": "mm-doc-1", "title": "Circolare MM", "classe_id": MM_CLASS, "sede_id": SEDE_MM, "categoria": "circolari", "created_at": "2026-01-03T00:00:00+00:00"},
        {"id": "ggt-doc-sedewide", "title": "Avviso sede GGT", "classe_id": None, "sede_id": SEDE_GGT, "categoria": "altro", "created_at": "2026-01-03T00:00:00+00:00"},
        {"id": "mm-doc-sedewide", "title": "Avviso sede MM", "classe_id": None, "sede_id": SEDE_MM, "categoria": "altro", "created_at": "2026-01-03T00:00:00+00:00"},
    ])
    await db.calendar_events.insert_many([
        {"id": "ggt-ev-1", "titolo": "Festa GGT", "classe_id": GGT_CLASS, "sede_id": SEDE_GGT, "data_inizio": "2026-01-05", "tipo": "festa", "visibile_a": ["parent", "teacher", "admin"], "created_at": "2026-01-03T00:00:00+00:00"},
        {"id": "mm-ev-1", "titolo": "Festa MM", "classe_id": MM_CLASS, "sede_id": SEDE_MM, "data_inizio": "2026-01-05", "tipo": "festa", "visibile_a": ["parent", "teacher", "admin"], "created_at": "2026-01-03T00:00:00+00:00"},
        {"id": "ggt-ev-sedewide", "titolo": "Chiusura GGT", "classe_id": None, "sede_id": SEDE_GGT, "data_inizio": "2026-01-06", "tipo": "chiusura", "visibile_a": ["parent"], "created_at": "2026-01-03T00:00:00+00:00"},
        {"id": "mm-ev-sedewide", "titolo": "Chiusura MM", "classe_id": None, "sede_id": SEDE_MM, "data_inizio": "2026-01-06", "tipo": "chiusura", "visibile_a": ["parent"], "created_at": "2026-01-03T00:00:00+00:00"},
    ])
    yield db


@pytest_asyncio.fixture(scope="session")
async def app(mock_firebase):
    from main import app as fastapi_app
    return fastapi_app


@pytest_asyncio.fixture(scope="session")
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Auth header helpers (custom JWT via DEV_MODE)
# ---------------------------------------------------------------------------

def _make_jwt(user_id: str, role: str) -> str:
    import jwt as pyjwt
    from datetime import datetime, timezone, timedelta
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=1),
    }
    return pyjwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


def _headers(user_id: str, role: str) -> dict:
    return {"Authorization": f"Bearer {_make_jwt(user_id, role)}"}


@pytest.fixture
def admin_headers():
    return _headers("admin-test-id", "admin")


@pytest.fixture
def teacher_headers():
    return _headers("teacher-test-id", "teacher")


@pytest.fixture
def parent_headers():
    return _headers("parent-test-id", "parent")


@pytest.fixture
def mm_teacher_headers():
    return _headers("mm-teacher-id", "teacher")


@pytest.fixture
def mm_parent_headers():
    return _headers("mm-parent-id", "parent")


@pytest.fixture
def super_headers():
    return _headers("super-test-id", "admin")


@pytest.fixture
def super2_headers():
    """SuperAdmin di org 2 (Dimensione Bimbo)."""
    return _headers("super2-test-id", "admin")


@pytest.fixture
def db2_admin_headers():
    """Admin normale di org 2 (sede db-sede-1)."""
    return _headers("db2-admin-id", "admin")
