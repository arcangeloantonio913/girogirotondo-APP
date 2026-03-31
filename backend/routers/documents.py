"""Documents router — upload to Firebase Storage, signed URLs, categories."""
import uuid
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request

from services.database import get_db
from models.documents import DocumentCreate, DocumentCategory
from middleware.auth import get_current_user
from middleware.rate_limiter import limiter
from utils.storage_helper import upload_file, get_signed_url, delete_file
from utils.push_notifications import notify_class, notify_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])


def _refresh_url(doc: dict) -> dict:
    if doc.get("storage_path"):
        try:
            doc["file_url"] = get_signed_url(doc["storage_path"])
        except Exception:
            pass
    return doc


@router.get("")
async def get_documents(
    classe_id: Optional[str] = None,
    categoria: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if classe_id:
        query["classe_id"] = classe_id
    if categoria:
        query["categoria"] = categoria
    if date:
        query["created_at"] = {"$regex": f"^{date}"}

    docs = await db.documents.find(query, {"_id": 0}).to_list(100)
    return [_refresh_url(d) for d in docs]


@router.get("/{doc_id}")
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    return _refresh_url(doc)


# ---------------------------------------------------------------------------
# POST /api/documents/upload  — multipart file upload → Firebase Storage
# ---------------------------------------------------------------------------

@router.post("/upload", status_code=201)
@limiter.limit("20/minute")
async def upload_document_file(
    request: Request,
    title: str = Form(...),
    description: str = Form(""),
    categoria: DocumentCategory = Form(DocumentCategory.altro),
    classe_id: str = Form(""),
    scadenza: str = Form(""),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    file_bytes = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    doc_id = str(uuid.uuid4())
    storage_path = f"documents/{doc_id}.{ext}"

    signed_url, path = await upload_file(
        file_bytes, storage_path, file.content_type, "photo"  # size-checked as photo (10MB)
    )

    db = get_db()
    doc = {
        "id": doc_id,
        "title": title,
        "description": description,
        "file_url": signed_url,
        "storage_path": path,
        "categoria": categoria,
        "classe_id": classe_id or None,
        "uploader_id": current_user["id"],
        "scadenza": scadenza or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(doc)
    doc.pop("_id", None)

    # Auto-notify parents of affected class (or all parents)
    if classe_id:
        await notify_class(
            db, classe_id, ["parent"],
            title="Nuovo documento disponibile",
            body=title,
            data={"type": "document", "doc_id": doc_id},
        )
    else:
        await notify_role(
            db, "parent",
            title="Nuovo documento disponibile",
            body=title,
            data={"type": "document", "doc_id": doc_id},
        )

    return doc


# ---------------------------------------------------------------------------
# POST /api/documents  — backward-compat: save URL directly
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_document(
    payload: DocumentCreate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["storage_path"] = None
    doc["uploader_id"] = current_user.get("id")
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eliminare documenti")
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    delete_file(doc.get("storage_path"))
    await db.documents.delete_one({"id": doc_id})
    await db.read_receipts.delete_many({"document_id": doc_id})
    return {"message": "Documento eliminato"}
