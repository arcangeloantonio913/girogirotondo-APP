"""FASE A — provisioning multi-tenant: VALID_SEDE_IDS data-driven + POST/PUT /api/sedi."""
import os
import pytest
import jwt as pyjwt
from datetime import datetime, timezone, timedelta

from services.database import get_db


def _hdr(user_id: str, role: str) -> dict:
    tok = pyjwt.encode(
        {"user_id": user_id, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=1)},
        os.environ["JWT_SECRET"], algorithm="HS256",
    )
    return {"Authorization": f"Bearer {tok}"}


@pytest.mark.asyncio
async def test_superadmin_can_create_sede(client, super_headers):
    db = get_db()
    try:
        r = await client.post("/api/sedi", json={
            "id": "dimensione-bimbo", "name": "Dimensione Bimbo",
            "color": "#00AA88", "indirizzo": "Via Test 1",
        }, headers=super_headers)
        assert r.status_code == 201
        assert r.json()["id"] == "dimensione-bimbo"
        assert r.json()["active"] is True
    finally:
        await db.sedi.delete_many({"id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_new_sede_immediately_valid_no_restart(client, super_headers):
    """La sede creata è valida SUBITO: un admin di quella sede opera senza restart."""
    db = get_db()
    try:
        r = await client.post("/api/sedi", json={"id": "nuova-scuola", "name": "Nuova Scuola"},
                              headers=super_headers)
        assert r.status_code == 201
        await db.users.insert_one({
            "id": "admin-nuova", "role": "admin", "is_superadmin": False,
            "sede_id": "nuova-scuola", "email": "admin@nuova.it", "active": True,
        })
        # Prima della FASE A questo era 400 "Sede non valida"; ora 200.
        rr = await client.get("/api/users",
                              headers={**_hdr("admin-nuova", "admin"), "X-Sede-Id": "nuova-scuola"})
        assert rr.status_code == 200
    finally:
        await db.users.delete_many({"id": "admin-nuova"})
        await db.sedi.delete_many({"id": "nuova-scuola"})


@pytest.mark.asyncio
async def test_non_superadmin_cannot_create_sede(client, admin_headers):
    r = await client.post("/api/sedi", json={"id": "hack-sede", "name": "Hack"}, headers=admin_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_slug_rejected(client, super_headers):
    r = await client.post("/api/sedi", json={"id": "girogirotondo", "name": "Dup"}, headers=super_headers)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_malformed_slug_rejected(client, super_headers):
    r = await client.post("/api/sedi", json={"id": "Foo Bar!", "name": "X"}, headers=super_headers)
    assert r.status_code == 422   # errore di validazione pydantic


@pytest.mark.asyncio
async def test_existing_two_sedi_still_work(client, admin_headers, parent_headers):
    # admin GGT opera come prima
    r = await client.get("/api/users", headers=admin_headers)
    assert r.status_code == 200
    # le 2 sedi storiche restano visibili
    rs = await client.get("/api/sedi", headers=parent_headers)
    assert rs.status_code == 200
    ids = {s["id"] for s in rs.json()}
    assert {"girogirotondo", "il-magico-mondo"} <= ids


@pytest.mark.asyncio
async def test_inactive_sede_rejected_soft_delete(client, super_headers):
    """PUT active=False = soft-delete → la sede esce da VALID_SEDE_IDS (400)."""
    db = get_db()
    try:
        assert (await client.post("/api/sedi", json={"id": "sede-spenta", "name": "Spenta"},
                                  headers=super_headers)).status_code == 201
        rp = await client.put("/api/sedi/sede-spenta", json={"active": False}, headers=super_headers)
        assert rp.status_code == 200 and rp.json()["active"] is False
        await db.users.insert_one({
            "id": "admin-spenta", "role": "admin", "is_superadmin": False,
            "sede_id": "sede-spenta", "email": "a@spenta.it", "active": True,
        })
        rr = await client.get("/api/users",
                              headers={**_hdr("admin-spenta", "admin"), "X-Sede-Id": "sede-spenta"})
        assert rr.status_code == 400   # sede non attiva → non valida
    finally:
        await db.users.delete_many({"id": "admin-spenta"})
        await db.sedi.delete_many({"id": "sede-spenta"})


@pytest.mark.asyncio
async def test_superadmin_without_header_defaults_to_active_sede(client, super_headers):
    """Fallback data-driven (prima sede active), NON 400 — e il default è DETERMINISTICO
    (girogirotondo): la risposta è scoping-ata su quella sede, non sull'altra."""
    r = await client.get("/api/users", headers=super_headers)   # nessun X-Sede-Id
    assert r.status_code == 200
    ids = {u["id"] for u in r.json()}
    assert "parent-test-id" in ids       # utente sede girogirotondo → default risolto a GGT
    assert "mm-parent-id" not in ids     # NON sede il-magico-mondo


@pytest.mark.asyncio
async def test_default_sede_is_deterministic_oldest(client):
    """get_default_sede_id: sede attiva più vecchia (created_at asc, tiebreak id).
    Il secondo assert è DISCRIMINANTE: una sede con created_at più vecchio, ma inserita
    DOPO, diventa il default → con l'implementazione senza sort (ordine d'inserimento)
    questo fallirebbe."""
    from middleware.auth import get_default_sede_id
    db = get_db()
    # 2 sedi con stesso created_at → tiebreak id → girogirotondo (deterministico)
    assert await get_default_sede_id(db) == "girogirotondo"

    # SCENARIO REALE "3+ sedi": aggiunta di "Dimensione Bimbo" (sede NUOVA, created_at
    # recente). Con 3 sedi attive il default resta la più vecchia → girogirotondo.
    await db.sedi.insert_one({"id": "dimensione-bimbo", "name": "Dimensione Bimbo", "active": True,
                              "created_at": "2027-01-01T00:00:00+00:00"})
    try:
        assert await get_default_sede_id(db) == "girogirotondo"   # NON la sede nuova
    finally:
        await db.sedi.delete_many({"id": "dimensione-bimbo"})

    # Assert DISCRIMINANTE: una sede con created_at PIÙ VECCHIO inserita DOPO diventa il
    # default (ordine per created_at, non per ordine naturale/inserimento) → con
    # l'implementazione senza sort questo fallirebbe.
    await db.sedi.insert_one({"id": "zzz-storica", "name": "Storica", "active": True,
                              "created_at": "2020-01-01T00:00:00+00:00"})
    try:
        assert await get_default_sede_id(db) == "zzz-storica"
    finally:
        await db.sedi.delete_many({"id": "zzz-storica"})


@pytest.mark.asyncio
async def test_teacher_without_sede_denied(client):
    """Rimosso il fallback hardcoded: maestra senza sede → deny esplicito (403)."""
    db = get_db()
    await db.users.insert_one({
        "id": "t-nosede", "role": "teacher", "sede_id": None,
        "email": "t@nosede.it", "active": True, "class_ids": [],
    })
    try:
        r = await client.get("/api/diary", headers=_hdr("t-nosede", "teacher"))
        assert r.status_code == 403
    finally:
        await db.users.delete_many({"id": "t-nosede"})
