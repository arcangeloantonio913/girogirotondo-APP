from pydantic import BaseModel


class DiaryEntryCreate(BaseModel):
    class_id: str
    date: str
    summary: str
