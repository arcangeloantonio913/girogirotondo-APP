"""Modello Avvisi e Comunicazioni — targeting avanzato multi-sede."""
from typing import Optional, List
from pydantic import BaseModel


class AvvisoCreate(BaseModel):
    """Payload per creare un avviso con targeting granulare."""
    titolo: str
    testo: str

    # ── Compatibilità legacy ────────────────────────────────────────────────
    # target: 'global' (tutti nella sede) | 'class' (classe specifica) | 'custom'
    target: str = "global"
    class_id: Optional[str] = None         # legacy: usato se target == 'class'

    # ── Targeting avanzato (nuovo) ──────────────────────────────────────────
    # Sedi destinatarie (admin only). Vuoto = solo sede attiva.
    target_sedi: Optional[List[str]] = None        # es. ['girogirotondo', 'il-magico-mondo']

    # Classi destinatarie. Vuoto / None = tutte le classi della sede.
    target_class_ids: Optional[List[str]] = None   # es. ['uuid-farfalle', 'uuid-coccinelle']

    # Ruoli destinatari. Vuoto / None = tutti i ruoli.
    target_roles: Optional[List[str]] = None       # es. ['parent'] | ['teacher'] | ['parent','teacher']

    # Singoli genitori destinatari. Vuoto / None = tutti i genitori delle classi target.
    target_parent_ids: Optional[List[str]] = None  # es. ['uuid-genitore-1']


class AvvisoUpdate(BaseModel):
    titolo: Optional[str] = None
    testo: Optional[str] = None
    target: Optional[str] = None
    class_id: Optional[str] = None
    target_sedi: Optional[List[str]] = None
    target_class_ids: Optional[List[str]] = None
    target_roles: Optional[List[str]] = None
    target_parent_ids: Optional[List[str]] = None
