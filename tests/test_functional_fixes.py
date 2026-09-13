"""Regressione bug funzionali chiusi in questa sessione."""
import pytest
from unittest.mock import patch, AsyncMock

from services.database import get_db

GGT_CLASS = "ggt-class-1"
GGT_STUDENT = "ggt-student-1"


# ---------------------------------------------------------------------------
# Appuntamenti — anti doppia prenotazione dello stesso slot
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_appointment_double_booking_conflict(client, parent_headers):
    db = get_db()
    with patch("routers.appointments.send_appointment_email", new_callable=AsyncMock), \
         patch("routers.appointments.expo_notify", new_callable=AsyncMock):
        r1 = await client.post("/api/appointments", json={
            "parent_id": "parent-test-id", "date": "2026-07-01",
            "time_slot": "10:00", "reason": "primo",
        }, headers=parent_headers)
        assert r1.status_code == 201
        # stesso slot, stessa sede → 409
        r2 = await client.post("/api/appointments", json={
            "parent_id": "parent-test-id", "date": "2026-07-01",
            "time_slot": "10:00", "reason": "doppio",
        }, headers=parent_headers)
        assert r2.status_code == 409
    await db.appointments.delete_many({"date": "2026-07-01"})


@pytest.mark.asyncio
async def test_cancelled_slot_is_freed(client, parent_headers):
    db = get_db()
    await db.appointments.insert_one({
        "id": "apt-cancel", "parent_id": "parent-test-id", "sede_id": "girogirotondo",
        "date": "2026-07-02", "time_slot": "11:00", "reason": "x", "status": "cancelled",
    })
    try:
        r = await client.get("/api/appointments/slots", params={"date": "2026-07-02"},
                             headers=parent_headers)
        assert r.status_code == 200
        assert "11:00" not in r.json()["booked_slots"]   # slot annullato → libero
    finally:
        await db.appointments.delete_one({"id": "apt-cancel"})


# ---------------------------------------------------------------------------
# Gallery — una foto nascosta (published=False) sparisce per il genitore
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unpublished_media_hidden_from_parent(client, parent_headers):
    db = get_db()
    await db.gallery.insert_one({
        "id": "hidden-1", "class_id": GGT_CLASS, "sede_id": "girogirotondo",
        "student_ids": [GGT_STUDENT], "media_type": "photo", "media_url": "https://x/h.jpg",
        "published": False, "created_at": "2026-01-01T00:00:00+00:00",
    })
    try:
        r = await client.get("/api/gallery", headers=parent_headers)
        assert r.status_code == 200
        assert "hidden-1" not in {m["id"] for m in r.json()}
        r2 = await client.get("/api/gallery/hidden-1", headers=parent_headers)
        assert r2.status_code == 404
    finally:
        await db.gallery.delete_one({"id": "hidden-1"})


# ---------------------------------------------------------------------------
# Diario — voce mirata a un altro bambino NON visibile al genitore
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_targeted_diary_not_leaked_to_other_parent(client, parent_headers):
    db = get_db()
    await db.diary.insert_many([
        {"id": "diary-target-other", "class_id": GGT_CLASS, "sede_id": "girogirotondo",
         "date": "2026-04-01", "summary": "solo altri", "student_ids": ["other-child-x"],
         "created_at": "2026-04-01T00:00:00+00:00"},
        {"id": "diary-classwide", "class_id": GGT_CLASS, "sede_id": "girogirotondo",
         "date": "2026-04-01", "summary": "tutta la classe",
         "created_at": "2026-04-01T00:00:00+00:00"},
    ])
    try:
        r = await client.get("/api/diary", params={"date": "2026-04-01"}, headers=parent_headers)
        assert r.status_code == 200
        ids = {d["id"] for d in r.json()}
        assert "diary-classwide" in ids            # voce di classe: visibile
        assert "diary-target-other" not in ids     # voce mirata ad altri: NON visibile
    finally:
        await db.diary.delete_many({"id": {"$in": ["diary-target-other", "diary-classwide"]}})


# ---------------------------------------------------------------------------
# Ricevute non lette — conteggio limitato ai documenti della propria sede
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_griglia_bulk_saves_and_notifies_once(client, teacher_headers):
    # Bulk: valori diversi per bambino, UNA sola notifica ai genitori (niente spam).
    with patch("routers.griglia.notify_parents_of_class", new_callable=AsyncMock) as mock_notify:
        r = await client.post("/api/griglia/bulk", json={
            "class_id": GGT_CLASS, "date": "2026-08-01",
            "entries": [
                {"student_id": GGT_STUDENT, "pasta_qty": "tutto", "frutta_qty": "no"},
            ],
        }, headers=teacher_headers)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 1
        assert rows[0]["pasta"] is True         # 'tutto' → mangiato
        assert rows[0]["frutta"] is False       # 'no' → non mangiato
        assert mock_notify.await_count == 1     # una sola notifica per l'intero batch
    await get_db().griglia.delete_many({"date": "2026-08-01"})


@pytest.mark.asyncio
async def test_griglia_bulk_cross_tenant_student_404(client, teacher_headers):
    # Uno studente di un'altra classe nel batch → 404, nessuna scrittura.
    r = await client.post("/api/griglia/bulk", json={
        "class_id": GGT_CLASS, "date": "2026-08-02",
        "entries": [{"student_id": "mm-student-1"}],
    }, headers=teacher_headers)
    assert r.status_code == 404
    assert await get_db().griglia.find_one({"date": "2026-08-02"}) is None


@pytest.mark.asyncio
async def test_unread_count_scoped_to_own_sede(client, parent_headers):
    # Il totale non-letti deve coincidere con i documenti VISIBILI (stesso scoping di
    # GET /documents) e mai includere i documenti di un'altra sede.
    visible = await client.get("/api/documents", headers=parent_headers)
    assert visible.status_code == 200
    visible_ids = {d["id"] for d in visible.json()}
    assert "mm-doc-1" not in visible_ids            # doc di un'altra sede: escluso

    r = await client.get("/api/read-receipts/unread", headers=parent_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == len(visible_ids)        # totale == documenti visibili scopati
