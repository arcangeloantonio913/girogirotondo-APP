from typing import Optional, List
from pydantic import BaseModel, field_validator


class StudentCreate(BaseModel):
    name: str
    cognome: Optional[str] = None        # surname (was missing — L10)
    sede_id: Optional[str] = None        # tenant; set/validated server-side
    class_id: str
    parent_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    allergies: Optional[List[str]] = []
    notes: Optional[str] = ""

    @field_validator("name")
    @classmethod
    def _name_non_empty(cls, v: str) -> str:
        if v is None or not str(v).strip():
            raise ValueError("Il nome è obbligatorio")
        return str(v).strip()


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    cognome: Optional[str] = None
    class_id: Optional[str] = None       # sposta in altra classe
    date_of_birth: Optional[str] = None
    allergies: Optional[List[str]] = None
    notes: Optional[str] = None
    parent_id: Optional[str] = None
