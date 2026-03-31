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
