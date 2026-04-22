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
    # Teacher: lista di classi gestite (plural). class_id mantenuto per compatibilità.
    class_id: Optional[str] = None
    class_ids: Optional[List[str]] = None
    # Parent: lista di figli (plural). child_id mantenuto per compatibilità.
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
    # Teacher: una o più classi
    class_id: Optional[str] = None          # legacy / primary class
    class_ids: Optional[List[str]] = None   # preferred: list of class IDs
    # Parent: uno o più figli
    child_id: Optional[str] = None          # legacy / primary child
    child_ids: Optional[List[str]] = None   # preferred: list of child IDs


class UserUpdate(BaseModel):
    name: Optional[str] = None
    cognome: Optional[str] = None
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
    genitore_email: EmailStr
    genitore_nome: Optional[str] = None            # default: "Famiglia {cognome}"
    genitore_password: Optional[str] = None        # se None, viene generata automaticamente
