"""Modelli Rette — piani retta, assegnazioni ai bambini, addebiti.

Multi-tenant: ogni documento porta `sede_id` (impostato server-side, mai dal body).
Convenzioni identiche agli altri modelli: Pydantic Create/Update, validator sui campi
obbligatori, importi in euro come float (>= 0).
"""
import re
from typing import Optional, List, Dict
from pydantic import BaseModel, field_validator

# Formato periodo mensile: "YYYY-MM" (es. "2026-10")
_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")

# Tipi di voce di un piano retta
_KINDS = {"una_tantum", "mensile", "annuale"}


class FeeComponent(BaseModel):
    """Una voce del piano retta (es. 'Retta mensile', 'Mensa', 'Iscrizione')."""
    key: str                      # slug stabile usato per deduplicare gli addebiti (es. "retta", "mensa")
    label: str                    # etichetta leggibile mostrata alle famiglie
    amount: float                 # importo in euro
    kind: str = "mensile"         # una_tantum | mensile | annuale
    optional: bool = False        # voce attivabile per singolo bambino (es. pre/post-scuola)

    @field_validator("key")
    @classmethod
    def _key(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if not re.match(r"^[a-z0-9_-]{2,40}$", v):
            raise ValueError("key non valida: minuscole, numeri, trattini/underscore (2-40)")
        return v

    @field_validator("label")
    @classmethod
    def _label(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Etichetta obbligatoria")
        return v.strip()

    @field_validator("amount")
    @classmethod
    def _amount(cls, v: float) -> float:
        if v is None or float(v) < 0:
            raise ValueError("Importo non valido (>= 0)")
        return round(float(v), 2)

    @field_validator("kind")
    @classmethod
    def _kind(cls, v: str) -> str:
        v = (v or "mensile").strip().lower()
        if v not in _KINDS:
            raise ValueError(f"kind non valido: {sorted(_KINDS)}")
        return v


class PianoRettaCreate(BaseModel):
    """Piano retta (template a livello di sede, riusabile su più bambini)."""
    name: str
    components: List[FeeComponent] = []
    note: Optional[str] = None
    active: bool = True

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Nome del piano obbligatorio")
        return v.strip()

    @field_validator("components")
    @classmethod
    def _components(cls, v: List[FeeComponent]) -> List[FeeComponent]:
        keys = [c.key for c in (v or [])]
        if len(keys) != len(set(keys)):
            raise ValueError("Le voci del piano hanno key duplicate")
        return v or []


class PianoRettaUpdate(BaseModel):
    name: Optional[str] = None
    components: Optional[List[FeeComponent]] = None
    note: Optional[str] = None
    active: Optional[bool] = None

    @field_validator("components")
    @classmethod
    def _components(cls, v):
        if v is None:
            return v
        keys = [c.key for c in v]
        if len(keys) != len(set(keys)):
            raise ValueError("Le voci del piano hanno key duplicate")
        return v


class AssegnazioneCreate(BaseModel):
    """Assegna un piano retta a un bambino, con eventuale sconto e override di importi.

    `overrides` = { component_key: importo } sovrascrive l'importo di una voce del piano
    per QUESTO bambino (es. mensa ridotta). `disabled_components` disattiva voci opzionali.
    """
    student_id: str
    plan_id: str
    discount_pct: float = 0.0                       # riduzione fratelli/ISEE (0-100)
    discount_reason: Optional[str] = None
    overrides: Dict[str, float] = {}
    disabled_components: List[str] = []
    start_month: Optional[str] = None               # "YYYY-MM" — da quando parte la retta mensile
    end_month: Optional[str] = None                 # "YYYY-MM" — fino a quando (incluso), None = aperto
    active: bool = True

    @field_validator("discount_pct")
    @classmethod
    def _disc(cls, v: float) -> float:
        v = float(v or 0)
        if v < 0 or v > 100:
            raise ValueError("Sconto fuori range (0-100)")
        return round(v, 2)

    @field_validator("start_month", "end_month")
    @classmethod
    def _month(cls, v):
        if v is None or v == "":
            return None
        v = v.strip()
        if not _MONTH_RE.match(v):
            raise ValueError("Mese non valido: usa il formato YYYY-MM")
        return v

    @field_validator("overrides")
    @classmethod
    def _overrides(cls, v):
        for k, amt in (v or {}).items():
            if amt is None or float(amt) < 0:
                raise ValueError(f"Override non valido per '{k}' (>= 0)")
        return {k: round(float(a), 2) for k, a in (v or {}).items()}


class AssegnazioneUpdate(BaseModel):
    discount_pct: Optional[float] = None
    discount_reason: Optional[str] = None
    overrides: Optional[Dict[str, float]] = None
    disabled_components: Optional[List[str]] = None
    start_month: Optional[str] = None
    end_month: Optional[str] = None
    active: Optional[bool] = None

    @field_validator("discount_pct")
    @classmethod
    def _disc(cls, v):
        if v is None:
            return v
        v = float(v)
        if v < 0 or v > 100:
            raise ValueError("Sconto fuori range (0-100)")
        return round(v, 2)

    @field_validator("start_month", "end_month")
    @classmethod
    def _month(cls, v):
        if v is None or v == "":
            return None
        v = v.strip()
        if not _MONTH_RE.match(v):
            raise ValueError("Mese non valido: usa il formato YYYY-MM")
        return v


class GeneraAddebitiRequest(BaseModel):
    """Genera gli addebiti MENSILI di tutte le rette attive della sede per un periodo."""
    period: str                 # "YYYY-MM"
    due_day: int = 10           # giorno di scadenza nel mese (1-28)

    @field_validator("period")
    @classmethod
    def _period(cls, v: str) -> str:
        v = (v or "").strip()
        if not _MONTH_RE.match(v):
            raise ValueError("Periodo non valido: usa il formato YYYY-MM")
        return v

    @field_validator("due_day")
    @classmethod
    def _due(cls, v: int) -> int:
        v = int(v or 10)
        if v < 1 or v > 28:
            raise ValueError("Giorno di scadenza fuori range (1-28)")
        return v


class AddebitoManualeCreate(BaseModel):
    """Addebito una-tantum creato a mano dalla segreteria (es. gita, materiale)."""
    student_id: str
    description: str
    amount: float
    due_date: Optional[str] = None       # ISO date "YYYY-MM-DD"
    period: str = "una_tantum"

    @field_validator("description")
    @classmethod
    def _desc(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Descrizione obbligatoria")
        return v.strip()

    @field_validator("amount")
    @classmethod
    def _amount(cls, v: float) -> float:
        if v is None or float(v) <= 0:
            raise ValueError("Importo non valido (> 0)")
        return round(float(v), 2)
