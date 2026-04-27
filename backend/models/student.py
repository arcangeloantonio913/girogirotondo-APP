from typing import Optional, List
from pydantic import BaseModel


class StudentCreate(BaseModel):
    name: str
    class_id: str
    parent_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    allergies: Optional[List[str]] = []
    notes: Optional[str] = ""


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    cognome: Optional[str] = None
    class_id: Optional[str] = None       # sposta in altra classe
    date_of_birth: Optional[str] = None
    allergies: Optional[List[str]] = None
    notes: Optional[str] = None
    parent_id: Optional[str] = None
