from typing import List, Optional
from pydantic import BaseModel


class MediaUpload(BaseModel):
    """Backward-compat: save URL directly (no file upload)."""
    class_id: str
    student_ids: List[str]
    media_url: str
    media_type: str  # photo | video
    caption: str = ""
    tags: List[str] = []
