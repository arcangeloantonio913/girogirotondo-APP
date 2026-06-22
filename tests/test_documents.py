"""Tests for /api/documents and /api/read-receipts endpoints."""
import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_get_documents_requires_auth(client):
    r = await client.get("/api/documents")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_documents(client, parent_headers):
    r = await client.get("/api/documents", headers=parent_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_create_document(client, admin_headers):
    r = await client.post(
        "/api/documents",
        json={
            "title": "Circolare Test",
            "description": "Descrizione test",
            "file_url": "https://example.com/test.pdf",
            "categoria": "circolari",
        },
        headers=admin_headers,
    )
    assert r.status_code == 201
    assert r.json()["title"] == "Circolare Test"


@pytest.mark.asyncio
async def test_read_receipts_unread(client, parent_headers):
    r = await client.get("/api/read-receipts/unread", headers=parent_headers)
    assert r.status_code == 200
    assert "unread" in r.json()


@pytest.mark.asyncio
async def test_create_read_receipt(client, parent_headers):
    # First get a document ID
    docs = await client.get("/api/documents", headers=parent_headers)
    if not docs.json():
        pytest.skip("No documents to acknowledge")

    doc_id = docs.json()[0]["id"]
    r = await client.post(
        "/api/read-receipts",
        json={"document_id": doc_id, "parent_id": "parent-test-id"},
        headers=parent_headers,
    )
    assert r.status_code in (200, 201)


# ---------------------------------------------------------------------------
# Tenant isolation (B0) — a parent sees only their own sede's documents.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_parent_sees_only_own_sede_documents(client, parent_headers):
    r = await client.get("/api/documents", headers=parent_headers)
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()}
    assert "ggt-doc-1" in ids            # own class
    assert "ggt-doc-sedewide" in ids     # own sede, sede-wide
    assert "mm-doc-1" not in ids         # other sede class
    assert "mm-doc-sedewide" not in ids  # other sede, sede-wide


@pytest.mark.asyncio
async def test_mm_parent_sees_only_mm_documents(client, mm_parent_headers):
    r = await client.get("/api/documents", headers=mm_parent_headers)
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()}
    assert "mm-doc-1" in ids
    assert "ggt-doc-1" not in ids
    assert "ggt-doc-sedewide" not in ids


@pytest.mark.asyncio
async def test_parent_cannot_read_other_sede_document_by_id(client, parent_headers):
    # Pure IDOR check: knowing the id of another sede's document must 404.
    r = await client.get("/api/documents/mm-doc-1", headers=parent_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_parent_can_read_own_document_by_id(client, parent_headers):
    r = await client.get("/api/documents/ggt-doc-1", headers=parent_headers)
    assert r.status_code == 200
    assert r.json()["id"] == "ggt-doc-1"


@pytest.mark.asyncio
async def test_parent_cannot_query_other_sede_class(client, parent_headers):
    r = await client.get(f"/api/documents?classe_id={'mm-class-1'}", headers=parent_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_superadmin_sees_all_documents(client, super_headers):
    r = await client.get("/api/documents", headers=super_headers)
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()}
    assert {"ggt-doc-1", "mm-doc-1"} <= ids


@pytest.mark.asyncio
async def test_created_document_is_sede_tagged(client, admin_headers):
    r = await client.post(
        "/api/documents",
        json={
            "title": "Doc con sede",
            "description": "x",
            "file_url": "https://example.com/x.pdf",
            "categoria": "circolari",
            "classe_id": "ggt-class-1",
        },
        headers=admin_headers,
    )
    assert r.status_code == 201
    assert r.json()["sede_id"] == "girogirotondo"
