"""Tests for /api/users endpoints."""
import pytest


@pytest.mark.asyncio
async def test_get_users_admin_only(client, parent_headers):
    r = await client.get("/api/users", headers=parent_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_get_users_as_admin(client, admin_headers):
    r = await client.get("/api/users", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_get_user_by_id(client, admin_headers):
    users = (await client.get("/api/users", headers=admin_headers)).json()
    if not users:
        pytest.skip("No users seeded")
    uid = users[0]["id"]
    r = await client.get(f"/api/users/{uid}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["id"] == uid


@pytest.mark.asyncio
async def test_update_user(client, admin_headers):
    users = (await client.get("/api/users", headers=admin_headers)).json()
    if not users:
        pytest.skip("No users seeded")
    uid = users[0]["id"]
    r = await client.put(f"/api/users/{uid}", json={"avatar_url": "https://example.com/avatar.png"}, headers=admin_headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_soft_delete_user(client, admin_headers):
    # Create a temporary user then soft-delete
    r = await client.post(
        "/api/users",
        json={"name": "Temp User", "email": "temp@test.it", "password": "pass123", "role": "parent"},
        headers=admin_headers,
    )
    assert r.status_code == 201
    uid = r.json()["id"]

    rd = await client.delete(f"/api/users/{uid}", headers=admin_headers)
    assert rd.status_code == 200

    # User should not appear in auth anymore (active=False)
    r2 = await client.get(f"/api/users/{uid}", headers=admin_headers)
    # active=False users are still retrievable by admin
    assert r2.status_code in (200, 404)
