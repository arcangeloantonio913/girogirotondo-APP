from typing import List, Optional
from pydantic import BaseModel


class PresenzaRecord(BaseModel):
    """Singolo record presenza/assenza per uno studente."""
    student_id: str
    presente:   bool = True
    nota:       str  = ""   # es. "malato", "permesso", ecc.


class PresenzaDay(BaseModel):
    """Registro giornaliero: una classe, una data, lista studenti."""
    class_id: str
    date:     str          # YYYY-MM-DD
    records:  List[PresenzaRecord]
