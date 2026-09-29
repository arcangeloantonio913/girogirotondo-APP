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


# --- MIME fix (foto Android non visibili su iPhone) --------------------------

# PNG 1x1 valido (magic bytes \x89PNG...)
_PNG_1x1_B64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
                "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


def test_fix_data_url_mime_corrects_png_labeled_jpeg():
    from routers.gallery import _fix_data_url_mime, _sniff_image_mime
    import base64
    assert _sniff_image_mime(base64.b64decode(_PNG_1x1_B64)) == "image/png"
    # PNG erroneamente etichettato come jpeg (come fa l'app Android) → corretto
    fixed = _fix_data_url_mime(f"data:image/jpeg;base64,{_PNG_1x1_B64}")
    assert fixed.startswith("data:image/png;base64,")
    # jpeg vero resta jpeg (nessuna modifica spuria)
    jpeg = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0abcdefghijkl").decode()
    assert _fix_data_url_mime(jpeg) == jpeg


@pytest.mark.asyncio
async def test_upload_b64_corrects_android_mime(client, teacher_headers):
    """Una foto PNG etichettata jpeg (bug app Android) va salvata come image/png,
    così iPhone la visualizza."""
    r = await client.post(
        "/api/gallery/upload-b64",
        json={
            "class_id": GGT_CLASS,
            "student_ids": [GGT_STUDENT],
            "media_type": "photo",
            "caption": "test",
            "media_url": f"data:image/jpeg;base64,{_PNG_1x1_B64}",
        },
        headers=teacher_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["media_url"].startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_upload_b64_empty_student_ids_ok(client, teacher_headers):
    """Upload senza selezionare bambini (foto di gruppo) deve riuscire, non bloccarsi."""
    r = await client.post(
        "/api/gallery/upload-b64",
        json={
            "class_id": GGT_CLASS,
            "student_ids": [],
            "media_type": "photo",
            "caption": "gruppo",
            "media_url": f"data:image/png;base64,{_PNG_1x1_B64}",
        },
        headers=teacher_headers,
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_list_serves_thumbnail_in_media_url_for_old_apps(client, teacher_headers):
    """La lista deve mettere la THUMBNAIL in media_url (le app vecchie leggono quel campo)
    e marcare has_full, così le foto non risultano vuote sul telefono."""
    up = await client.post(
        "/api/gallery/upload-b64",
        json={"class_id": GGT_CLASS, "student_ids": [GGT_STUDENT], "media_type": "photo",
              "caption": "x", "media_url": f"data:image/png;base64,{_PNG_1x1_B64}"},
        headers=teacher_headers,
    )
    assert up.status_code == 201, up.text
    r = await client.get(f"/api/gallery?class_id={GGT_CLASS}", headers=teacher_headers)
    assert r.status_code == 200
    withthumb = [m for m in r.json() if m.get("thumbnail_url")]
    assert withthumb, "atteso almeno un media con thumbnail"
    for m in withthumb:
        assert m["media_url"] == m["thumbnail_url"]   # niente più media_url=None → foto visibile
        assert m.get("has_full") is True              # i client aggiornati sanno di poter scaricare il full
