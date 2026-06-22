"""Gallery router — upload to Firebase Storage, signed URLs, publish, delete.

Tenant isolation: every endpoint is scoped via get_tenant_context.
- Parents see only their own children's media.
- Teachers/admins are limited to their assigned classes / their sede.
- Superadmin has all-access.
Denied object access returns 404 (not 403) so ids cannot be probed.
"""
import re
import uuid
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

from services.database import get_db
from models.gallery import MediaUpload
from middleware.auth import get_tenant_context, TenantContext, _resolve_class
from middleware.rate_limiter import limiter
from utils.storage_helper import upload_file, get_signed_url, delete_file, generate_thumbnail
from utils.push_notifications import notify_class
try:
    from utils.expo_push import notify_parents_of_class as expo_notify_class
except: expo_notify_class = None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gallery", tags=["gallery"])


def _refresh_signed_url(item: dict) -> dict:
    """Replace storage_path with fresh signed URL if available."""
    if item.get("storage_path"):
        try:
            item["media_url"] = get_signed_url(item["storage_path"])
        except Exception:
            pass
    if item.get("thumbnail_path"):
        try:
            item["thumbnail_url"] = get_signed_url(item["thumbnail_path"])
        except Exception:
            pass
    return item


async def _class_sede(db, class_id: str) -> Optional[str]:
    cls = await _resolve_class(db, class_id)
    return cls.get("sede_id") if cls else None


async def _students_in_class(db, class_id: str, student_ids: list) -> list:
    """Keep only the provided student_ids that actually belong to class_id."""
    if not student_ids:
        return []
    rows = await db.students.find(
        {"id": {"$in": list(student_ids)}, "class_id": class_id}, {"_id": 0, "id": 1}
    ).to_list(500)
    return [r["id"] for r in rows]


@router.get("")
async def get_gallery(
    class_id: Optional[str] = None,
    student_id: Optional[str] = None,
    media_type: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 24,       # max foto per richiesta — evita risposta da centinaia di MB
    offset: int = 0,       # paginazione
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()
    query: dict = {}

    # ── Parent isolation ──────────────────────────────────────────────────────
    if ctx.role == "parent":
        allowed = ctx.allowed_student_ids
        if not allowed:
            return []
        if student_id:
            if student_id not in allowed:
                raise HTTPException(status_code=404, detail="Risorsa non trovata")
            query["student_ids"] = student_id
        else:
            query["student_ids"] = {"$in": list(allowed)}
    else:
        # ── Staff: scope to caller's classes/sede ─────────────────────────────
        if class_id:
            ctx.assert_class(class_id)
            query["class_id"] = class_id
        else:
            query.update(ctx.class_filter())
        if student_id:
            await ctx.assert_student(student_id)
            query["student_ids"] = student_id

    if media_type:
        query["media_type"] = media_type
    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["created_at"] = {"$regex": f"^{date}"}

    limit  = max(1, min(limit, 50))   # hard cap 50 per richiesta
    items  = await db.gallery.find(query, {"_id": 0}) \
        .sort("created_at", -1) \
        .skip(offset) \
        .to_list(limit)
    return [_refresh_signed_url(i) for i in items]


@router.get("/{media_id}")
async def get_media(media_id: str, ctx: TenantContext = Depends(get_tenant_context)):
    db = get_db()
    item = await db.gallery.find_one({"id": media_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Media non trovato")

    # ── Object-level authorization ───────────────────────────────────────────
    if ctx.role == "parent":
        if not (set(item.get("student_ids") or []) & ctx.allowed_student_ids):
            raise HTTPException(status_code=404, detail="Media non trovato")
    else:
        ctx.assert_class(item.get("class_id"))

    return _refresh_signed_url(item)


# ---------------------------------------------------------------------------
# POST /api/gallery/upload  — multipart file upload → Firebase Storage
# ---------------------------------------------------------------------------

@router.post("/upload", status_code=201)
@limiter.limit("60/minute")
async def upload_media_file(
    request: Request,
    class_id: str = Form(...),
    student_ids: str = Form(...),   # comma-separated IDs
    media_type: str = Form(...),    # photo | video
    caption: str = Form(""),
    tags: str = Form(""),           # comma-separated
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(get_tenant_context),
):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    # Caller must own the target class (sede/class scoping)
    ctx.assert_class(class_id)
    db = get_db()
    sede_id = await _class_sede(db, class_id)

    requested = [s.strip() for s in student_ids.split(",") if s.strip()]
    valid_student_ids = await _students_in_class(db, class_id, requested)

    file_bytes = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    ext = re.sub(r"[^A-Za-z0-9]", "", ext) or "bin"   # sanitize: no path traversal via filename
    media_id = str(uuid.uuid4())
    storage_path = f"gallery/{class_id}/{media_id}.{ext}"

    signed_url, path = await upload_file(
        file_bytes, storage_path, file.content_type, media_type
    )

    thumbnail_url = None
    thumbnail_path = None
    if media_type == "photo":
        thumb_bytes = generate_thumbnail(file_bytes)
        if thumb_bytes:
            thumb_path = f"gallery/{class_id}/thumbs/{media_id}.{ext}"
            thumbnail_url, thumbnail_path = await upload_file(
                thumb_bytes, thumb_path, file.content_type, "photo"
            )

    doc = {
        "id": media_id,
        "class_id": class_id,
        "sede_id": sede_id,
        "student_ids": valid_student_ids,
        "media_url": signed_url,
        "thumbnail_url": thumbnail_url,
        "storage_path": path,
        "thumbnail_path": thumbnail_path,
        "media_type": media_type,
        "caption": caption,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "uploaded_by": ctx.user_id,
        "published": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.gallery.insert_one(doc)
    doc.pop("_id", None)

    # Auto-notify parents of this class
    await notify_class(
        db, class_id, ["parent"],
        title="Nuova foto pubblicata!",
        body=caption or "La maestra ha pubblicato una nuova foto.",
        data={"type": "gallery", "media_id": media_id},
    )

    return doc


# ---------------------------------------------------------------------------
# POST /api/gallery/upload-b64  — upload JSON+base64 (bypassa multipart)
# ---------------------------------------------------------------------------

@router.post("/upload-b64", status_code=201)
@limiter.limit("60/minute")
async def upload_media_base64(
    request: Request,
    payload: dict,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Endpoint alternativo a /upload. Accetta JSON con:
      media_url: string base64 data URL (es. "data:image/jpeg;base64,...")
      class_id, student_ids (list), media_type, caption
    Non richiede multipart — elimina problemi CORS/parsing.
    """
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    media_url   = payload.get("media_url", "")
    class_id    = payload.get("class_id", "")
    student_ids = payload.get("student_ids", [])
    media_type  = payload.get("media_type", "photo")
    caption     = payload.get("caption", "")

    if not media_url or not class_id:
        raise HTTPException(status_code=400, detail="media_url e class_id obbligatori")

    # Caller must own the target class
    ctx.assert_class(class_id)

    # Limite dimensione: data URL max 12MB (MongoDB document limit 16MB)
    if len(media_url) > 12 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File troppo grande (max ~9MB). Usa una foto più piccola."
        )

    # student_ids può arrivare come lista o stringa CSV
    if isinstance(student_ids, str):
        student_ids = [s.strip() for s in student_ids.split(",") if s.strip()]

    db = get_db()
    sede_id = await _class_sede(db, class_id)
    valid_student_ids = await _students_in_class(db, class_id, student_ids)
    media_id = str(uuid.uuid4())
    doc = {
        "id":            media_id,
        "class_id":      class_id,
        "sede_id":       sede_id,
        "student_ids":   valid_student_ids,
        "media_url":     media_url,
        "thumbnail_url": None,
        "storage_path":  None,
        "thumbnail_path":None,
        "media_type":    media_type,
        "caption":       caption,
        "tags":          [],
        "uploaded_by":   ctx.user_id,
        "published":     True,
        "created_at":    datetime.now(timezone.utc).isoformat(),
    }
    await db.gallery.insert_one(doc)
    doc.pop("_id", None)

    await notify_class(
        db, class_id, ["parent"],
        title="Nuova foto pubblicata!",
        body=caption or "La maestra ha pubblicato una nuova foto.",
        data={"type": "gallery", "media_id": media_id},
    )
    return doc


# ---------------------------------------------------------------------------
# POST /api/gallery  — backward-compat: save URL directly (no file upload)
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def upload_media_url(
    payload: MediaUpload,
    ctx: TenantContext = Depends(get_tenant_context),
):
    # Solo admin e maestre possono aggiungere media
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    doc = payload.model_dump()
    # Caller must own the target class
    ctx.assert_class(doc.get("class_id"))
    doc["sede_id"] = await _class_sede(db, doc.get("class_id"))
    doc["student_ids"] = await _students_in_class(db, doc.get("class_id"), doc.get("student_ids") or [])
    doc["id"] = str(uuid.uuid4())
    doc["uploaded_by"] = ctx.user_id
    doc["thumbnail_url"] = None
    doc["storage_path"] = None
    doc["thumbnail_path"] = None
    doc["published"] = True
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.gallery.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# POST /api/gallery/{media_id}/publish  — toggle visibility
# ---------------------------------------------------------------------------

@router.post("/{media_id}/publish")
async def publish_media(media_id: str, ctx: TenantContext = Depends(get_tenant_context)):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    item = await db.gallery.find_one({"id": media_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Media non trovato")
    ctx.assert_class(item.get("class_id"))   # object-level / cross-tenant check

    new_state = not item.get("published", True)
    await db.gallery.update_one({"id": media_id}, {"$set": {"published": new_state}})
    return {"id": media_id, "published": new_state}


# ---------------------------------------------------------------------------
# DELETE /api/gallery/{media_id}
# ---------------------------------------------------------------------------

@router.delete("/{media_id}")
async def delete_media(media_id: str, ctx: TenantContext = Depends(get_tenant_context)):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    item = await db.gallery.find_one({"id": media_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Media non trovato")
    ctx.assert_class(item.get("class_id"))   # object-level / cross-tenant check

    delete_file(item.get("storage_path"))
    delete_file(item.get("thumbnail_path"))
    await db.gallery.delete_one({"id": media_id})
    return {"message": "Media eliminato"}
