"""Sede model — Multi-Tenant entity."""
import re
from typing import Optional
from pydantic import BaseModel, field_validator

_SLUG_RE = re.compile(r"^[a-z0-9-]{2,40}$")


class SedeCreate(BaseModel):
    id: str           # slug: es. "girogirotondo", "il-magico-mondo"
    name: str
    color: str = "#4169E1"
    indirizzo: Optional[str] = None
    active: bool = True

    @field_validator("id")
    @classmethod
    def _slug(cls, v):
        v = (v or "").strip().lower()
        if not _SLUG_RE.match(v):
            raise ValueError("Slug non valido: usa minuscole, numeri e trattini (2-40 caratteri)")
        return v

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        if not v or not v.strip():
            raise ValueError("Nome obbligatorio")
        return v.strip()


class SedeUpdate(BaseModel):
    """Aggiornamento sede — non modifica lo slug/id."""
    name: Optional[str] = None
    color: Optional[str] = None
    indirizzo: Optional[str] = None
    active: Optional[bool] = None
