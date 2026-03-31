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
