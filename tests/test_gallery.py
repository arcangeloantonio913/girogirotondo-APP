"""Tests for /api/gallery — including multi-tenant isolation & IDOR (B0 / area C+D).

Seed (see conftest):
  GGT: class ggt-class-1, student ggt-student-1, media ggt-media-1
  MM:  class mm-class-1,  student mm-student-1,  media mm-media-1
  teacher-test-id -> GGT class; parent-test-id -> GGT child; super-test-id -> all.
"""
import pytest
from unittest.mock import patch

# Must match the seed ids in conftest.py
GGT_CLASS = "ggt-class-1"
MM_CLASS = "mm-class-1"
GGT_STUDENT = "ggt-student-1"


# --- auth required ----------------------------------------------------------

@pytest.mark.asyncio
async def test_get_gallery_requires_auth(client):
    r = await client.get("/api/gallery")
    assert r.status_code == 401


# --- parent isolation -------------------------------------------------------

@pytest.mark.asyncio
async def test_parent_sees_only_own_child_media(client, parent_headers):
    r = await client.get("/api/gallery", headers=parent_headers)
    assert r.status_code == 200
    ids = {m["id"] for m in r.json()}
    assert "ggt-media-1" in ids
    assert "mm-media-1" not in ids


@pytest.mark.asyncio
async def test_parent_can_get_own_media_by_id(client, parent_headers):
    r = await client.get("/api/gallery/ggt-media-1", headers=parent_headers)
    assert r.status_code == 200
    assert r.json()["id"] == "ggt-media-1"


@pytest.mark.asyncio
async def test_parent_cannot_get_other_child_media_by_id(client, parent_headers):
    # IDOR fix (C2): another family's media must be 404, not 200.
    r = await client.get("/api/gallery/mm-media-1", headers=parent_headers)
    assert r.status_code == 404


# --- teacher / cross-tenant -------------------------------------------------

@pytest.mark.asyncio
async def test_teacher_unfiltered_returns_only_own_classes(client, teacher_headers):
    r = await client.get("/api/gallery", headers=teacher_headers)
    assert r.status_code == 200
    ids = {m["id"] for m in r.json()}
    assert "ggt-media-1" in ids
    assert "mm-media-1" not in ids  # must NOT leak the other school


@pytest.mark.asyncio
async def test_teacher_cannot_query_other_school_class(client, teacher_headers):
    r = await client.get(f"/api/gallery?class_id={MM_CLASS}", headers=teacher_headers)
    assert r.status_code == 404  # assert_class denies cross-tenant class


@pytest.mark.asyncio
async def test_teacher_cannot_get_other_school_media_by_id(client, teacher_headers):
    r = await client.get("/api/gallery/mm-media-1", headers=teacher_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_teacher_upload_to_own_class_ok(client, teacher_headers):
    r = await client.post(
        "/api/gallery",
        json={
            "class_id": GGT_CLASS,
            "student_ids": [GGT_STUDENT],
            "media_url": "https://example.com/photo.jpg",
            "media_type": "photo",
            "caption": "Test foto",
        },
        headers=teacher_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["sede_id"] == "girogirotondo"          # sede stamped from class
    assert data["student_ids"] == [GGT_STUDENT]        # filtered to in-class students


@pytest.mark.asyncio
async def test_teacher_cannot_upload_to_other_school_class(client, teacher_headers):
    # cross-tenant write must be blocked (C10)
    r = await client.post(
        "/api/gallery",
        json={
            "class_id": MM_CLASS,
            "student_ids": ["mm-student-1"],
            "media_url": "https://example.com/evil.jpg",
            "media_type": "photo",
        },
        headers=teacher_headers,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_teacher_cannot_delete_other_school_media(client, teacher_headers):
    with patch("routers.gallery.delete_file"):
        r = await client.delete("/api/gallery/mm-media-1", headers=teacher_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_teacher_cannot_publish_other_school_media(client, teacher_headers):
    r = await client.post("/api/gallery/mm-media-1/publish", headers=teacher_headers)
    assert r.status_code == 404


# --- superadmin all-access --------------------------------------------------

@pytest.mark.asyncio
async def test_superadmin_sees_both_schools(client, super_headers):
    r = await client.get("/api/gallery", headers=super_headers)
    assert r.status_code == 200
    ids = {m["id"] for m in r.json()}
    assert {"ggt-media-1", "mm-media-1"} <= ids
