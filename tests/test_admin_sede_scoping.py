"""FASE A — copertura RUNTIME di `await validate_admin_sede_access` per OGNI router.

Ogni test esercita un endpoint admin che filtra per la sede restituita da
validate_admin_sede_access. Se l'`await` mancasse, sede_id sarebbe una *coroutine*,
la query per-sede risulterebbe vuota (o il valore non serializzabile) e queste
asserzioni fallirebbero → il test è "forte" (sensibile all'await mancante).
"""
import pytest
from services.database import get_db

GGT_CLASS, MM_CLASS = "ggt-class-1", "mm-class-1"
GGT_STUDENT, MM_STUDENT = "ggt-student-1", "mm-student-1"


@pytest.mark.asyncio
async def test_classes_admin_scoped_by_sede(client, admin_headers):
    # classes.py:32 (GET /api/classes)
    r = await client.get("/api/classes", headers=admin_headers)
    assert r.status_code == 200
    ids = {c["id"] for c in r.json()}
    assert GGT_CLASS in ids and MM_CLASS not in ids


@pytest.mark.asyncio
async def test_students_admin_scoped_by_sede(client, admin_headers):
    # students.py:61 (GET /api/students)
    r = await client.get("/api/students", headers=admin_headers)
    assert r.status_code == 200
    ids = {s["id"] for s in r.json()}
    assert GGT_STUDENT in ids and MM_STUDENT not in ids


@pytest.mark.asyncio
async def test_meals_admin_scoped_by_sede(client, admin_headers):
    # meals.py:41 (GET /api/meals/menu)
    db = get_db()
    await db.meals.insert_many([
        {"id": "ggt-meal-x", "class_id": GGT_CLASS, "sede_id": "girogirotondo", "date": "2026-01-10", "primo": "Pasta"},
        {"id": "mm-meal-x", "class_id": MM_CLASS, "sede_id": "il-magico-mondo", "date": "2026-01-10", "primo": "Riso"},
    ])
    try:
        r = await client.get("/api/meals/menu", headers=admin_headers)
        assert r.status_code == 200
        ids = {m["id"] for m in r.json()}
        assert "ggt-meal-x" in ids and "mm-meal-x" not in ids
    finally:
        await db.meals.delete_many({"id": {"$in": ["ggt-meal-x", "mm-meal-x"]}})


@pytest.mark.asyncio
async def test_avvisi_admin_scoped_by_sede(client, admin_headers):
    # avvisi.py:71 (GET /api/avvisi)
    db = get_db()
    await db.avvisi.insert_many([
        {"id": "ggt-avv-x", "sede_id": "girogirotondo", "titolo": "GGT", "testo": "x",
         "target": "global", "target_sedi": [], "created_at": "2026-01-10T00:00:00+00:00"},
        {"id": "mm-avv-x", "sede_id": "il-magico-mondo", "titolo": "MM", "testo": "y",
         "target": "global", "target_sedi": [], "created_at": "2026-01-10T00:00:00+00:00"},
    ])
    try:
        r = await client.get("/api/avvisi", headers=admin_headers)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert "ggt-avv-x" in ids and "mm-avv-x" not in ids
    finally:
        await db.avvisi.delete_many({"id": {"$in": ["ggt-avv-x", "mm-avv-x"]}})


@pytest.mark.asyncio
async def test_get_tenant_context_admin_branch_scoped(client, admin_headers):
    # 24° call-site: validate_admin_sede_access dentro get_tenant_context (middleware/auth.py)
    # esercitato dal branch admin di un endpoint tenant-context (documents).
    r = await client.get("/api/documents", headers=admin_headers)
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()}
    assert "ggt-doc-1" in ids and "mm-doc-1" not in ids
