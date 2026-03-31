"""Tests for /api/auth endpoints."""
import pytest


@pytest.mark.asyncio
async def test_root(client):
    r = await client.get("/api/")
    assert r.status_code == 200
    assert "Girogirotondo" in r.json()["message"]


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    r = await client.post("/api/auth/login", json={"email": "no@no.it", "password": "wrong"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_and_me(client):
    # Seed user exists after startup
    r = await client.post(
        "/api/auth/login",
        json={"email": "admin@girogirotondo.it", "password": "admin123"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["user"]["role"] == "admin"

    token = data["token"]
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "admin@girogirotondo.it"
