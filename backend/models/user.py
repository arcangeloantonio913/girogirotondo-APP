from typing import Optional
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
    class_id: Optional[str] = None
    child_id: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(BaseModel):
    """Used by POST /api/users (admin panel)."""
    name: str
    email: EmailStr
    password: str
    role: Role
    class_id: Optional[str] = None
    child_id: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    cognome: Optional[str] = None
    class_id: Optional[str] = None
    child_id: Optional[str] = None
    avatar_url: Optional[str] = None
