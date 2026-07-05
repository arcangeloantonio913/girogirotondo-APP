"""faseB-org — isolamento cross-ORG (livello sopra le sedi).

Org 1 = Girogirotondo + Il Magico Mondo (super-test-id).  Org 2 = Dimensione Bimbo (super2-test-id).
Un superadmin è all-access DENTRO la propria org, MAI fuori. Admin normale invariato.
Fixture in conftest: SEDE_DB2/DB2_CLASS/DB2_STUDENT (org 2), super2_headers, db2_admin_headers.
"""
import pytest
from services.database import get_db

# Costanti allineate al seed di conftest.py (org 1 = GGT+MM, org 2 = Dimensione Bimbo)
SEDE_GGT, SEDE_MM, SEDE_DB2 = "girogirotondo", "il-magico-mondo", "db-sede-1"
GGT_CLASS = "ggt-class-1"
ORG2 = "dimensione-bimbo"


async def _seed_appts():
    await get_db().appointments.insert_many([
        {"id": "appt-ggt", "sede_id": SEDE_GGT, "parent_id": "parent-test-id", "date": "2026-09-01", "time_slot": "09:00"},
        {"id": "appt-mm",  "sede_id": SEDE_MM,  "parent_id": "mm-parent-id",   "date": "2026-09-01", "time_slot": "10:00"},
        {"id": "appt-db2", "sede_id": SEDE_DB2, "parent_id": "db2-parent-id",  "date": "2026-09-01", "time_slot": "11:00"},
    ])


async def _clean_appts():
    await get_db().appointments.delete_many({"id": {"$in": ["appt-ggt", "appt-mm", "appt-db2"]}})


# ── (a) super org 1: GET /api/sedi vede solo le sedi della propria org ──
@pytest.mark.asyncio
async def test_a_super1_sedi_only_own_org(client, super_headers):
    r = await client.get("/api/sedi", headers=super_headers)
    assert r.status_code == 200
    ids = {s["id"] for s in r.json()}
    assert {SEDE_GGT, SEDE_MM} <= ids
    assert SEDE_DB2 not in ids            # sede di org 2 -> invisibile


# ── (b) super org 1 con X-Sede-Id di org 2 -> rifiutato (400) ──
@pytest.mark.asyncio
async def test_b_super1_xsede_of_org2_rejected(client, super_headers):
    # controllo: senza header lecito -> 200
    assert (await client.get("/api/users", headers=super_headers)).status_code == 200
    # X-Sede-Id di una sede di org 2 -> fuori dalle sedi valide della propria org -> 400
    r = await client.get("/api/users", headers={**super_headers, "X-Sede-Id": SEDE_DB2})
    assert r.status_code == 400


# ── (c) super org 1: vede dati di ENTRAMBE le sue sedi, NON quelli di org 2 ──
@pytest.mark.asyncio
async def test_c_super1_data_own_org_only(client, super_headers):
    await _seed_appts()
    try:
        r = await client.get("/api/appointments", headers=super_headers)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert {"appt-ggt", "appt-mm"} <= ids   # tutta la PROPRIA org (multi-sede, non over-restricted)
        assert "appt-db2" not in ids             # dati di org 2 -> invisibili
    finally:
        await _clean_appts()


# ── (d) super org 2: simmetrico — vede org 2, non org 1 ──
@pytest.mark.asyncio
async def test_d_super2_data_own_org_only(client, super2_headers):
    await _seed_appts()
    try:
        r = await client.get("/api/appointments", headers=super2_headers)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert "appt-db2" in ids
        assert "appt-ggt" not in ids and "appt-mm" not in ids
    finally:
        await _clean_appts()


# ── (e) admin normale org 1: INVARIATO (solo la propria sede) ──
@pytest.mark.asyncio
async def test_e_normal_admin_unchanged(client, admin_headers):
    r = await client.get("/api/classes", headers=admin_headers)
    assert r.status_code == 200
    ids = {c["id"] for c in r.json()}
    assert GGT_CLASS in ids
    assert "mm-class-1" not in ids and "db-class-1" not in ids   # né altra sede né altra org


# ── (f) super org 1: switch tra le PROPRIE sedi + broadcast multi-sede intra-org consentito;
#        broadcast che include una sede di org 2 -> 404 ──
@pytest.mark.asyncio
async def test_f_super1_intra_org_broadcast_ok_cross_org_denied(client, super_headers):
    db = get_db()
    # positivo: target entrambe le sedi di org 1
    r_ok = await client.post("/api/avvisi",
        json={"titolo": "org1-broadcast", "testo": "x", "target_sedi": [SEDE_GGT, SEDE_MM]},
        headers=super_headers)
    assert r_ok.status_code == 201
    try:
        assert set(r_ok.json()["target_sedi"]) == {SEDE_GGT, SEDE_MM}
    finally:
        await db.avvisi.delete_many({"titolo": "org1-broadcast"})
    # negativo: target che include una sede di org 2 -> 404, nessun avviso creato
    r_no = await client.post("/api/avvisi",
        json={"titolo": "org1-leak", "testo": "x", "target_sedi": [SEDE_GGT, SEDE_DB2]},
        headers=super_headers)
    assert r_no.status_code == 404
    assert await db.avvisi.find_one({"titolo": "org1-leak"}) is None


# ── (g) super org 1: GET /api/users NON include il superadmin di org 2 ──
@pytest.mark.asyncio
async def test_g_super1_users_excludes_org2_superadmin(client, super_headers):
    r = await client.get("/api/users", headers=super_headers)
    assert r.status_code == 200
    ids = {u["id"] for u in r.json()}
    assert "super-test-id" in ids          # sé stesso (org 1)
    assert "super2-test-id" not in ids     # superadmin di org 2 -> invisibile
    assert "db2-admin-id" not in ids        # admin di org 2 -> invisibile


# ── FALLBACK pre-backfill: superadmin SENZA org_id -> comportamento globale (identico a oggi) ──
@pytest.mark.asyncio
async def test_fallback_super_without_org_is_global(client):
    """Un superadmin non ancora backfillato (org_id assente) vede TUTTE le sedi/org — così il
    codice si può deployare PRIMA del backfill senza lockout/regressioni."""
    import os, jwt as pyjwt
    from datetime import datetime, timezone, timedelta
    db = get_db()
    await db.users.insert_one({
        "id": "super-noorg", "role": "admin", "is_superadmin": True, "sede_id": None,
        "active": True, "email": "noorg@x.it",   # NIENTE org_id
    })
    tok = pyjwt.encode({"user_id": "super-noorg", "role": "admin",
                        "exp": datetime.now(timezone.utc) + timedelta(days=1)},
                       os.environ["JWT_SECRET"], algorithm="HS256")
    hdr = {"Authorization": f"Bearer {tok}"}
    await _seed_appts()
    try:
        rs = await client.get("/api/sedi", headers=hdr)
        assert SEDE_DB2 in {s["id"] for s in rs.json()}          # vede anche org 2 (fallback globale)
        ra = await client.get("/api/appointments", headers=hdr)
        assert "appt-db2" in {a["id"] for a in ra.json()}         # e i relativi dati
    finally:
        await _clean_appts()
        await db.users.delete_many({"id": "super-noorg"})
