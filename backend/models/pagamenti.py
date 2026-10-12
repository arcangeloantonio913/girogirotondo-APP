"""Modelli Pagamenti — incassi registrati a fronte degli addebiti (rette).

Multi-tenant: `sede_id` impostato server-side. Un pagamento è SEMPRE legato a un
addebito (charge) esistente della stessa sede.
"""
from typing import Optional
from pydantic import BaseModel, field_validator

# Metodi di incasso ammessi
_METHODS = {"bonifico", "sdd", "pagopa", "stripe", "contanti", "pos", "altro"}


class PagamentoCreate(BaseModel):
    charge_id: str
    amount: float
    method: str = "bonifico"
    paid_at: Optional[str] = None     # ISO date "YYYY-MM-DD" — default: oggi (server-side)
    note: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def _amount(cls, v: float) -> float:
        if v is None or float(v) <= 0:
            raise ValueError("Importo non valido (> 0)")
        return round(float(v), 2)

    @field_validator("method")
    @classmethod
    def _method(cls, v: str) -> str:
        v = (v or "bonifico").strip().lower()
        if v not in _METHODS:
            raise ValueError(f"Metodo non valido: {sorted(_METHODS)}")
        return v
