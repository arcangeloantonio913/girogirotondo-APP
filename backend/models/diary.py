from typing import Optional, List
from pydantic import BaseModel


class DiaryEntryCreate(BaseModel):
    class_id: str
    date: str
    summary: str
    student_ids: Optional[List[str]] = None   # None = tutta la classe
    # Campi ricchi usati dall'app mobile (mostrati al genitore)
    note: Optional[str] = None
    mood: Optional[str] = None
    activities: Optional[List[str]] = None


class DiaryEntryUpdate(BaseModel):
    date: Optional[str] = None
    summary: Optional[str] = None
    student_ids: Optional[List[str]] = None
    note: Optional[str] = None
    mood: Optional[str] = None
    activities: Optional[List[str]] = None
