"""Sede model — Multi-Tenant entity."""
from typing import Optional
from pydantic import BaseModel


class SedeCreate(BaseModel):
    id: str           # e.g. "girogirotondo", "il-magico-mondo"
    name: str
    color: str = "#4169E1"
    indirizzo: Optional[str] = None
    active: bool = True
