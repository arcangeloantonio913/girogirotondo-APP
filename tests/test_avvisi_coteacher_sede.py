"""Avvisi — bacheca CONDIVISA fra le maestre della stessa sede.

Regressione per i bug riportati in produzione (Dimensione Bimbo):
  1. una maestra crea un avviso ma le ALTRE maestre della stessa sede NON lo vedono;
  2. le colleghe non possono modificarlo né eliminarlo.

Comportamento atteso (scelta prodotto confermata): QUALSIASI maestra della stessa
sede vede e può modificare/eliminare l'avviso di una collega. Restano negati:
  - maestre di un'ALTRA sede/tenant (isolamento);
  - i genitori (non devono mai gestire gli avvisi);
  - gli avvisi creati dall'ADMIN (gestibili solo da admin).
"""
import pytest
import jwt as pyjwt
import os
from datetime import datetime, timezone, timedelta

from services.database import get_db

SEDE_GGT, SEDE_MM = "girogirotondo", "il-magico-mondo"
GGT_CLASS = "ggt-class-1"

# Seconda maestra della stessa sede GGT, ma su una SEZIONE DIVERSA:
# prova che la condivisione è a livello di SEDE (non solo di classe condivisa).
COTEACHER_ID = "ggt-coteacher-id"
COTEACHER_CLASS = "ggt-class-2"


def _headers(user_id: str, role: str) -> dict:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=1),
    }
    tok = pyjwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture
def coteacher_headers():
    return _headers(COTEACHER_ID, "teacher")


@pytest.fixture(autouse=True)
async def _seed_coteacher():
    """Aggiunge una seconda maestra GGT (sezione diversa) e la sua classe."""
    db = get_db()
    await db.classes.update_one(
        {"id": COTEACHER_CLASS},
        {"$set": {"id": COTEACHER_CLASS, "name": "Coccinelle",
                  "sede_id": SEDE_GGT, "teacher_id": COTEACHER_ID}},
        upsert=True,
    )
    await db.users.update_one(
        {"id": COTEACHER_ID},
        {"$set": {"id": COTEACHER_ID, "role": "teacher", "sede_id": SEDE_GGT,
                  "org_id": "girogirotondo-group", "class_ids": [COTEACHER_CLASS],
                  "active": True, "email": "coteacher@ggt.it"}},
        upsert=True,
    )
    yield
    await db.users.delete_one({"id": COTEACHER_ID})
    await db.classes.delete_one({"id": COTEACHER_CLASS})


async def _create_teacher_avviso(client, headers, titolo="Avviso della maestra"):
    r = await client.post("/api/avvisi",
                          json={"titolo": titolo, "testo": "Corpo avviso"},
                          headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _cleanup(avviso_id):
    await get_db().avvisi.delete_one({"id": avviso_id})


# ── BUG 1: visibilità fra colleghe della stessa sede ───────────────────────────
@pytest.mark.asyncio
async def test_coteacher_sees_colleague_avviso(client, teacher_headers, coteacher_headers):
    aid = await _create_teacher_avviso(client, teacher_headers)
    try:
        r = await client.get("/api/avvisi", headers=coteacher_headers)
        assert r.status_code == 200
        ids = [a["id"] for a in r.json()]
        assert aid in ids, "la collega della stessa sede deve vedere l'avviso"

        # anche il GET singolo deve essere consentito (mirror della lista)
        r2 = await client.get(f"/api/avvisi/{aid}", headers=coteacher_headers)
        assert r2.status_code == 200
    finally:
        await _cleanup(aid)


# ── BUG 2a: modifica da parte di una collega della sede ────────────────────────
@pytest.mark.asyncio
async def test_coteacher_can_edit(client, teacher_headers, coteacher_headers):
    aid = await _create_teacher_avviso(client, teacher_headers)
    try:
        r = await client.put(f"/api/avvisi/{aid}",
                             json={"titolo": "Modificato dalla collega"},
                             headers=coteacher_headers)
        assert r.status_code == 200, r.text
        assert r.json()["titolo"] == "Modificato dalla collega"
    finally:
        await _cleanup(aid)


# ── BUG 2b: eliminazione da parte di una collega della sede ────────────────────
@pytest.mark.asyncio
async def test_coteacher_can_delete(client, teacher_headers, coteacher_headers):
    aid = await _create_teacher_avviso(client, teacher_headers)
    deleted = False
    try:
        r = await client.delete(f"/api/avvisi/{aid}", headers=coteacher_headers)
        assert r.status_code == 200, r.text
        deleted = True
        assert await get_db().avvisi.find_one({"id": aid}) is None
    finally:
        if not deleted:
            await _cleanup(aid)


# ── GUARDIA: maestra di ALTRA sede NON vede/gestisce (isolamento tenant) ────────
@pytest.mark.asyncio
async def test_other_sede_teacher_denied(client, teacher_headers, mm_teacher_headers):
    aid = await _create_teacher_avviso(client, teacher_headers)
    try:
        r = await client.get("/api/avvisi", headers=mm_teacher_headers)
        assert aid not in [a["id"] for a in r.json()], "cross-sede: non deve vedere"

        r_put = await client.put(f"/api/avvisi/{aid}",
                                 json={"titolo": "hack"}, headers=mm_teacher_headers)
        assert r_put.status_code in (403, 404)

        r_del = await client.delete(f"/api/avvisi/{aid}", headers=mm_teacher_headers)
        assert r_del.status_code in (403, 404)
        assert await get_db().avvisi.find_one({"id": aid}) is not None
    finally:
        await _cleanup(aid)


# ── GUARDIA: un GENITORE non può mai modificare/eliminare un avviso ────────────
@pytest.mark.asyncio
async def test_parent_cannot_manage(client, teacher_headers, parent_headers):
    aid = await _create_teacher_avviso(client, teacher_headers)
    try:
        r_put = await client.put(f"/api/avvisi/{aid}",
                                 json={"titolo": "hack"}, headers=parent_headers)
        assert r_put.status_code in (403, 404)
        r_del = await client.delete(f"/api/avvisi/{aid}", headers=parent_headers)
        assert r_del.status_code in (403, 404)
        assert await get_db().avvisi.find_one({"id": aid}) is not None
    finally:
        await _cleanup(aid)
