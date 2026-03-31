from typing import Optional
from pydantic import BaseModel


class MealCreate(BaseModel):
    class_id: str
    date: str
    primo: str = ""
    secondo: str = ""
    contorno: str = ""
    frutta: str = ""
    merenda_mattina: str = ""
    merenda_pomeriggio: str = ""
