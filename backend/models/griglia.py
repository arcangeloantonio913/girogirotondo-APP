from typing import List
from pydantic import BaseModel


class GrigliaEntry(BaseModel):
    """Griglia giornaliera dei pasti e igiene personale.

    Campi pasto (4 fissi): pasta, secondo, pane, frutta.
    Campo igiene: pupu.
    """
    class_id: str
    student_ids: List[str]
    date: str
    # ── 4 campi pasto fissi ───────────────────────────────────────────────────
    pasta: bool = False
    secondo: bool = False
    pane: bool = False
    frutta: bool = False
    # ── Igiene ───────────────────────────────────────────────────────────────
    pupu: bool = False
    # ── Note libere ──────────────────────────────────────────────────────────
    notes: str = ""
