"""Appointments router — prenotazioni con notifiche email."""
import uuid
import os
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
try:
    from utils.expo_push import notify_users as expo_notify
except: expo_notify = None
from models.appointments import AppointmentCreate, AppointmentStatus
from middleware.auth import get_current_user
from services.email_service import send_appointment_email

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00",
]

ADMIN_EMAIL = os.environ.get("ADMIN_NOTIFICATION_EMAIL", "girogirotondo@libero.it")


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
    appointments = await db.appointments.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return appointments


@router.post("", status_code=201)
async def create_appointment(
    payload: AppointmentCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    parent = await db.users.find_one({"id": payload.parent_id}, {"_id": 0})
    parent_name  = parent["name"]  if parent else "Sconosciuto"
    parent_email = parent["email"] if parent else None

    doc = payload.model_dump()
    doc["id"]          = str(uuid.uuid4())
    doc["parent_name"] = parent_name
    doc["status"]      = AppointmentStatus.pending
    doc["created_at"]  = datetime.now(timezone.utc).isoformat()
    await db.appointments.insert_one(doc)
    doc.pop("_id", None)

    # ── Notifiche email (non bloccanti) ───────────────────────────────────────
    # 1. Notifica all'amministrazione
    await send_appointment_email(
        to_email=ADMIN_EMAIL,
        parent_name=parent_name,
        date=payload.date,
        time_slot=payload.time_slot,
        reason=payload.reason,
        status="pending",
    )
    # 2. Conferma alla famiglia
    if parent_email:
        await send_appointment_email(
            to_email=parent_email,
            parent_name=parent_name,
            date=payload.date,
            time_slot=payload.time_slot,
            reason=payload.reason,
            status="pending",
        )

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

    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(status_code=404, detail="Appuntamento non trovato")

    await db.appointments.update_one({"id": apt_id}, {"$set": {"status": status}})

    # Notifica alla famiglia quando lo stato cambia
    if status in (AppointmentStatus.confirmed, AppointmentStatus.cancelled):
        parent = await db.users.find_one({"id": apt.get("parent_id")}, {"_id": 0})
        if parent and parent.get("email"):
            await send_appointment_email(
                to_email=parent["email"],
                parent_name=parent["name"],
                date=apt["date"],
                time_slot=apt["time_slot"],
                reason=apt.get("reason", ""),
                status=status.value if hasattr(status, "value") else str(status),
            )

    return {"message": "Stato aggiornato", "status": status}


@router.delete("/{apt_id}")
async def delete_appointment(
    apt_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancella un appuntamento — genitore proprietario o admin."""
    db = get_db()
    apt = await db.appointments.find_one({"id": apt_id})
    if not apt:
        raise HTTPException(status_code=404, detail="Appuntamento non trovato")

    role = current_user.get("role")
    if role != "admin" and apt.get("parent_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    await db.appointments.delete_one({"id": apt_id})
    return {"message": "Appuntamento cancellato"}


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
