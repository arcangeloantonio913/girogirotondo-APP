"""Tests for /api/notifications endpoints."""
import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_register_token_requires_auth(client):
    r = await client.post("/api/notifications/register-token", json={"token": "abc"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_register_token(client, parent_headers):
    r = await client.post(
        "/api/notifications/register-token",
        json={"token": "test-fcm-token-xyz", "device_type": "android"},
        headers=parent_headers,
    )
    assert r.status_code in (200, 201)


@pytest.mark.asyncio
async def test_send_notification_admin_only(client, parent_headers):
    r = await client.post(
        "/api/notifications/send",
        json={"title": "Test", "body": "Hello", "roles": ["parent"]},
        headers=parent_headers,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_send_notification_admin(client, admin_headers):
    with patch("utils.push_notifications.send_multicast", return_value=0):
        r = await client.post(
            "/api/notifications/send",
            json={"title": "Test", "body": "Hello", "roles": ["parent"]},
            headers=admin_headers,
        )
    assert r.status_code == 200
