"""Appointments router — prenotazioni con notifiche email. Multi-tenant: sede
derivata SERVER-SIDE dal genitore, mai dall'input del client."""
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
from middleware.auth import get_tenant_context, TenantContext
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
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()
    if ctx.role == "parent":
        # Il genitore vede SOLO i propri — il param parent_id è ignorato (anti-IDOR).
        query: dict = {"parent_id": ctx.user_id}
    else:
        # Staff: limitato alle sedi del caller (superadmin: nessun filtro).
        query = {} if ctx.all_access else {"sede_id": {"$in": list(ctx.sede_ids)}}
        if parent_id:
            query["parent_id"] = parent_id
    appointments = await db.appointments.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return appointments


@router.post("", status_code=201)
async def create_appointment(
    payload: AppointmentCreate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()

    # parent_id e sede_id derivati SERVER-SIDE, mai dal body.
    if ctx.role == "parent":
        parent = ctx.user                       # se stesso
        parent_id = ctx.user_id
    else:
        if not payload.parent_id:
            raise HTTPException(status_code=400, detail="parent_id obbligatorio")
        parent = await db.users.find_one({"id": payload.parent_id}, {"_id": 0})
        if not parent:
            raise HTTPException(status_code=404, detail="Genitore non trovato")
        parent_id = parent["id"]
        # Lo staff può creare solo per genitori della propria sede (404 se cross-sede).
        ctx.assert_sede(parent.get("sede_id"))

    sede_id = parent.get("sede_id")
    parent_name  = parent.get("name", "Sconosciuto")
    parent_email = parent.get("email")

    doc = payload.model_dump()
    doc["parent_id"]   = parent_id              # override server-side
    doc["sede_id"]     = sede_id                # derivato server-side
    doc["id"]          = str(uuid.uuid4())
    doc["parent_name"] = parent_name
    doc["status"]      = AppointmentStatus.pending
    doc["created_at"]  = datetime.now(timezone.utc).isoformat()
    await db.appointments.insert_one(doc)
    doc.pop("_id", None)

    # ── Notifiche email (non bloccanti) ───────────────────────────────────────
    await send_appointment_email(
        to_email=ADMIN_EMAIL, parent_name=parent_name, date=payload.date,
        time_slot=payload.time_slot, reason=payload.reason, status="pending",
    )
    if parent_email:
        await send_appointment_email(
            to_email=parent_email, parent_name=parent_name, date=payload.date,
            time_slot=payload.time_slot, reason=payload.reason, status="pending",
        )

    return doc


@router.put("/{apt_id}/status")
async def update_appointment_status(
    apt_id: str,
    status: AppointmentStatus,
    ctx: TenantContext = Depends(get_tenant_context),
):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()

    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(status_code=404, detail="Appuntamento non trovato")
    ctx.assert_sede(apt.get("sede_id"))         # 404 se appuntamento di un'altra sede

    await db.appointments.update_one({"id": apt_id}, {"$set": {"status": status}})

    # Notifica alla famiglia quando lo stato cambia
    if status in (AppointmentStatus.confirmed, AppointmentStatus.cancelled):
        parent = await db.users.find_one({"id": apt.get("parent_id")}, {"_id": 0})
        if parent and parent.get("email"):
            await send_appointment_email(
                to_email=parent["email"],
                parent_name=parent.get("name", ""),
                date=apt["date"],
                time_slot=apt["time_slot"],
                reason=apt.get("reason", ""),
                status=status.value if hasattr(status, "value") else str(status),
            )

    return {"message": "Stato aggiornato", "status": status}


@router.delete("/{apt_id}")
async def delete_appointment(
    apt_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Cancella un appuntamento — genitore proprietario o admin della stessa sede."""
    db = get_db()
    apt = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    if not apt:
        raise HTTPException(status_code=404, detail="Appuntamento non trovato")

    if ctx.role == "parent":
        if apt.get("parent_id") != ctx.user_id:
            raise HTTPException(status_code=404, detail="Appuntamento non trovato")  # 404, non 403
    elif ctx.role == "admin":
        ctx.assert_sede(apt.get("sede_id"))     # 404 se appuntamento di un'altra sede
    else:
        raise HTTPException(status_code=403, detail="Permesso negato")

    await db.appointments.delete_one({"id": apt_id})
    return {"message": "Appuntamento cancellato"}


@router.get("/slots")
async def get_appointment_slots(
    date: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()
    if date:
        query: dict = {"date": date}
        if not ctx.all_access:
            query["sede_id"] = {"$in": list(ctx.sede_ids)}   # slot occupati solo della propria sede
        booked = await db.appointments.find(query, {"_id": 0}).to_list(100)
        booked_slots = [a["time_slot"] for a in booked]
        available = [s for s in SLOTS if s not in booked_slots]
        return {"date": date, "available_slots": available, "booked_slots": booked_slots}
    return {"slots": SLOTS}
