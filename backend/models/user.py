from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator
from enum import Enum


class Role(str, Enum):
    admin = "admin"
    teacher = "teacher"
    parent = "parent"


def _require_non_empty(v: str) -> str:
    """Reject missing/blank required strings (prevents garbage records, G-data)."""
    if v is None or not str(v).strip():
        raise ValueError("Campo obbligatorio: non può essere vuoto")
    return str(v).strip()


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

    @field_validator("name", "cognome")
    @classmethod
    def _v_name(cls, v):
        return _require_non_empty(v)


class UserCreate(BaseModel):
    """Used by POST /api/users (admin panel)."""
    name: str
    email: EmailStr
    password: str
    role: Role
    cognome: Optional[str] = None

    @field_validator("name")
    @classmethod
    def _v_name(cls, v):
        return _require_non_empty(v)
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


class SecondoGenitoreCreate(BaseModel):
    """Aggiunge un secondo genitore a un bambino già iscritto."""
    student_id: str
    genitore_email: EmailStr
    genitore_nome: Optional[str] = None
    genitore_password: Optional[str] = None
    skip_email: bool = False              # True = non invia email di benvenuto


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
    skip_email: bool = False              # True = non invia email di benvenuto

    @field_validator("bambino_nome", "bambino_cognome", "class_id", "sede_id")
    @classmethod
    def _v_required(cls, v):
        return _require_non_empty(v)
