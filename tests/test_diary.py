"""Tests for /api/diary — multi-tenant isolation & cross-tenant write (B0 router 2/11)."""
import pytest

GGT_CLASS = "ggt-class-1"
MM_CLASS = "mm-class-1"


@pytest.mark.asyncio
async def test_diary_requires_auth(client):
    r = await client.get("/api/diary")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_parent_sees_only_own_class_diary(client, parent_headers):
    r = await client.get("/api/diary", headers=parent_headers)
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()}
    assert "ggt-diary-1" in ids
    assert "mm-diary-1" not in ids


@pytest.mark.asyncio
async def test_teacher_unfiltered_only_own_classes(client, teacher_headers):
    r = await client.get("/api/diary", headers=teacher_headers)
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()}
    assert "ggt-diary-1" in ids
    assert "mm-diary-1" not in ids


@pytest.mark.asyncio
async def test_teacher_cannot_query_other_school_class(client, teacher_headers):
    r = await client.get(f"/api/diary?class_id={MM_CLASS}", headers=teacher_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_teacher_create_own_class_ok(client, teacher_headers):
    r = await client.post(
        "/api/diary",
        json={"class_id": GGT_CLASS, "date": "2026-02-01", "summary": "Bella giornata"},
        headers=teacher_headers,
    )
    assert r.status_code == 201
    assert r.json()["sede_id"] == "girogirotondo"


@pytest.mark.asyncio
async def test_teacher_cannot_create_for_other_school_class(client, teacher_headers):
    r = await client.post(
        "/api/diary",
        json={"class_id": MM_CLASS, "date": "2026-02-01", "summary": "intrusione"},
        headers=teacher_headers,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_parent_cannot_write_diary(client, parent_headers):
    r = await client.post(
        "/api/diary",
        json={"class_id": GGT_CLASS, "date": "2026-02-01", "summary": "x"},
        headers=parent_headers,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_superadmin_sees_both_schools(client, super_headers):
    r = await client.get("/api/diary", headers=super_headers)
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()}
    assert {"ggt-diary-1", "mm-diary-1"} <= ids
