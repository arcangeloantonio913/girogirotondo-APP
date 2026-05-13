from typing import Optional
from pydantic import BaseModel


class MealCreate(BaseModel):
    class_id: str
    # ── Date personalizzabili ─────────────────────────────────────────────────
    # Opzione 1: singola data (comportamento legacy)
    date: Optional[str] = None
    # Opzione 2: range di date — il menu vale per tutti i giorni nel range
    date_from: Optional[str] = None
    date_to:   Optional[str] = None
    # ── Piatti ────────────────────────────────────────────────────────────────
    primo:              str = ""
    secondo:            str = ""
    contorno:           str = ""
    frutta:             str = ""
    merenda_mattina:    str = ""
    merenda_pomeriggio: str = ""
