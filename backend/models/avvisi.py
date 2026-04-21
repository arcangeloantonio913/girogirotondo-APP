"""Modello Avvisi e Comunicazioni."""
from typing import Optional, List
from pydantic import BaseModel


class AvvisoCreate(BaseModel):
    """Payload per creare un avviso."""
    titolo: str
    testo: str
    # Destinatari: 'global' (tutti), 'class' (una classe specifica)
    target: str = "global"              # 'global' | 'class'
    class_id: Optional[str] = None     # obbligatorio se target == 'class'
    # Ruoli destinatari: di default tutti
    target_roles: Optional[List[str]] = None  # es. ['parent'] | None = tutti


class AvvisoUpdate(BaseModel):
    titolo: Optional[str] = None
    testo: Optional[str] = None
    target: Optional[str] = None
    class_id: Optional[str] = None
    target_roles: Optional[List[str]] = None
