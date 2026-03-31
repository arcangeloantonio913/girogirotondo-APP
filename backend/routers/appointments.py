"""Appointments router."""
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.appointments import AppointmentCreate, AppointmentStatus
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00",
]


@router.get("")
async def get_appointments(
    parent_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if parent_id:
        query["parent_id"] = parent_id
    elif current_user.get("role") == "parent":
        query["parent_id"] = current_user.get("id")
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(1000)
    return appointments


@router.post("", status_code=201)
async def create_appointment(
    payload: AppointmentCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    parent = await db.users.find_one({"id": payload.parent_id}, {"_id": 0})
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["parent_name"] = parent["name"] if parent else "Sconosciuto"
    doc["status"] = AppointmentStatus.pending
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.appointments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{apt_id}/status")
async def update_appointment_status(
    apt_id: str,
    status: AppointmentStatus,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    result = await db.appointments.update_one(
        {"id": apt_id}, {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appuntamento non trovato")
    return {"message": "Stato aggiornato", "status": status}


@router.get("/slots")
async def get_appointment_slots(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    if date:
        booked = await db.appointments.find({"date": date}, {"_id": 0}).to_list(100)
        booked_slots = [a["time_slot"] for a in booked]
        available = [s for s in SLOTS if s not in booked_slots]
        return {"date": date, "available_slots": available, "booked_slots": booked_slots}
    return {"slots": SLOTS}
