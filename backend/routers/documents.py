"""Documents router — upload to Firebase Storage, signed URLs, categories."""
import re
import uuid
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Header

from services.database import get_db
from models.documents import DocumentCreate, DocumentCategory
from middleware.auth import get_tenant_context, TenantContext
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


_DATE_RE_DOCS = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_VALID_CATEGORIES = {"circolari", "autorizzazioni", "modulistica", "altro"}


def _tenant_scope(ctx: TenantContext) -> dict:
    """Mongo fragment: documents for one of the caller's classes, OR sede-wide
    documents (no class) belonging to one of the caller's sedi. Superadmin is
    all-access and never calls this."""
    return {"$or": [
        {"classe_id": {"$in": list(ctx.allowed_class_ids)}},
        {"classe_id": {"$in": [None, ""]}, "sede_id": {"$in": list(ctx.sede_ids)}},
    ]}


def _assert_doc_visible(ctx: TenantContext, doc: dict) -> None:
    """404 (not 403) unless the document is within the caller's tenant scope."""
    if ctx.all_access:
        return
    classe_id = doc.get("classe_id")
    if classe_id:
        if classe_id in ctx.allowed_class_ids:
            return
    elif doc.get("sede_id") in ctx.sede_ids:
        return
    raise HTTPException(status_code=404, detail="Documento non trovato")


async def _resolve_doc_sede(db, classe_id, current_user, x_sede_id):
    """Sede a new document belongs to: the class's sede if class-targeted, else
    the uploader's own sede, else the admin-supplied X-Sede-Id header."""
    if classe_id:
        cls = await db.classes.find_one({"id": classe_id}, {"_id": 0, "sede_id": 1})
        if cls and cls.get("sede_id"):
            return cls["sede_id"]
    return current_user.get("sede_id") or (x_sede_id or None)


@router.get("")
async def get_documents(
    classe_id: Optional[str] = None,
    categoria: Optional[str] = None,
    date: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()
    query: dict = {}
    if categoria:
        # Whitelist categoria per evitare injection
        if categoria not in _VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail="Categoria non valida")
        query["categoria"] = categoria
    if date:
        if not _DATE_RE_DOCS.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["created_at"] = {"$regex": f"^{date}"}

    # ── Tenant isolation ──────────────────────────────────────────────────────
    if classe_id:
        if not ctx.all_access:
            ctx.assert_class(classe_id)   # 404 if caller doesn't own this class
        query["classe_id"] = classe_id
    elif not ctx.all_access:
        query.update(_tenant_scope(ctx))

    docs = await db.documents.find(query, {"_id": 0}).to_list(100)
    return [_refresh_url(d) for d in docs]


@router.get("/{doc_id}")
async def get_document(doc_id: str, ctx: TenantContext = Depends(get_tenant_context)):
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    _assert_doc_visible(ctx, doc)   # cross-tenant IDOR guard (404 on denial)
    return _refresh_url(doc)


# ---------------------------------------------------------------------------
# POST /api/documents/upload  — multipart file upload → Firebase Storage
# ---------------------------------------------------------------------------

@router.post("/upload", status_code=201)
async def upload_document_file(
    title: str = Form(...),
    description: str = Form(""),
    categoria: DocumentCategory = Form(DocumentCategory.altro),
    classe_id: str = Form(""),
    scadenza: str = Form(""),
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(get_tenant_context),
    x_sede_id: Optional[str] = Header(None),
):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    # Cross-tenant create protection: PRIMA di caricare il file / creare / notificare.
    if classe_id:
        ctx.assert_class(classe_id)   # 404 se la classe è di un'altra sede

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
        "sede_id": await _resolve_doc_sede(db, classe_id or None, ctx.user, x_sede_id),
        "uploader_id": ctx.user_id,
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
# POST /api/documents/upload-b64  — upload JSON+base64 (bypassa multipart)
# ---------------------------------------------------------------------------

@router.post("/upload-b64", status_code=201)
async def upload_document_base64(
    payload: dict,
    ctx: TenantContext = Depends(get_tenant_context),
    x_sede_id: Optional[str] = Header(None),
):
    """
    Alternativa a /upload. Accetta JSON con:
      file_b64: string base64 del file
      file_type: MIME type (es. "application/pdf")
      title, description, categoria, classe_id, scadenza
    """
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    file_b64  = payload.get("file_b64", "")
    file_type = payload.get("file_type", "application/octet-stream")
    title     = payload.get("title", "").strip()

    if not file_b64 or not title:
        raise HTTPException(status_code=400, detail="file_b64 e title obbligatori")

    classe_id = payload.get("classe_id") or None
    if classe_id:
        ctx.assert_class(classe_id)   # 404 se la classe è di un'altra sede — PRIMA di creare

    # Costruisci data URL
    file_url = f"data:{file_type};base64,{file_b64}"

    db = get_db()
    doc_id = str(uuid.uuid4())
    doc = {
        "id":          doc_id,
        "title":       title,
        "description": payload.get("description", ""),
        "file_url":    file_url,
        "storage_path":None,
        "categoria":   payload.get("categoria", "modulistica"),
        "classe_id":   classe_id,
        "sede_id":     await _resolve_doc_sede(db, classe_id, ctx.user, x_sede_id),
        "uploader_id": ctx.user_id,
        "scadenza":    payload.get("scadenza") or None,
        "created_at":  datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# POST /api/documents  — backward-compat: save URL directly
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_document(
    payload: DocumentCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    x_sede_id: Optional[str] = Header(None),
):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    doc = payload.model_dump()
    if doc.get("classe_id"):
        ctx.assert_class(doc["classe_id"])   # 404 se la classe è di un'altra sede
    doc["id"] = str(uuid.uuid4())
    doc["storage_path"] = None
    doc["sede_id"] = await _resolve_doc_sede(db, doc.get("classe_id"), ctx.user, x_sede_id)
    doc["uploader_id"] = ctx.user_id
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, ctx: TenantContext = Depends(get_tenant_context)):
    if ctx.role != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eliminare documenti")
    db = get_db()
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    _assert_doc_visible(ctx, doc)   # 404 cross-tenant PRIMA di distruggere file+riga+read_receipts

    delete_file(doc.get("storage_path"))
    await db.documents.delete_one({"id": doc_id})
    await db.read_receipts.delete_many({"document_id": doc_id})
    return {"message": "Documento eliminato"}
