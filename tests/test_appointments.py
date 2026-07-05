"""FASE B — appointments: isolamento cross-tenant + anti-IDOR parent-facing."""
import pytest
from unittest.mock import patch, AsyncMock

from services.database import get_db

GGT, MM = "girogirotondo", "il-magico-mondo"


async def _seed_two():
    db = get_db()
    await db.appointments.insert_many([
        {"id": "apt-ggt", "parent_id": "parent-test-id", "sede_id": GGT,
         "date": "2026-05-01", "time_slot": "09:00", "reason": "GGT", "status": "pending"},
        {"id": "apt-mm", "parent_id": "mm-parent-id", "sede_id": MM,
         "date": "2026-05-01", "time_slot": "09:30", "reason": "MM", "status": "pending"},
    ])


async def _cleanup():
    await get_db().appointments.delete_many({"id": {"$in": ["apt-ggt", "apt-mm"]}})


@pytest.mark.asyncio
async def test_parent_cannot_read_others_via_parent_id_param(client, parent_headers):
    """IDOR: parent GGT con ?parent_id=<mm-parent> vede SOLO i propri, mai quelli di MM."""
    await _seed_two()
    try:
        r = await client.get("/api/appointments?parent_id=mm-parent-id", headers=parent_headers)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert "apt-ggt" in ids
        assert "apt-mm" not in ids
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_admin_appointments_scoped_by_sede(client, admin_headers):
    await _seed_two()
    try:
        r = await client.get("/api/appointments", headers=admin_headers)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert "apt-ggt" in ids and "apt-mm" not in ids
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_superadmin_sees_all_appointments(client, super_headers):
    await _seed_two()
    try:
        r = await client.get("/api/appointments", headers=super_headers)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert {"apt-ggt", "apt-mm"} <= ids
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_admin_cannot_update_status_cross_sede(client, admin_headers):
    await _seed_two()
    try:
        with patch("routers.appointments.send_appointment_email", new_callable=AsyncMock):
            r = await client.put("/api/appointments/apt-mm/status", params={"status": "confirmed"},
                                 headers=admin_headers)
        assert r.status_code == 404
        # invariato nel DB
        apt = await get_db().appointments.find_one({"id": "apt-mm"})
        assert apt["status"] == "pending"
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_admin_can_update_status_same_sede(client, admin_headers):
    await _seed_two()
    try:
        with patch("routers.appointments.send_appointment_email", new_callable=AsyncMock):
            r = await client.put("/api/appointments/apt-ggt/status", params={"status": "confirmed"},
                                 headers=admin_headers)
        assert r.status_code == 200
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_admin_cannot_delete_cross_sede(client, admin_headers):
    await _seed_two()
    try:
        r = await client.delete("/api/appointments/apt-mm", headers=admin_headers)
        assert r.status_code == 404
        assert await get_db().appointments.find_one({"id": "apt-mm"}) is not None
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_parent_cannot_delete_others_appointment(client, parent_headers):
    await _seed_two()
    try:
        r = await client.delete("/api/appointments/apt-mm", headers=parent_headers)
        assert r.status_code == 404
        assert await get_db().appointments.find_one({"id": "apt-mm"}) is not None
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_post_forces_parent_id_and_sede_serverside(client, parent_headers):
    """Un parent che tenta impersonation (parent_id=<mm>) → salvato a nome proprio + sede propria."""
    with patch("routers.appointments.send_appointment_email", new_callable=AsyncMock):
        r = await client.post("/api/appointments", json={
            "parent_id": "mm-parent-id",   # tentativo di impersonation → ignorato
            "date": "2026-06-01", "time_slot": "10:00", "reason": "test",
        }, headers=parent_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["parent_id"] == "parent-test-id"   # forzato al caller
    assert body["sede_id"] == GGT                   # derivato server-side
    await get_db().appointments.delete_many({"id": body["id"]})


@pytest.mark.asyncio
async def test_slots_booked_scoped_by_sede(client, parent_headers):
    """Gli slot occupati mostrati al parent GGT sono solo della sua sede (non di MM)."""
    await _seed_two()   # apt-ggt 09:00 (GGT), apt-mm 09:30 (MM), stessa data
    try:
        r = await client.get("/api/appointments/slots", params={"date": "2026-05-01"},
                             headers=parent_headers)
        assert r.status_code == 200
        booked = r.json()["booked_slots"]
        assert "09:00" in booked        # slot GGT
        assert "09:30" not in booked    # slot MM non deve trapelare
    finally:
        await _cleanup()
