from typing import Optional, List
from pydantic import BaseModel, EmailStr
from enum import Enum


class Role(str, Enum):
    admin = "admin"
    teacher = "teacher"
    parent = "parent"


class UserRegister(BaseModel):
    """Used by POST /api/auth/register — creates Firebase user + MongoDB profile."""
    email: EmailStr
    password: str
    name: str
    cognome: str
    role: Role
    sede_id: Optional[str] = None              # sede di appartenenza
    class_id: Optional[str] = None
    class_ids: Optional[List[str]] = None
    child_id: Optional[str] = None
    child_ids: Optional[List[str]] = None
    avatar_url: Optional[str] = None


class UserCreate(BaseModel):
    """Used by POST /api/users (admin panel)."""
    name: str
    email: EmailStr
    password: str
    role: Role
    cognome: Optional[str] = None
    sede_id: Optional[str] = None              # sede di appartenenza
    class_id: Optional[str] = None
    class_ids: Optional[List[str]] = None
    child_id: Optional[str] = None
    child_ids: Optional[List[str]] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    cognome: Optional[str] = None
    sede_id: Optional[str] = None
    class_id: Optional[str] = None
    class_ids: Optional[List[str]] = None
    child_id: Optional[str] = None
    child_ids: Optional[List[str]] = None
    avatar_url: Optional[str] = None


class IscrizioneCreate(BaseModel):
    """Iscrizione bambino: crea studente + genitore in un solo step."""
    bambino_nome: str
    bambino_cognome: str
    bambino_data_nascita: Optional[str] = None   # YYYY-MM-DD
    class_id: str                                  # classe del bambino
    sede_id: str                                   # sede della scuola (obbligatorio)
    genitore_email: EmailStr
    genitore_nome: Optional[str] = None
    genitore_password: Optional[str] = None
