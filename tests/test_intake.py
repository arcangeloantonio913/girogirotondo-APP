"""Test del router Raccolta Iscrizioni (/api/intake)."""
import pytest
from unittest.mock import patch
from services.database import get_db


def test_models_import_and_validate():
    from models.intake import (
        IntakeTokenCreate, IntakeChild, IntakeSubmissionUpsert,
    )
    tok = IntakeTokenCreate(label="Segreteria DB")
    assert tok.label == "Segreteria DB"

    child = IntakeChild(
        nome="Alice", cognome="Grasso", data_nascita="2021-05-30",
        sede_id="db-sede-1", classe="Infanzia — Valeria",
        genitore_nome="Simona", genitore_cognome="Ferracane",
        genitore_email="mail@example.com",
    )
    assert child.nome == "Alice"

    sub = IntakeSubmissionUpsert(mode="form", children=[child], status="bozza")
    assert sub.children[0].cognome == "Grasso"


def test_child_rejects_bad_date():
    from models.intake import IntakeChild
    with pytest.raises(Exception):
        IntakeChild(
            nome="X", cognome="Y", data_nascita="2035-01-01",  # anno futuro implausibile
            sede_id="db-sede-1", classe="C",
            genitore_nome="A", genitore_cognome="B", genitore_email="a@b.it",
        )


def test_child_rejects_bad_email():
    from models.intake import IntakeChild
    with pytest.raises(Exception):
        IntakeChild(
            nome="X", cognome="Y", data_nascita="2021-01-01",
            sede_id="db-sede-1", classe="C",
            genitore_nome="A", genitore_cognome="B", genitore_email="non-una-email",
        )


@pytest.mark.asyncio
async def test_admin_creates_token_bound_to_own_org(client, super2_headers):
    db = get_db()
    try:
        r = await client.post("/api/intake/tokens", json={"label": "Segreteria DB"},
                              headers=super2_headers)
        assert r.status_code == 201
        body = r.json()
        # il token in chiaro è restituito UNA sola volta
        assert body["token"] and len(body["token"]) >= 20
        assert body["org_id"] == "dimensione-bimbo"
        # nel DB è salvato SOLO l'hash, mai il valore in chiaro
        doc = await db.intake_tokens.find_one({"id": body["id"]})
        assert "token" not in doc and doc["token_hash"] != body["token"]
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_non_admin_cannot_create_token(client, parent_headers):
    r = await client.post("/api/intake/tokens", json={"label": "x"}, headers=parent_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_list_and_revoke_token(client, super2_headers):
    db = get_db()
    try:
        c = await client.post("/api/intake/tokens", json={"label": "T"}, headers=super2_headers)
        tid = c.json()["id"]
        lst = await client.get("/api/intake/tokens", headers=super2_headers)
        assert lst.status_code == 200
        assert any(t["id"] == tid for t in lst.json())
        # la lista NON espone token/token_hash
        assert all("token" not in t and "token_hash" not in t for t in lst.json())
        d = await client.delete(f"/api/intake/tokens/{tid}", headers=super2_headers)
        assert d.status_code == 200
        doc = await db.intake_tokens.find_one({"id": tid})
        assert doc["active"] is False
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})
