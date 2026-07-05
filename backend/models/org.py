"""Org model — livello "organizzazione" sopra le sedi (un cliente = una org).

Un admin/superadmin vede SOLO le sedi della propria org. Stesso pattern di sede.py.
"""
import re
from typing import Optional
from pydantic import BaseModel, field_validator

_SLUG_RE = re.compile(r"^[a-z0-9-]{2,40}$")


class OrgCreate(BaseModel):
    id: str           # slug: es. "girogirotondo-group", "dimensione-bimbo"
    name: str
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


class OrgUpdate(BaseModel):
    """Aggiornamento org — non modifica lo slug/id."""
    name: Optional[str] = None
    active: Optional[bool] = None
