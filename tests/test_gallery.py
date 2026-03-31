"""Tests for /api/gallery endpoints."""
import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_get_gallery_requires_auth(client):
    r = await client.get("/api/gallery")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_gallery(client, parent_headers):
    r = await client.get("/api/gallery", headers=parent_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_post_gallery_url(client, teacher_headers):
    r = await client.post(
        "/api/gallery",
        json={
            "class_id": "test-class",
            "student_ids": ["s1"],
            "media_url": "https://example.com/photo.jpg",
            "media_type": "photo",
            "caption": "Test foto",
        },
        headers=teacher_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["media_type"] == "photo"
    assert "id" in data


@pytest.mark.asyncio
async def test_publish_toggle(client, teacher_headers):
    # Create a media item first
    r = await client.post(
        "/api/gallery",
        json={
            "class_id": "test-class",
            "student_ids": [],
            "media_url": "https://example.com/x.jpg",
            "media_type": "photo",
        },
        headers=teacher_headers,
    )
    assert r.status_code == 201
    media_id = r.json()["id"]

    r2 = await client.post(f"/api/gallery/{media_id}/publish", headers=teacher_headers)
    assert r2.status_code == 200
    assert "published" in r2.json()


@pytest.mark.asyncio
async def test_delete_gallery(client, teacher_headers):
    r = await client.post(
        "/api/gallery",
        json={
            "class_id": "test-class",
            "student_ids": [],
            "media_url": "https://example.com/del.jpg",
            "media_type": "photo",
        },
        headers=teacher_headers,
    )
    media_id = r.json()["id"]

    with patch("routers.gallery.delete_file"):
        rd = await client.delete(f"/api/gallery/{media_id}", headers=teacher_headers)
    assert rd.status_code == 200
