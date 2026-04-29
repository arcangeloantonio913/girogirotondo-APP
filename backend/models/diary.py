from typing import Optional, List
from pydantic import BaseModel


class DiaryEntryCreate(BaseModel):
    class_id: str
    date: str
    summary: str
    student_ids: Optional[List[str]] = None   # None = tutta la classe
