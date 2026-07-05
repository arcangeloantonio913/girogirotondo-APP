"""FASE B/4 — ownership object-level: calendar PUT/DELETE + documents DELETE + create-side.
Target cross-tenant = doc/eventi del seed conftest (mm-*); mutazioni positive = insert usa-e-getta."""
import pytest
from unittest.mock import patch, AsyncMock

from services.database import get_db

GGT_CLASS, MM_CLASS = "ggt-class-1", "mm-class-1"


# ── (a) calendar PUT cross-tenant -> 404, evento INVARIATO ──
@pytest.mark.asyncio
async def test_calendar_put_cross_tenant_404_unchanged(client, admin_headers):
    db = get_db()
    before = await db.calendar_events.find_one({"id": "mm-ev-1"})
    r = await client.put("/api/calendar/events/mm-ev-1", json={"titolo": "HACKED"}, headers=admin_headers)
    assert r.status_code == 404
    after = await db.calendar_events.find_one({"id": "mm-ev-1"})
    assert after["titolo"] == before["titolo"]        # invariato


# ── (b) calendar PUT same-sede move -> 200, spostato, sede_id ricalcolato (POSITIVO) ──
@pytest.mark.asyncio
async def test_calendar_put_same_sede_move_recomputes_sede(client, admin_headers):
    db = get_db()
    await db.classes.insert_one({"id": "ggt-class-2", "name": "Coccinelle", "sede_id": "girogirotondo"})
    await db.calendar_events.insert_one({"id": "cal-move", "classe_id": GGT_CLASS, "sede_id": "girogirotondo",
        "titolo": "T", "data_inizio": "2026-05-01", "visibile_a": ["parent"], "tipo": "altro"})
    try:
        r = await client.put("/api/calendar/events/cal-move", json={"classe_id": "ggt-class-2"},
                             headers=admin_headers)
        assert r.status_code == 200
        ev = await db.calendar_events.find_one({"id": "cal-move"})
        assert ev["classe_id"] == "ggt-class-2"       # spostato in altra classe PROPRIA
        assert ev["sede_id"] == "girogirotondo"       # sede ricalcolata coerente
    finally:
        await db.classes.delete_one({"id": "ggt-class-2"})
        await db.calendar_events.delete_one({"id": "cal-move"})


# ── (a-variant) PUT che tenta di spostare il PROPRIO evento in sede B -> 404, tenant invariato ──
@pytest.mark.asyncio
async def test_calendar_put_move_to_other_sede_blocked(client, admin_headers):
    db = get_db()
    await db.calendar_events.insert_one({"id": "cal-own", "classe_id": GGT_CLASS, "sede_id": "girogirotondo",
        "titolo": "Own", "data_inizio": "2026-05-01", "visibile_a": ["parent"], "tipo": "altro"})
    try:
        r = await client.put("/api/calendar/events/cal-own", json={"classe_id": MM_CLASS}, headers=admin_headers)
        assert r.status_code == 404
        ev = await db.calendar_events.find_one({"id": "cal-own"})
        assert ev["classe_id"] == GGT_CLASS and ev["sede_id"] == "girogirotondo"   # tenant invariato
    finally:
        await db.calendar_events.delete_one({"id": "cal-own"})


# ── (c) calendar DELETE cross-tenant -> 404, evento ANCORA presente ──
@pytest.mark.asyncio
async def test_calendar_delete_cross_tenant_404_present(client, admin_headers):
    db = get_db()
    r = await client.delete("/api/calendar/events/mm-ev-1", headers=admin_headers)
    assert r.status_code == 404
    assert await db.calendar_events.find_one({"id": "mm-ev-1"}) is not None


# ── (d) calendar POST cross-tenant -> 404, notify NON chiamata, nessun evento creato ──
@pytest.mark.asyncio
async def test_calendar_create_cross_tenant_404_no_notify(client, teacher_headers):
    db = get_db()
    with patch("routers.calendar.notify_class", new_callable=AsyncMock) as nc, \
         patch("routers.calendar.notify_role", new_callable=AsyncMock):
        r = await client.post("/api/calendar/events", json={
            "titolo": "XEV", "data_inizio": "2026-05-01", "classe_id": MM_CLASS, "visibile_a": ["parent"],
        }, headers=teacher_headers)
    assert r.status_code == 404
    nc.assert_not_called()
    assert await db.calendar_events.find_one({"titolo": "XEV"}) is None


# ── (c) documents DELETE cross-tenant -> 404, presente, delete_file NON chiamata ──
@pytest.mark.asyncio
async def test_documents_delete_cross_tenant_404_no_file_delete(client, admin_headers):
    db = get_db()
    with patch("routers.documents.delete_file") as df:
        r = await client.delete("/api/documents/mm-doc-1", headers=admin_headers)
    assert r.status_code == 404
    df.assert_not_called()
    assert await db.documents.find_one({"id": "mm-doc-1"}) is not None


# ── documents DELETE own -> 200, delete_file chiamata (POSITIVO) ──
@pytest.mark.asyncio
async def test_documents_delete_own_ok_calls_file_delete(client, admin_headers):
    db = get_db()
    await db.documents.insert_one({"id": "doc-own", "title": "T", "classe_id": GGT_CLASS,
        "sede_id": "girogirotondo", "storage_path": "documents/doc-own.pdf"})
    with patch("routers.documents.delete_file") as df:
        r = await client.delete("/api/documents/doc-own", headers=admin_headers)
    assert r.status_code == 200
    df.assert_called_once()
    assert await db.documents.find_one({"id": "doc-own"}) is None


# ── (d) documents upload cross-tenant -> 404, notify+upload NON chiamati, nessun doc ──
@pytest.mark.asyncio
async def test_documents_upload_cross_tenant_404_no_notify_no_upload(client, teacher_headers):
    db = get_db()
    with patch("routers.documents.notify_class", new_callable=AsyncMock) as nc, \
         patch("routers.documents.notify_role", new_callable=AsyncMock), \
         patch("routers.documents.upload_file", new_callable=AsyncMock) as up:
        r = await client.post("/api/documents/upload",
            data={"title": "CrossDoc", "classe_id": MM_CLASS},
            files={"file": ("x.pdf", b"data", "application/pdf")},
            headers=teacher_headers)
    assert r.status_code == 404
    nc.assert_not_called()
    up.assert_not_called()                            # assert_class PRIMA dell'upload
    assert await db.documents.find_one({"title": "CrossDoc"}) is None


# ── (e) get-by-id cross-tenant -> 404 (conferma FASE 0) ──
@pytest.mark.asyncio
async def test_documents_get_by_id_cross_tenant_404(client, admin_headers):
    r = await client.get("/api/documents/mm-doc-1", headers=admin_headers)
    assert r.status_code == 404


# ── (f) parent -> solo propria classe/sede; cross -> 404 (conferma FASE 0) ──
@pytest.mark.asyncio
async def test_parent_calendar_and_documents_scoped(client, parent_headers):
    r = await client.get("/api/calendar/events", headers=parent_headers)
    assert r.status_code == 200
    ids = {e["id"] for e in r.json()}
    assert "ggt-ev-1" in ids and "mm-ev-1" not in ids
    rd = await client.get("/api/documents/mm-doc-1", headers=parent_headers)
    assert rd.status_code == 404
