"""Iscrizioni: niente account genitore doppi né email di credenziali partite per sbaglio."""
import pytest
from unittest.mock import patch, AsyncMock

from services.database import get_db
from tests.conftest import GGT_CLASS, GGT_STUDENT, SEDE_GGT


def _iscr(nome, cognome, email):
    return {"bambino_nome": nome, "bambino_cognome": cognome, "class_id": GGT_CLASS,
            "sede_id": SEDE_GGT, "genitore_email": email}


@pytest.mark.asyncio
async def test_email_with_capitals_reuses_existing_parent(client, admin_headers):
    """'P@GGT.it ' è lo stesso genitore di 'p@ggt.it': fratello aggiunto, nessuna email."""
    db = get_db()
    before = await db.users.count_documents({})
    with patch("routers.users.send_credentials_email", new_callable=AsyncMock, return_value=True) as m:
        r = await client.post("/api/users/iscrizione", json=_iscr("Sara", "Bianchi", " P@GGT.it "),
                              headers=admin_headers)
    try:
        assert r.status_code == 201, r.text
        assert r.json()["sibling_added"] is True
        assert r.json()["parent"]["id"] == "parent-test-id"
        assert await db.users.count_documents({}) == before
        m.assert_not_called()
    finally:
        sid = r.json().get("student", {}).get("id")
        await db.students.delete_one({"id": sid})
        await db.users.update_one({"id": "parent-test-id"},
                                  {"$pull": {"child_ids": sid}, "$set": {"child_id": GGT_STUDENT}})


@pytest.mark.asyncio
async def test_new_parent_email_is_stored_lowercase(client, admin_headers):
    db = get_db()
    with patch("routers.users.send_credentials_email", new_callable=AsyncMock, return_value=True):
        r = await client.post("/api/users/iscrizione", json=_iscr("Nuovo", "Lowercase", "Mario.Rossi@Fam.IT"),
                              headers=admin_headers)
    try:
        assert r.status_code == 201, r.text
        assert r.json()["genitore_email"] == "mario.rossi@fam.it"
        assert await db.users.find_one({"email": "mario.rossi@fam.it"})
    finally:
        await db.users.delete_one({"email": "mario.rossi@fam.it"})
        await db.students.delete_many({"cognome": "Lowercase"})


@pytest.mark.asyncio
async def test_child_already_enrolled_is_rejected_without_email(client, admin_headers):
    """Luca Bianchi è già iscritto: nessun doppione, nessun account, nessuna email."""
    db = get_db()
    users_before = await db.users.count_documents({})
    students_before = await db.students.count_documents({})
    with patch("routers.users.send_credentials_email", new_callable=AsyncMock, return_value=True) as m:
        r = await client.post("/api/users/iscrizione", json=_iscr("luca", "BIANCHI", "altro@fam.it"),
                              headers=admin_headers)
    assert r.status_code == 409
    assert await db.users.count_documents({}) == users_before
    assert await db.students.count_documents({}) == students_before
    m.assert_not_called()


@pytest.mark.asyncio
async def test_secondo_genitore_respects_skip_email(client, admin_headers):
    db = get_db()
    with patch("routers.users.send_credentials_email", new_callable=AsyncMock, return_value=True) as m:
        r = await client.post("/api/users/secondo-genitore",
                              json={"student_id": GGT_STUDENT, "genitore_email": "skip@fam.it", "skip_email": True},
                              headers=admin_headers)
    try:
        assert r.status_code == 201, r.text
        assert r.json()["email_inviata"] is False
        m.assert_not_called()
    finally:
        await db.users.delete_one({"email": "skip@fam.it"})
