"""Regressione sicurezza multi-tenant (dati di MINORI).

Ogni test qui FALLIREBBE sul codice pre-fix: coprono le falle chiuse di isolamento
sede/tenant e di forgiabilità delle ricevute di lettura.
Seed di riferimento (vedi conftest):
  admin-test-id  -> admin org1, sede girogirotondo
  parent-test-id -> parent org1, figlio ggt-student-1 (sede girogirotondo)
  mm-parent-id / mm-student-1 / mm-class-1 / mm-teacher-id -> sede il-magico-mondo
"""
import pytest
from unittest.mock import patch, AsyncMock

from services.database import get_db
from middleware.rate_limiter import limiter


# ---------------------------------------------------------------------------
# 1) Registrazione pubblica: NON collega mai a un minore (child_id/class_id/sede)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_public_register_ignores_child_and_class(client):
    limiter.enabled = False
    db = get_db()
    try:
        r = await client.post("/api/auth/register", json={
            "email": "attacker@evil.it", "password": "pass123",
            "name": "Mario", "cognome": "Rossi", "role": "parent",
            # tentativo di auto-collegarsi a un minore esistente
            "child_id": "ggt-student-1", "class_id": "ggt-class-1",
            "sede_id": "girogirotondo",
        })
        assert r.status_code == 201
        body = r.json()
        assert body.get("child_id") in (None, [])
        assert body.get("class_id") in (None, [])
        assert body.get("sede_id") is None
        doc = await db.users.find_one({"email": "attacker@evil.it"})
        assert doc.get("child_id") in (None, [])
        assert doc.get("child_ids") in (None, [])
        assert doc.get("class_id") in (None, [])
    finally:
        limiter.enabled = True
        await db.users.delete_one({"email": "attacker@evil.it"})


# ---------------------------------------------------------------------------
# 2) update_user cross-sede vietato all'admin normale
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_cannot_update_user_cross_sede(client, admin_headers):
    r = await client.put("/api/users/mm-parent-id",
        json={"name": "Hacked"}, headers=admin_headers)
    assert r.status_code == 403
    doc = await get_db().users.find_one({"id": "mm-parent-id"})
    assert doc.get("name") != "Hacked"


@pytest.mark.asyncio
async def test_admin_cannot_assign_foreign_child_via_update(client, admin_headers):
    # ggt-p3 è nella sede dell'admin, ma mm-student-1 è di un'altra sede -> 404
    db = get_db()
    await db.users.insert_one({"id": "ggt-p3", "role": "parent", "sede_id": "girogirotondo",
                               "email": "ggtp3@fam.it", "active": True, "child_ids": []})
    try:
        r = await client.put("/api/users/ggt-p3",
            json={"child_ids": ["mm-student-1"]}, headers=admin_headers)
        assert r.status_code == 404
        doc = await db.users.find_one({"id": "ggt-p3"})
        assert doc.get("child_ids") == []
    finally:
        await db.users.delete_one({"id": "ggt-p3"})


# ---------------------------------------------------------------------------
# 3) secondo-genitore su bambino di un'altra sede -> 404
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_cannot_add_second_parent_cross_sede(client, admin_headers):
    r = await client.post("/api/users/secondo-genitore",
        json={"student_id": "mm-student-1", "genitore_email": "grab@evil.it"},
        headers=admin_headers)
    assert r.status_code == 404
    assert await get_db().users.find_one({"email": "grab@evil.it"}) is None


# ---------------------------------------------------------------------------
# 4) get_user / by-class cross-sede -> 404 (no disclosure PII)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_cannot_read_user_cross_sede(client, admin_headers):
    r = await client.get("/api/users/mm-parent-id", headers=admin_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_admin_cannot_read_class_roster_cross_sede(client, admin_headers):
    r = await client.get("/api/users/by-class/mm-class-1", headers=admin_headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 5) update_user_email cross-sede -> 403 (blocca account takeover)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_cannot_change_email_cross_sede(client, admin_headers):
    r = await client.patch("/api/users/mm-parent-id/email",
        json={"email": "takeover@evil.it"}, headers=admin_headers)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# 6) create_user: l'admin normale non può creare fuori dalla propria sede
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_user_forces_admin_sede(client, admin_headers):
    db = get_db()
    r = await client.post("/api/users",
        json={"name": "N", "email": "forcedsede@ggt.it", "password": "pass123",
              "role": "parent", "sede_id": "il-magico-mondo"},
        headers=admin_headers)
    assert r.status_code == 201
    try:
        assert r.json()["sede_id"] == "girogirotondo"   # payload ignorato
    finally:
        await db.users.delete_one({"email": "forcedsede@ggt.it"})


# ---------------------------------------------------------------------------
# 7) Ricevute di lettura: il parent_id è forzato dal token (no forgery)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_read_receipt_parent_id_forced_from_token(client, parent_headers):
    db = get_db()
    r = await client.post("/api/read-receipts",
        json={"document_id": "ggt-doc-1", "parent_id": "mm-parent-id"},  # tentativo forgery
        headers=parent_headers)
    assert r.status_code in (200, 201)
    assert r.json()["parent_id"] == "parent-test-id"
    # nessuna ricevuta creata a nome di mm-parent-id per questo doc
    forged = await db.read_receipts.find_one({"document_id": "ggt-doc-1", "parent_id": "mm-parent-id"})
    assert forged is None
    await db.read_receipts.delete_many({"document_id": "ggt-doc-1", "parent_id": "parent-test-id"})


@pytest.mark.asyncio
async def test_read_receipt_cross_tenant_document_404(client, parent_headers):
    # doc di un'altra sede -> il parent non può marcarlo letto
    r = await client.post("/api/read-receipts",
        json={"document_id": "mm-doc-1", "parent_id": "parent-test-id"},
        headers=parent_headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 8) update_class: maestra di un'altra sede non assegnabile
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_class_rejects_foreign_teacher(client, admin_headers):
    r = await client.patch("/api/classes/ggt-class-1",
        json={"teacher_id": "mm-teacher-id"}, headers=admin_headers)
    assert r.status_code == 400
    cls = await get_db().classes.find_one({"id": "ggt-class-1"})
    assert cls.get("teacher_id") != "mm-teacher-id"


# ---------------------------------------------------------------------------
# 9) Push evento di sede: scopata alla sede (niente leak cross-tenant)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_calendar_sede_event_push_scoped_to_sede(client, admin_headers):
    with patch("routers.calendar.notify_role_sede", new_callable=AsyncMock) as mock_notify:
        r = await client.post("/api/calendar/events", json={
            "titolo": "Chiusura sede", "tipo": "chiusura",
            "data_inizio": "2026-03-01", "visibile_a": ["parent"],
        }, headers=admin_headers)
        assert r.status_code == 201
        mock_notify.assert_awaited()
        # la sede passata alla notifica è quella dell'admin, non globale
        args = mock_notify.await_args.args
        assert "girogirotondo" in args
    await get_db().calendar_events.delete_many({"titolo": "Chiusura sede"})
