"""Tests for /api/calendar/events endpoints."""
import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_get_events_requires_auth(client):
    r = await client.get("/api/calendar/events")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_create_and_get_event(client, teacher_headers):
    with patch("routers.calendar.notify_class", new_callable=AsyncMock), \
         patch("routers.calendar.notify_role", new_callable=AsyncMock):
        r = await client.post(
            "/api/calendar/events",
            json={
                "titolo": "Gita al parco",
                "descrizione": "Gita di primavera",
                "data_inizio": "2026-04-15",
                "tipo": "gita",
                "visibile_a": ["parent", "teacher"],
            },
            headers=teacher_headers,
        )
    assert r.status_code == 201
    event = r.json()
    assert event["titolo"] == "Gita al parco"
    assert "id" in event


@pytest.mark.asyncio
async def test_create_event_parent_forbidden(client, parent_headers):
    r = await client.post(
        "/api/calendar/events",
        json={"titolo": "Test", "data_inizio": "2026-04-15"},
        headers=parent_headers,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_upcoming_events(client, parent_headers):
    r = await client.get("/api/calendar/events/upcoming", headers=parent_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------------------------------------------------------------------------
# Tenant isolation (B0) — a parent sees only their own sede's events.
# ---------------------------------------------------------------------------

GGT_CLASS = "ggt-class-1"
MM_CLASS = "mm-class-1"


@pytest.mark.asyncio
async def test_parent_sees_only_own_sede_events(client, parent_headers):
    r = await client.get("/api/calendar/events", headers=parent_headers)
    assert r.status_code == 200
    ids = {e["id"] for e in r.json()}
    assert "ggt-ev-1" in ids            # own class
    assert "ggt-ev-sedewide" in ids     # own sede, sede-wide
    assert "mm-ev-1" not in ids         # other sede class
    assert "mm-ev-sedewide" not in ids  # other sede, sede-wide


@pytest.mark.asyncio
async def test_mm_parent_sees_only_mm_events(client, mm_parent_headers):
    r = await client.get("/api/calendar/events", headers=mm_parent_headers)
    assert r.status_code == 200
    ids = {e["id"] for e in r.json()}
    assert "mm-ev-1" in ids
    assert "ggt-ev-1" not in ids
    assert "ggt-ev-sedewide" not in ids


@pytest.mark.asyncio
async def test_parent_cannot_query_other_sede_class_events(client, parent_headers):
    r = await client.get(f"/api/calendar/events?classe_id={MM_CLASS}", headers=parent_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_superadmin_sees_all_events(client, super_headers):
    r = await client.get("/api/calendar/events", headers=super_headers)
    assert r.status_code == 200
    ids = {e["id"] for e in r.json()}
    assert {"ggt-ev-1", "mm-ev-1"} <= ids


@pytest.mark.asyncio
async def test_created_event_is_sede_tagged(client, teacher_headers):
    with patch("routers.calendar.notify_class", new_callable=AsyncMock), \
         patch("routers.calendar.notify_role", new_callable=AsyncMock):
        r = await client.post(
            "/api/calendar/events",
            json={
                "titolo": "Evento sede",
                "data_inizio": "2026-05-01",
                "classe_id": GGT_CLASS,
                "visibile_a": ["parent"],
            },
            headers=teacher_headers,
        )
    assert r.status_code == 201
    assert r.json()["sede_id"] == "girogirotondo"
