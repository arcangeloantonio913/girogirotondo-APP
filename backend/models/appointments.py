from pydantic import BaseModel
from enum import Enum


class AppointmentStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"


class AppointmentCreate(BaseModel):
    parent_id: str
    date: str
    time_slot: str
    reason: str


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus
