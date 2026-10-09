"""Firebase Storage helpers: upload, signed URLs, delete.

Fallback strategy when Firebase is not configured:
- Compress the image to max 800px JPEG quality 70 (~50-150KB)
- Store as base64 data URL in MongoDB (safe: well under 16MB limit)
- Videos are rejected gracefully when Firebase is not available
"""
import io
import logging
import mimetypes
from datetime import timedelta, datetime, timezone
from typing import Optional, Tuple

from utils.firebase_client import get_bucket, is_initialized

logger = logging.getLogger(__name__)

# HEIC/HEIF (formato foto iPhone) non è apribile su Android né sul web. Registriamo il
# decoder così PIL può aprirlo e noi lo riconvertiamo in JPEG in fase di upload. Se la
# libreria manca, HEIF_OK resta False e le foto HEIC NON vengono transcodificate (ma non
# si rompe nulla: il resto funziona come prima).
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIF_OK = True
except Exception as _heif_exc:  # pragma: no cover
    HEIF_OK = False
    logger.warning("[STORAGE] pillow-heif non disponibile (%s) — niente conversione HEIC", _heif_exc)


def _is_heic_bytes(data: bytes, content_type: Optional[str] = None) -> bool:
    """True se i byte sono HEIC/HEIF (da magic number) o il content_type lo dichiara."""
    ct = (content_type or "").lower()
    if "heic" in ct or "heif" in ct:
        return True
    head = data[:12] if data else b""
    return head[4:8] == b"ftyp" and head[8:12] in (b"heic", b"heix", b"mif1", b"msf1", b"hevc")


def to_web_safe_image(file_bytes: bytes, content_type: Optional[str] = None):
    """Se i byte sono HEIC/HEIF, li riconverte in JPEG (web-safe). Altrimenti li lascia
    invariati. Restituisce (bytes, content_type, ext) dove ext='jpg' SOLO se ha convertito
    (così il chiamante sa che deve cambiare estensione). Non solleva mai: in caso di
    problema restituisce l'input originale (fail-open, nessun upload perso)."""
    if not file_bytes or not _is_heic_bytes(file_bytes, content_type):
        return file_bytes, content_type, None
    if not HEIF_OK:
        logger.warning("[STORAGE] foto HEIC ricevuta ma pillow-heif assente — salvata grezza")
        return file_bytes, content_type, None
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        jpeg = buf.getvalue()
        logger.info("[STORAGE] HEIC→JPEG riuscita: %dKB → %dKB",
                    len(file_bytes) // 1024, len(jpeg) // 1024)
        return jpeg, "image/jpeg", "jpg"
    except Exception as exc:
        logger.warning("[STORAGE] HEIC→JPEG fallita, uso originale: %s", exc)
        return file_bytes, content_type, None

MAX_PHOTO_BYTES = 10 * 1024 * 1024   # 10 MB
MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB
MAX_BASE64_BYTES = 2 * 1024 * 1024   # 2 MB — soglia oltre cui comprimiamo


def _check_size(data: bytes, media_type: str):
    limit = MAX_VIDEO_BYTES if media_type == "video" else MAX_PHOTO_BYTES
    label = "100 MB" if media_type == "video" else "10 MB"
    if len(data) > limit:
        from fastapi import HTTPException
        raise HTTPException(status_code=413, detail=f"File troppo grande. Limite: {label}")


def _compress_image(file_bytes: bytes, max_px: int = 800, quality: int = 70) -> bytes:
    """
    Comprimi un'immagine a max_px sul lato lungo, JPEG quality.
    Restituisce i bytes compressi (o originali se PIL fallisce).
    """
    try:
        from PIL import Image, ExifTags
        img = Image.open(io.BytesIO(file_bytes))

        # Correggi orientamento EXIF (foto da iPhone spesso ruotate)
        try:
            exif = img._getexif()
            if exif:
                for tag, val in exif.items():
                    if ExifTags.TAGS.get(tag) == 'Orientation':
                        if val == 3:   img = img.rotate(180, expand=True)
                        elif val == 6: img = img.rotate(270, expand=True)
                        elif val == 8: img = img.rotate(90, expand=True)
        except Exception:
            pass

        # Converti in RGB (rimuove alpha che JPEG non supporta)
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")

        # Ridimensiona proporzionalmente
        img.thumbnail((max_px, max_px), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        compressed = buf.getvalue()
        logger.info("[STORAGE] Immagine compressa: %dKB → %dKB",
                    len(file_bytes) // 1024, len(compressed) // 1024)
        return compressed
    except Exception as exc:
        logger.warning("[STORAGE] Compressione fallita, uso originale: %s", exc)
        return file_bytes


async def upload_file(
    file_bytes: bytes,
    destination_path: str,
    content_type: Optional[str] = None,
    media_type: str = "photo",
) -> Tuple[str, str]:
    """
    Upload bytes to Firebase Storage.
    Fallback: comprime e salva come data URL base64 se Firebase non è configurato.
    Returns (url, storage_path).
    """
    _check_size(file_bytes, media_type)

    if not is_initialized():
        if media_type == "video":
            from fastapi import HTTPException
            raise HTTPException(
                status_code=503,
                detail="Caricamento video non disponibile: Firebase Storage non configurato. "
                       "Aggiungi FIREBASE_PRIVATE_KEY su Railway per abilitarlo."
            )

        # Comprimi le immagini prima di convertirle in base64
        is_image = (content_type or "").startswith("image/") or \
                   mimetypes.guess_type(destination_path)[0] in (
                       "image/jpeg", "image/png", "image/webp", "image/heic", None
                   )

        if is_image and len(file_bytes) > MAX_BASE64_BYTES:
            file_bytes = _compress_image(file_bytes)

        import base64
        b64  = base64.b64encode(file_bytes).decode()
        ct   = "image/jpeg" if is_image else (
               content_type or mimetypes.guess_type(destination_path)[0] or "application/octet-stream")
        data_url = f"data:{ct};base64,{b64}"
        logger.warning("[STORAGE] Firebase non configurato — salvato come data URL (%dKB)",
                       len(file_bytes) // 1024)
        return data_url, destination_path

    bucket = get_bucket()
    blob   = bucket.blob(destination_path)

    if not content_type:
        content_type, _ = mimetypes.guess_type(destination_path)
        content_type = content_type or "application/octet-stream"

    try:
        blob.upload_from_file(io.BytesIO(file_bytes), content_type=content_type, size=len(file_bytes))
        signed_url = get_signed_url(destination_path)
        return signed_url, destination_path
    except Exception as exc:
        logger.error("[STORAGE] Firebase upload fallito (%s) — uso fallback base64", exc)
        # Fallback: comprimi e salva come base64
        is_image = (content_type or "").startswith("image/")
        if is_image and len(file_bytes) > MAX_BASE64_BYTES:
            file_bytes = _compress_image(file_bytes)
        import base64
        b64 = base64.b64encode(file_bytes).decode()
        ct  = "image/jpeg" if is_image else content_type
        return f"data:{ct};base64,{b64}", destination_path


def get_signed_url(storage_path: str, expiry_days: int = 7) -> str:
    if not is_initialized():
        return ""
    bucket = get_bucket()
    blob   = bucket.blob(storage_path)
    expiration = datetime.now(timezone.utc) + timedelta(days=expiry_days)
    return blob.generate_signed_url(expiration=expiration, method="GET", version="v4")


def delete_file(storage_path: str):
    if not is_initialized() or not storage_path:
        return
    try:
        bucket = get_bucket()
        bucket.blob(storage_path).delete()
    except Exception as exc:
        logger.warning("Could not delete storage file %s: %s", storage_path, exc)


def generate_thumbnail(image_bytes: bytes, size: Tuple[int, int] = (400, 400)) -> Optional[bytes]:
    """Genera un thumbnail JPEG compresso. Restituisce None se PIL non è disponibile."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        img.thumbnail(size, Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75, optimize=True)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("Thumbnail generation failed: %s", exc)
        return None
