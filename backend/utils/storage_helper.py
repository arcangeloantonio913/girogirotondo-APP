"""Firebase Storage helpers: upload, signed URLs, delete."""
import io
import logging
import mimetypes
from datetime import timedelta, datetime, timezone
from typing import Optional, Tuple

from utils.firebase_client import get_bucket, is_initialized

logger = logging.getLogger(__name__)

MAX_PHOTO_BYTES = 10 * 1024 * 1024   # 10 MB
MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB


def _check_size(data: bytes, media_type: str):
    limit = MAX_VIDEO_BYTES if media_type == "video" else MAX_PHOTO_BYTES
    label = "100 MB" if media_type == "video" else "10 MB"
    if len(data) > limit:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=413,
            detail=f"File troppo grande. Limite: {label}",
        )


async def upload_file(
    file_bytes: bytes,
    destination_path: str,
    content_type: Optional[str] = None,
    media_type: str = "photo",
) -> Tuple[str, str]:
    """
    Upload bytes to Firebase Storage.
    Returns (public_url, storage_path).
    """
    _check_size(file_bytes, media_type)

    if not is_initialized():
        raise RuntimeError("Firebase Storage non configurato")

    bucket = get_bucket()
    blob = bucket.blob(destination_path)

    if not content_type:
        content_type, _ = mimetypes.guess_type(destination_path)
        content_type = content_type or "application/octet-stream"

    blob.upload_from_file(
        io.BytesIO(file_bytes),
        content_type=content_type,
        size=len(file_bytes),
    )

    signed_url = get_signed_url(destination_path)
    return signed_url, destination_path


def get_signed_url(storage_path: str, expiry_days: int = 7) -> str:
    """Generate a signed URL valid for `expiry_days` days."""
    if not is_initialized():
        return ""
    bucket = get_bucket()
    blob = bucket.blob(storage_path)
    expiration = datetime.now(timezone.utc) + timedelta(days=expiry_days)
    url = blob.generate_signed_url(
        expiration=expiration,
        method="GET",
        version="v4",
    )
    return url


def delete_file(storage_path: str):
    """Delete a file from Firebase Storage (best-effort)."""
    if not is_initialized() or not storage_path:
        return
    try:
        bucket = get_bucket()
        blob = bucket.blob(storage_path)
        blob.delete()
    except Exception as exc:
        logger.warning("Could not delete storage file %s: %s", storage_path, exc)


def generate_thumbnail(image_bytes: bytes, size: Tuple[int, int] = (200, 200)) -> Optional[bytes]:
    """Resize an image to thumbnail size. Returns None if Pillow not available."""
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        img.thumbnail(size)
        buf = io.BytesIO()
        fmt = img.format or "JPEG"
        img.save(buf, format=fmt)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("Thumbnail generation failed: %s", exc)
        return None
