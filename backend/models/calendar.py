from typing import List, Optional
from pydantic import BaseModel
from enum import Enum


class EventType(str, Enum):
    gita = "gita"
    riunione = "riunione"
    festa = "festa"
    chiusura = "chiusura"
    colloquio = "colloquio"
    altro = "altro"


class VisibleTo(str, Enum):
    admin = "admin"
    teacher = "teacher"
    parent = "parent"


class CalendarEventCreate(BaseModel):
    titolo: str
    descrizione: str = ""
    data_inizio: str  # ISO date or datetime string
    data_fine: Optional[str] = None
    tipo: EventType = EventType.altro
    classe_id: Optional[str] = None
    visibile_a: List[VisibleTo] = [VisibleTo.admin, VisibleTo.teacher, VisibleTo.parent]


class CalendarEventUpdate(BaseModel):
    titolo: Optional[str] = None
    descrizione: Optional[str] = None
    data_inizio: Optional[str] = None
    data_fine: Optional[str] = None
    tipo: Optional[EventType] = None
    classe_id: Optional[str] = None
    visibile_a: Optional[List[VisibleTo]] = None
