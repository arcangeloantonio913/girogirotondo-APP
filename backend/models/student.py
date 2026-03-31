from typing import Optional
from pydantic import BaseModel


class StudentCreate(BaseModel):
    name: str
    class_id: str
    parent_id: Optional[str] = None
    date_of_birth: Optional[str] = None
