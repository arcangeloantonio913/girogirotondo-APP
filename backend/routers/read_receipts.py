"""Read receipts router — mark documents as read, count unread."""
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from services.database import get_db
from models.documents import ReadReceiptCreate
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/read-receipts", tags=["read-receipts"])


@router.get("")
async def get_read_receipts(
    document_id: Optional[str] = None,
    parent_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if document_id:
        query["document_id"] = document_id
    if parent_id:
        query["parent_id"] = parent_id
    elif current_user.get("role") == "parent":
        query["parent_id"] = current_user.get("id")
    receipts = await db.read_receipts.find(query, {"_id": 0}).to_list(1000)
    return receipts


@router.post("", status_code=201)
async def create_read_receipt(
    payload: ReadReceiptCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    existing = await db.read_receipts.find_one(
        {"document_id": payload.document_id, "parent_id": payload.parent_id}
    )
    if existing:
        existing.pop("_id", None)
        return existing

    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    await db.read_receipts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/unread")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Returns count of documents NOT yet acknowledged by the current user."""
    db = get_db()
    parent_id = current_user.get("id")
    if not parent_id:
        return {"unread": 0}

    total_docs = await db.documents.count_documents({})
    read_count = await db.read_receipts.count_documents({"parent_id": parent_id})
    unread = max(0, total_docs - read_count)
    return {"unread": unread, "total": total_docs, "read": read_count}
