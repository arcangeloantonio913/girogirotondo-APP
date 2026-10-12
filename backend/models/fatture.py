"""Modelli Documenti fiscali (ricevute / fatture) emessi verso le famiglie.

NB: la RICEVUTA è il default sicuro (quietanza di pagamento). La FATTURA ELETTRONICA
(XML + invio SDI) richiede regime dell'ente + provider e NON è gestita qui: si salva il
documento e se ne produce la stampa; la trasmissione SDI è un passo successivo.
"""
from typing import Optional, List, Dict
from pydantic import BaseModel, field_validator

_TIPI = {"ricevuta", "fattura"}


class Intestatario(BaseModel):
    """Dati di chi intesta il documento (genitore pagante)."""
    nome: str
    codice_fiscale: Optional[str] = None
    indirizzo: Optional[str] = None
    email: Optional[str] = None

    @field_validator("nome")
    @classmethod
    def _nome(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Intestatario: nome obbligatorio")
        return v.strip()


class RicevutaCreate(BaseModel):
    student_id: str
    charge_ids: List[str] = []              # addebiti inclusi; se vuoto → tutti i pagati del bambino
    tipo: str = "ricevuta"
    data: Optional[str] = None              # ISO date; default oggi (server-side)
    intestatario: Optional[Intestatario] = None   # se assente → derivato dal genitore
    note: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def _tipo(cls, v: str) -> str:
        v = (v or "ricevuta").strip().lower()
        if v not in _TIPI:
            raise ValueError(f"Tipo non valido: {sorted(_TIPI)}")
        return v
