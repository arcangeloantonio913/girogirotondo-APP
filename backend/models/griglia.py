from typing import List
from pydantic import BaseModel


class GrigliaEntry(BaseModel):
    class_id: str
    student_ids: List[str]
    date: str
    colazione: bool = False
    pranzo: bool = False
    frutta: bool = False
    merenda: bool = False
    cacca: bool = False
    pisolino: bool = False
    notes: str = ""
