from typing import Optional
from pydantic import BaseModel
from enum import Enum


class DocumentCategory(str, Enum):
    circolari = "circolari"
    autorizzazioni = "autorizzazioni"
    menu = "menù"
    altro = "altro"


class DocumentCreate(BaseModel):
    """Backward-compat: create document record with a pre-existing URL."""
    title: str
    description: str
    file_url: str
    categoria: DocumentCategory = DocumentCategory.altro
    classe_id: Optional[str] = None
    scadenza: Optional[str] = None


class ReadReceiptCreate(BaseModel):
    document_id: str
    parent_id: str
