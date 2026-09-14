"""Modelli Raccolta Iscrizioni — token scuola + submission (scheda/scansioni)."""
import re
from datetime import date, datetime, timezone
from typing import List, Optional, Literal

from pydantic import BaseModel, EmailStr, field_validator

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class IntakeTokenCreate(BaseModel):
    """Creazione token per una scuola. org_id è imposto server-side (mai dal body)."""
    label: str
    expires_at: Optional[str] = None   # ISO8601, opzionale

    @field_validator("label")
    @classmethod
    def _label(cls, v):
        if not v or not v.strip():
            raise ValueError("Etichetta obbligatoria")
        return v.strip()

    @field_validator("expires_at")
    @classmethod
    def _normalize_expires_at(cls, v):
        if not v:
            return v
        raw = v.strip()
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError("expires_at non valido: usa formato ISO8601")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()


class IntakeChild(BaseModel):
    """Un bambino nella scheda strutturata (modalità form)."""
    nome: str
    cognome: str
    data_nascita: str                  # YYYY-MM-DD (obbligatoria in modalità form)
    sede_id: str
    classe: str                        # nome sezione/classe (esistente o nuova)
    genitore_nome: str
    genitore_cognome: str
    genitore_email: EmailStr

    @field_validator("nome", "cognome", "sede_id", "classe", "genitore_nome", "genitore_cognome")
    @classmethod
    def _non_empty(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Campo obbligatorio")
        return str(v).strip()

    @field_validator("data_nascita")
    @classmethod
    def _valid_date(cls, v):
        v = (v or "").strip()
        if not _DATE_RE.match(v):
            raise ValueError("Data non valida: usa il formato AAAA-MM-GG")
        try:
            d = date.fromisoformat(v)
        except ValueError:
            raise ValueError("Data inesistente")
        # Range plausibile per un iscritto a nido/infanzia: 0–7 anni circa.
        if not (date(2015, 1, 1) <= d <= date.today()):
            raise ValueError("Data di nascita fuori dall'intervallo plausibile")
        return v


class IntakeStaff(BaseModel):
    """Maestra: crea account teacher legato alle sezioni assegnate."""
    nome: str
    cognome: str
    email: EmailStr
    sede_id: str
    sezioni: List[str] = []            # nomi classi/sezioni assegnate

    @field_validator("nome", "cognome", "sede_id")
    @classmethod
    def _non_empty(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Campo obbligatorio")
        return str(v).strip()


class IntakeDirettrice(BaseModel):
    """Direttrice: crea account admin is_superadmin dell'org."""
    nome: str
    cognome: str
    email: EmailStr

    @field_validator("nome", "cognome")
    @classmethod
    def _non_empty(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Campo obbligatorio")
        return str(v).strip()


class IntakeSubmissionUpsert(BaseModel):
    """Crea/aggiorna una submission in modalità form (bozza o invio)."""
    mode: Literal["form", "scan"] = "form"
    status: Literal["bozza", "inviata"] = "bozza"
    children: List[IntakeChild] = []
    staff: List[IntakeStaff] = []
    direttrici: List[IntakeDirettrice] = []
    submission_id: Optional[str] = None   # se presente → update della bozza esistente


class IntakeSubmissionPatch(BaseModel):
    """PATCH admin: sostituisce l'elenco children corretto.

    children usa il modello completo IntakeChild (non parziale): ogni riga deve
    essere validata per intero, così una submission salvata non può mai avere
    bambini con campi mancanti (che farebbero KeyError in fase di export)."""
    children: Optional[List[IntakeChild]] = None
    staff: Optional[List[IntakeStaff]] = None
    direttrici: Optional[List[IntakeDirettrice]] = None
    status: Optional[Literal["bozza", "inviata", "revisionata", "importata"]] = None
