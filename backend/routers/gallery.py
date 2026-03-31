"""Gallery router — upload to Firebase Storage, signed URLs, publish, delete."""
import uuid
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request

from services.database import get_db
from models.gallery import MediaUpload
from middleware.auth import get_current_user
from middleware.rate_limiter import limiter
from utils.storage_helper import upload_file, get_signed_url, delete_file, generate_thumbnail
from utils.push_notifications import notify_class

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


@router.get("")
async def get_gallery(
    class_id: Optional[str] = None,
    student_id: Optional[str] = None,
    media_type: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if class_id:
        query["class_id"] = class_id
    if student_id:
        query["student_ids"] = student_id
    if media_type:
        query["media_type"] = media_type
    if date:
        query["created_at"] = {"$regex": f"^{date}"}

    items = await db.gallery.find(query, {"_id": 0}).to_list(1000)
    return [_refresh_signed_url(i) for i in items]


@router.get("/{media_id}")
async def get_media(media_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    item = await db.gallery.find_one({"id": media_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Media non trovato")
    return _refresh_signed_url(item)


# ---------------------------------------------------------------------------
# POST /api/gallery/upload  — multipart file upload → Firebase Storage
# ---------------------------------------------------------------------------

@router.post("/upload", status_code=201)
@limiter.limit("10/minute")
async def upload_media_file(
    request: Request,
    class_id: str = Form(...),
    student_ids: str = Form(...),   # comma-separated IDs
    media_type: str = Form(...),    # photo | video
    caption: str = Form(""),
    tags: str = Form(""),           # comma-separated
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    file_bytes = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
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

    db = get_db()
    doc = {
        "id": media_id,
        "class_id": class_id,
        "student_ids": [s.strip() for s in student_ids.split(",") if s.strip()],
        "media_url": signed_url,
        "thumbnail_url": thumbnail_url,
        "storage_path": path,
        "thumbnail_path": thumbnail_path,
        "media_type": media_type,
        "caption": caption,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "uploaded_by": current_user["id"],
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
# POST /api/gallery  — backward-compat: save URL directly (no file upload)
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def upload_media_url(
    payload: MediaUpload,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["uploaded_by"] = current_user.get("id", "")
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
async def publish_media(media_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    item = await db.gallery.find_one({"id": media_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Media non trovato")

    new_state = not item.get("published", True)
    await db.gallery.update_one({"id": media_id}, {"$set": {"published": new_state}})
    return {"id": media_id, "published": new_state}


# ---------------------------------------------------------------------------
# DELETE /api/gallery/{media_id}
# ---------------------------------------------------------------------------

@router.delete("/{media_id}")
async def delete_media(media_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    item = await db.gallery.find_one({"id": media_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Media non trovato")

    delete_file(item.get("storage_path"))
    delete_file(item.get("thumbnail_path"))
    await db.gallery.delete_one({"id": media_id})
    return {"message": "Media eliminato"}
