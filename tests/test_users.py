"""Tests for /api/users endpoints."""
import json as _json
import pytest
import bcrypt
from unittest.mock import patch, AsyncMock

from services.database import get_db
from middleware.rate_limiter import limiter


@pytest.mark.asyncio
async def test_get_users_admin_only(client, parent_headers):
    r = await client.get("/api/users", headers=parent_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_get_users_as_admin(client, admin_headers):
    r = await client.get("/api/users", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_get_user_by_id(client, admin_headers):
    users = (await client.get("/api/users", headers=admin_headers)).json()
    if not users:
        pytest.skip("No users seeded")
    uid = users[0]["id"]
    r = await client.get(f"/api/users/{uid}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["id"] == uid


@pytest.mark.asyncio
async def test_update_user(client, admin_headers):
    users = (await client.get("/api/users", headers=admin_headers)).json()
    if not users:
        pytest.skip("No users seeded")
    uid = users[0]["id"]
    r = await client.put(f"/api/users/{uid}", json={"avatar_url": "https://example.com/avatar.png"}, headers=admin_headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_soft_delete_user(client, admin_headers):
    # Create a temporary user then soft-delete
    r = await client.post(
        "/api/users",
        json={"name": "Temp User", "email": "temp@test.it", "password": "pass123", "role": "parent"},
        headers=admin_headers,
    )
    assert r.status_code == 201
    uid = r.json()["id"]

    rd = await client.delete(f"/api/users/{uid}", headers=admin_headers)
    assert rd.status_code == 200

    # User should not appear in auth anymore (active=False)
    r2 = await client.get(f"/api/users/{uid}", headers=admin_headers)
    # active=False users are still retrievable by admin
    assert r2.status_code in (200, 404)


# ---------------------------------------------------------------------------
# FASE 0 — Item 1: admin_password (plaintext) mai esposto né persistito
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_admin_password_in_user_responses(client, admin_headers):
    db = get_db()
    await db.users.insert_one({
        "id": "leak-ggt", "role": "parent", "sede_id": "girogirotondo",
        "class_id": "ggt-class-1", "email": "leak@ggt.it", "active": True,
        "child_ids": [], "password": bcrypt.hashpw(b"x", bcrypt.gensalt()).decode(),
        "admin_password": "PLAINTEXT-LEAK",   # stato pre-fix nel DB
    })
    try:
        r = await client.get("/api/users", headers=admin_headers)
        assert r.status_code == 200
        assert all("admin_password" not in u for u in r.json())
        r = await client.get("/api/users/leak-ggt", headers=admin_headers)
        assert r.status_code == 200 and "admin_password" not in r.json()
        r = await client.put("/api/users/leak-ggt", json={"name": "X"}, headers=admin_headers)
        assert r.status_code == 200 and "admin_password" not in r.json()
        r = await client.get("/api/users/by-class/ggt-class-1", headers=admin_headers)
        assert r.status_code == 200 and all("admin_password" not in u for u in r.json())
    finally:
        await db.users.delete_one({"id": "leak-ggt"})


@pytest.mark.asyncio
async def test_me_never_exposes_admin_password(client):
    db = get_db()
    await db.users.insert_one({
        "id": "me-leak", "role": "parent", "sede_id": "girogirotondo",
        "email": "meleak@ggt.it", "active": True, "child_ids": [],
        "password": bcrypt.hashpw(b"x", bcrypt.gensalt()).decode(),
        "admin_password": "PLAINTEXT-ME",
    })
    import jwt as pyjwt
    from datetime import datetime, timezone, timedelta
    import os
    tok = pyjwt.encode({"user_id": "me-leak", "role": "parent",
                        "exp": datetime.now(timezone.utc) + timedelta(days=1)},
                       os.environ["JWT_SECRET"], algorithm="HS256")
    try:
        r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200 and "admin_password" not in r.json()
    finally:
        await db.users.delete_one({"id": "me-leak"})


@pytest.mark.asyncio
async def test_create_user_never_stores_admin_password(client, admin_headers):
    r = await client.post("/api/users",
        json={"name": "N", "email": "noap@ggt.it", "password": "pass123", "role": "parent"},
        headers=admin_headers)
    assert r.status_code == 201
    assert "admin_password" not in r.json()
    db = get_db()
    doc = await db.users.find_one({"email": "noap@ggt.it"})
    assert doc is not None and "admin_password" not in doc
    await db.users.delete_one({"email": "noap@ggt.it"})


@pytest.mark.asyncio
async def test_iscrizione_never_stores_admin_password(client, admin_headers):
    with patch("routers.users.send_credentials_email", new_callable=AsyncMock, return_value=True):
        r = await client.post("/api/users/iscrizione",
            json={"bambino_nome": "Bimbo", "bambino_cognome": "TestX", "class_id": "ggt-class-1",
                  "sede_id": "girogirotondo", "genitore_email": "nuovogen@fam.it",
                  "genitore_password": "pass123"},
            headers=admin_headers)
    assert r.status_code == 201
    assert "admin_password" not in _json.dumps(r.json())
    db = get_db()
    doc = await db.users.find_one({"email": "nuovogen@fam.it"})
    assert doc is not None and "admin_password" not in doc
    await db.users.delete_one({"email": "nuovogen@fam.it"})
    await db.students.delete_many({"name": "Bimbo", "cognome": "TestX"})


@pytest.mark.asyncio
async def test_login_ok_after_admin_password_unset(client):
    db = get_db()
    pw = bcrypt.hashpw(b"famiglia123", bcrypt.gensalt()).decode()
    await db.users.insert_one({
        "id": "login-mig", "role": "parent", "sede_id": "girogirotondo",
        "email": "loginmig@fam.it", "active": True, "child_ids": [],
        "password": pw, "admin_password": "famiglia123",
    })
    limiter.enabled = False
    try:
        # login OK anche con admin_password presente — e la risposta NON lo espone
        r = await client.post("/api/auth/login",
                              json={"email": "loginmig@fam.it", "password": "famiglia123"})
        assert r.status_code == 200
        assert "admin_password" not in r.json().get("user", {})
        # simula la migrazione $unset di admin_password
        await db.users.update_one({"id": "login-mig"}, {"$unset": {"admin_password": ""}})
        # login ANCORA valido (password bcrypt intatta → nessun lockout)
        r2 = await client.post("/api/auth/login",
                               json={"email": "loginmig@fam.it", "password": "famiglia123"})
        assert r2.status_code == 200
        assert "admin_password" not in r2.json().get("user", {})
    finally:
        limiter.enabled = True
        await db.users.delete_one({"id": "login-mig"})


# ---------------------------------------------------------------------------
# FASE 0 — Item 2: un genitore NON può fare privilege-escalation via PUT self
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_parent_cannot_escalate_privileged_fields_on_self(client, parent_headers):
    db = get_db()
    before = await db.users.find_one({"id": "parent-test-id"})
    r = await client.put("/api/users/parent-test-id",
        json={"name": "Papa Demo", "child_ids": ["mm-student-1"],
              "sede_id": "il-magico-mondo", "class_ids": ["mm-class-1"]},
        headers=parent_headers)
    assert r.status_code == 200
    after = await db.users.find_one({"id": "parent-test-id"})
    assert after.get("child_ids") == before.get("child_ids")   # figli NON cambiati
    assert after.get("sede_id") == before.get("sede_id")        # sede NON cambiata
    assert after.get("class_ids") == before.get("class_ids")    # classi NON cambiate
    assert after.get("name") == "Papa Demo"                     # solo il campo lecito applicato


@pytest.mark.asyncio
async def test_parent_privileged_only_payload_rejected(client, parent_headers):
    r = await client.put("/api/users/parent-test-id",
        json={"child_ids": ["mm-student-1"]}, headers=parent_headers)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_admin_can_still_set_privileged_fields(client, admin_headers):
    db = get_db()
    await db.users.insert_one({"id": "ggt-p2", "role": "parent", "sede_id": "girogirotondo",
                               "email": "ggtp2@fam.it", "active": True, "child_ids": []})
    try:
        r = await client.put("/api/users/ggt-p2", json={"child_ids": ["ggt-student-1"]},
                             headers=admin_headers)
        assert r.status_code == 200
        doc = await db.users.find_one({"id": "ggt-p2"})
        assert doc.get("child_ids") == ["ggt-student-1"]
    finally:
        await db.users.delete_one({"id": "ggt-p2"})


# ---------------------------------------------------------------------------
# FASE 0 — Item 3: credentials/resend con enforcement di sede
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_cannot_reset_credentials_cross_sede(client, admin_headers):
    # admin GGT -> utente Il Magico Mondo
    r = await client.put("/api/users/mm-parent-id/credentials",
        json={"password": "newpass1"}, headers=admin_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_resend_cross_sede(client, admin_headers):
    r = await client.post("/api/users/mm-parent-id/resend-credentials",
        json={}, headers=admin_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_superadmin_can_resend_cross_sede_and_keeps_new_password(client, super_headers):
    with patch("routers.users.send_resend_credentials_email", new_callable=AsyncMock, return_value=True):
        r = await client.post("/api/users/mm-parent-id/resend-credentials",
            json={"password": "SuperNew1!"}, headers=super_headers)
    assert r.status_code == 200
    body = r.json()
    assert body.get("new_password") == "SuperNew1!"   # mantenuto (mostrato una volta)
    assert "admin_password" not in body


@pytest.mark.asyncio
async def test_admin_can_reset_credentials_same_sede(client, admin_headers):
    db = get_db()
    await db.users.insert_one({"id": "ggt-cred", "role": "parent", "sede_id": "girogirotondo",
        "email": "ggtcred@fam.it", "active": True, "child_ids": [],
        "password": bcrypt.hashpw(b"old", bcrypt.gensalt()).decode()})
    try:
        r = await client.put("/api/users/ggt-cred/credentials",
            json={"password": "brandnew1"}, headers=admin_headers)
        assert r.status_code == 200
        assert "admin_password" not in r.json()
        doc = await db.users.find_one({"id": "ggt-cred"})
        assert "admin_password" not in doc
    finally:
        await db.users.delete_one({"id": "ggt-cred"})
