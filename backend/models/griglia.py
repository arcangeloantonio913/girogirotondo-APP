from typing import List, Optional
from pydantic import BaseModel

QUANTITA_VALUES = ("", "tutto", "molta", "poca", "metà")


class GrigliaEntry(BaseModel):
    """Griglia giornaliera dei pasti e igiene personale.

    Campi pasto (5): pasta, secondo, pane, frutta, merenda.
    Per ogni pasto: campo _qty con la quantità mangiata (tutto/molta/poca/metà).
    Campo igiene: pupu (boolean).
    """
    class_id: str
    student_ids: List[str]
    date: str

    # ── 5 campi pasto — boolean (true se ha mangiato qualcosa) ───────────────
    # Ordine visualizzazione: merenda prima, poi pasta, secondo, pane, frutta
    merenda:  bool = False
    pasta:    bool = False
    secondo:  bool = False
    pane:     bool = False
    frutta:   bool = False

    # ── Quantità per pasto (tutto | bis | poca | metà | no | "") ─────────────
    merenda_qty: Optional[str] = ""
    pasta_qty:   Optional[str] = ""
    secondo_qty: Optional[str] = ""
    pane_qty:    Optional[str] = ""
    frutta_qty:  Optional[str] = ""

    # ── Igiene e riposo ───────────────────────────────────────────────────────
    pupu:  bool = False
    nanna: bool = False

    # ── Note libere ───────────────────────────────────────────────────────────
    notes: str = ""
