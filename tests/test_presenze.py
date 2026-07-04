"""FASE B/3 — presenze: isolamento cross-tenant su TUTTE le read surfaces (find) +
POST all-or-nothing. Solo staff (teacher/admin), scoping per classe."""
import pytest
from services.database import get_db

GGT_CLASS, MM_CLASS = "ggt-class-1", "mm-class-1"
GGT_STUDENT, MM_STUDENT = "ggt-student-1", "mm-student-1"
D = "2026-05-01"


async def _seed():
    db = get_db()
    await db.presenze.insert_many([
        {"id": "prs-ggt", "class_id": GGT_CLASS, "student_id": GGT_STUDENT,
         "sede_id": "girogirotondo", "date": D, "presente": True, "nota": ""},
        {"id": "prs-mm", "class_id": MM_CLASS, "student_id": MM_STUDENT,
         "sede_id": "il-magico-mondo", "date": D, "presente": False, "nota": ""},
    ])


async def _cleanup():
    await get_db().presenze.delete_many({"id": {"$in": ["prs-ggt", "prs-mm"]}})


# ── (c1) READ SURFACE 1: GET admin senza parametri (find({})) -> solo propria sede ──
@pytest.mark.asyncio
async def test_get_admin_no_params_excludes_other_sede(client, admin_headers):
    await _seed()
    try:
        r = await client.get("/api/presenze", headers=admin_headers)
        assert r.status_code == 200
        ids = {x["id"] for x in r.json()}
        assert "prs-ggt" in ids
        assert "prs-mm" not in ids            # record di sede B ASSENTI
    finally:
        await _cleanup()


# ── (c2) READ SURFACE 2: GET admin report mese -> esclude sede B (conta e verifica) ──
@pytest.mark.asyncio
async def test_get_admin_month_report_excludes_other_sede(client, admin_headers):
    await _seed()
    try:
        r = await client.get("/api/presenze?mese=2026-05", headers=admin_headers)
        assert r.status_code == 200
        recs = r.json()
        ids = {x["id"] for x in recs}
        assert "prs-ggt" in ids and "prs-mm" not in ids
        assert all(x["class_id"] == GGT_CLASS for x in recs)   # nessun record di sede B nel report
    finally:
        await _cleanup()


# ── (c3) READ SURFACE 3: GET /classi-summary -> il riepilogo esclude sede B ──
@pytest.mark.asyncio
async def test_classi_summary_excludes_other_sede(client, admin_headers):
    await _seed()
    try:
        r = await client.get(f"/api/presenze/classi-summary?date={D}", headers=admin_headers)
        assert r.status_code == 200
        classes = r.json()["classes"]
        assert GGT_CLASS in classes
        assert MM_CLASS not in classes        # la classe di sede B NON compare nel riepilogo
    finally:
        await _cleanup()


# ── (b) cross-sede class_id -> 404 (GET e POST) ──
@pytest.mark.asyncio
async def test_admin_get_cross_sede_class_404(client, admin_headers):
    r = await client.get(f"/api/presenze?class_id={MM_CLASS}", headers=admin_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_admin_post_cross_sede_class_404_no_write(client, admin_headers):
    db = get_db()
    r = await client.post("/api/presenze", json={
        "class_id": MM_CLASS, "date": "2026-05-06",
        "records": [{"student_id": MM_STUDENT, "presente": True, "nota": ""}],
    }, headers=admin_headers)
    assert r.status_code == 404
    assert await db.presenze.find_one({"class_id": MM_CLASS, "date": "2026-05-06"}) is None


# ── (d) batch con id estraneo -> 404 + ZERO record, ENTRAMBI gli ordini ──
@pytest.mark.asyncio
async def test_post_batch_foreign_student_order_foreign_first(client, teacher_headers):
    db = get_db()
    r = await client.post("/api/presenze", json={
        "class_id": GGT_CLASS, "date": "2026-05-07",
        "records": [{"student_id": MM_STUDENT}, {"student_id": GGT_STUDENT}],   # [estraneo, valido]
    }, headers=teacher_headers)
    assert r.status_code == 404
    assert await db.presenze.find_one({"date": "2026-05-07"}) is None           # ZERO record


@pytest.mark.asyncio
async def test_post_batch_foreign_student_order_valid_first(client, teacher_headers):
    db = get_db()
    r = await client.post("/api/presenze", json={
        "class_id": GGT_CLASS, "date": "2026-05-08",
        "records": [{"student_id": GGT_STUDENT}, {"student_id": MM_STUDENT}],   # [valido, estraneo]
    }, headers=teacher_headers)
    assert r.status_code == 404
    # atomicità: nemmeno il record valido dev'essere scritto
    assert await db.presenze.find_one({"student_id": GGT_STUDENT, "date": "2026-05-08"}) is None
    assert await db.presenze.find_one({"student_id": MM_STUDENT, "date": "2026-05-08"}) is None


# ── Happy path + regressioni ──
@pytest.mark.asyncio
async def test_teacher_post_own_class_ok_sede_stamped(client, teacher_headers):
    db = get_db()
    r = await client.post("/api/presenze", json={
        "class_id": GGT_CLASS, "date": "2026-05-09",
        "records": [{"student_id": GGT_STUDENT, "presente": True, "nota": ""}],
    }, headers=teacher_headers)
    assert r.status_code == 201
    doc = await db.presenze.find_one({"student_id": GGT_STUDENT, "date": "2026-05-09"})
    assert doc is not None and doc["sede_id"] == "girogirotondo"    # sede derivata server-side
    await db.presenze.delete_many({"date": "2026-05-09"})


@pytest.mark.asyncio
async def test_teacher_get_only_own_classes(client, teacher_headers):
    await _seed()
    try:
        r = await client.get("/api/presenze", headers=teacher_headers)
        assert r.status_code == 200
        ids = {x["id"] for x in r.json()}
        assert "prs-ggt" in ids and "prs-mm" not in ids
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_superadmin_summary_sees_all(client, super_headers):
    await _seed()
    try:
        r = await client.get(f"/api/presenze/classi-summary?date={D}", headers=super_headers)
        assert r.status_code == 200
        classes = r.json()["classes"]
        assert GGT_CLASS in classes and MM_CLASS in classes     # superadmin: entrambe le sedi
    finally:
        await _cleanup()
