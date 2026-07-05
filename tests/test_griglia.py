"""FASE B/2 — griglia: isolamento cross-tenant (pattern diary)."""
import pytest
from unittest.mock import patch, AsyncMock

from services.database import get_db

GGT_CLASS, MM_CLASS = "ggt-class-1", "mm-class-1"
GGT_STUDENT, MM_STUDENT = "ggt-student-1", "mm-student-1"


async def _seed():
    db = get_db()
    await db.griglia.insert_many([
        {"id": "grg-ggt", "class_id": GGT_CLASS, "student_id": GGT_STUDENT,
         "sede_id": "girogirotondo", "date": "2026-05-01"},
        {"id": "grg-mm", "class_id": MM_CLASS, "student_id": MM_STUDENT,
         "sede_id": "il-magico-mondo", "date": "2026-05-01"},
    ])


async def _cleanup():
    await get_db().griglia.delete_many({"id": {"$in": ["grg-ggt", "grg-mm"]}})


# ── DoD 1: GET teacher SENZA class_id/student_id -> solo le proprie classi, non tutte le sedi ──
@pytest.mark.asyncio
async def test_teacher_get_no_args_scoped_not_all_sedi(client, teacher_headers):
    await _seed()
    try:
        r = await client.get("/api/griglia", headers=teacher_headers)
        assert r.status_code == 200
        ids = {e["id"] for e in r.json()}
        assert "grg-ggt" in ids
        assert "grg-mm" not in ids      # il dump a conoscenza-zero NON deve trapelare l'altra sede
    finally:
        await _cleanup()


# ── DoD 2: GET teacher con class_id / student_id di sede B -> 404 ──
@pytest.mark.asyncio
async def test_teacher_get_cross_sede_class_or_student_404(client, teacher_headers):
    await _seed()
    try:
        r1 = await client.get(f"/api/griglia?class_id={MM_CLASS}", headers=teacher_headers)
        assert r1.status_code == 404
        r2 = await client.get(f"/api/griglia?student_id={MM_STUDENT}", headers=teacher_headers)
        assert r2.status_code == 404
    finally:
        await _cleanup()


# ── DoD 3: POST teacher su class_id di sede B -> 404 PRIMA di scrittura o notify ──
@pytest.mark.asyncio
async def test_teacher_post_cross_sede_404_no_write_no_notify(client, teacher_headers):
    db = get_db()
    with patch("routers.griglia.notify_parents_of_class", new_callable=AsyncMock) as notify:
        r = await client.post("/api/griglia", json={
            "class_id": MM_CLASS, "student_ids": [MM_STUDENT], "date": "2026-05-02",
        }, headers=teacher_headers)
    assert r.status_code == 404
    notify.assert_not_called()                                  # nessuna notifica ai genitori di B
    assert await db.griglia.find_one({"class_id": MM_CLASS, "date": "2026-05-02"}) is None  # nessuna scrittura


# ── DoD 4: parent chiede uno student_id non suo -> 404 ──
@pytest.mark.asyncio
async def test_parent_other_student_404(client, parent_headers):
    r = await client.get(f"/api/griglia?student_id={MM_STUDENT}", headers=parent_headers)
    assert r.status_code == 404


# ── Regressioni / happy path ──
@pytest.mark.asyncio
async def test_parent_sees_only_own_children(client, parent_headers):
    await _seed()
    try:
        r = await client.get("/api/griglia", headers=parent_headers)
        assert r.status_code == 200
        ids = {e["id"] for e in r.json()}
        assert "grg-ggt" in ids and "grg-mm" not in ids
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_teacher_post_own_class_ok_and_sede_stamped(client, teacher_headers):
    db = get_db()
    with patch("routers.griglia.notify_parents_of_class", new_callable=AsyncMock):
        r = await client.post("/api/griglia", json={
            "class_id": GGT_CLASS, "student_ids": [GGT_STUDENT], "date": "2026-05-03",
        }, headers=teacher_headers)
    assert r.status_code == 200
    body = r.json()
    assert body[0]["sede_id"] == "girogirotondo"      # sede derivata server-side (audit/erasure)
    assert body[0]["class_id"] == GGT_CLASS
    await db.griglia.delete_many({"class_id": GGT_CLASS, "date": "2026-05-03"})


@pytest.mark.asyncio
async def test_teacher_post_own_class_but_other_sede_student_404_no_record(client, teacher_headers):
    """Batch misto: classe PROPRIA (assert_class passa) ma con uno student_id di un'altra
    sede nel body -> 404 e NESSUN record scritto per quello studente."""
    db = get_db()
    with patch("routers.griglia.notify_parents_of_class", new_callable=AsyncMock):
        r = await client.post("/api/griglia", json={
            "class_id": GGT_CLASS,                        # classe propria della maestra GGT
            "student_ids": [MM_STUDENT, GGT_STUDENT],     # ma include uno studente di sede B
            "date": "2026-05-04",
        }, headers=teacher_headers)
    assert r.status_code == 404
    # lo studente di un'altra sede NON deve avere alcun record
    assert await db.griglia.find_one({"student_id": MM_STUDENT, "date": "2026-05-04"}) is None
    await db.griglia.delete_many({"date": "2026-05-04"})   # cleanup difensivo


@pytest.mark.asyncio
async def test_teacher_post_batch_atomic_reverse_order(client, teacher_headers):
    """Atomicità (ordine INVERSO): studente PROPRIO prima, ESTRANEO dopo -> 404 e NESSUN
    record scritto, né per l'estraneo né per il proprio. Col vecchio codice (valida+scrivi
    nello stesso loop) il proprio verrebbe scritto prima del 404 -> RED; col fix -> GREEN."""
    db = get_db()
    with patch("routers.griglia.notify_parents_of_class", new_callable=AsyncMock) as notify:
        r = await client.post("/api/griglia", json={
            "class_id": GGT_CLASS,
            "student_ids": [GGT_STUDENT, MM_STUDENT],   # proprio PRIMA, estraneo DOPO
            "date": "2026-05-05",
        }, headers=teacher_headers)
    assert r.status_code == 404
    notify.assert_not_called()
    assert await db.griglia.find_one({"student_id": MM_STUDENT, "date": "2026-05-05"}) is None
    assert await db.griglia.find_one({"student_id": GGT_STUDENT, "date": "2026-05-05"}) is None  # atomicità
    await db.griglia.delete_many({"date": "2026-05-05"})   # cleanup difensivo


@pytest.mark.asyncio
async def test_superadmin_sees_all(client, super_headers):
    await _seed()
    try:
        r = await client.get("/api/griglia", headers=super_headers)
        assert r.status_code == 200
        ids = {e["id"] for e in r.json()}
        assert {"grg-ggt", "grg-mm"} <= ids
    finally:
        await _cleanup()
