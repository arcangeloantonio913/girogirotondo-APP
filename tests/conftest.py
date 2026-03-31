"""Shared pytest fixtures for Girogirotondo API tests."""
import asyncio
import os
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock, MagicMock

# Set environment variables before importing the app
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ggt_test")
os.environ.setdefault("JWT_SECRET", "test-secret-key")
os.environ.setdefault("DEV_MODE", "true")
os.environ.setdefault("FIREBASE_PROJECT_ID", "test-project")
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "test-key")
os.environ.setdefault("FIREBASE_CLIENT_EMAIL", "test@test.iam.gserviceaccount.com")
os.environ.setdefault("FIREBASE_STORAGE_BUCKET", "test.appspot.com")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def mock_firebase():
    """Disable Firebase Admin so tests run without real credentials."""
    with patch("utils.firebase_client.init_firebase"), \
         patch("utils.firebase_client.is_initialized", return_value=False):
        yield


@pytest.fixture(scope="session")
async def app(mock_firebase):
    from main import app as fastapi_app
    return fastapi_app


@pytest.fixture(scope="session")
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Helper: get auth headers for a given role (uses legacy JWT via DEV_MODE)
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


@pytest.fixture
def admin_headers():
    return {"Authorization": f"Bearer {_make_jwt('admin-test-id', 'admin')}"}


@pytest.fixture
def teacher_headers():
    return {"Authorization": f"Bearer {_make_jwt('teacher-test-id', 'teacher')}"}


@pytest.fixture
def parent_headers():
    return {"Authorization": f"Bearer {_make_jwt('parent-test-id', 'parent')}"}
