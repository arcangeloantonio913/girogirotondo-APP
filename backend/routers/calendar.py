"""Calendar router — create/read/update/delete events + upcoming."""
import uuid
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.calendar import CalendarEventCreate, CalendarEventUpdate
from middleware.auth import get_current_user
from utils.push_notifications import notify_class, notify_role

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/events")
async def get_events(
    month: Optional[str] = None,   # format: YYYY-MM
    classe_id: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if month:
        query["data_inizio"] = {"$regex": f"^{month}"}
    if classe_id:
        query["$or"] = [{"classe_id": classe_id}, {"classe_id": None}]
    if tipo:
        query["tipo"] = tipo

    # Filter by visibility
    role = current_user.get("role", "parent")
    query["visibile_a"] = role

    events = await db.calendar_events.find(query, {"_id": 0}).to_list(500)
    return events


@router.get("/events/upcoming")
async def get_upcoming_events(current_user: dict = Depends(get_current_user)):
    """Returns events in the next 7 days."""
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    in_7_days = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")

    role = current_user.get("role", "parent")
    query = {
        "data_inizio": {"$gte": today, "$lte": in_7_days},
        "visibile_a": role,
    }
    events = await db.calendar_events.find(query, {"_id": 0}).to_list(50)
    return events


@router.post("/events", status_code=201)
async def create_event(
    payload: CalendarEventCreate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    db = get_db()
    event_id = str(uuid.uuid4())
    doc = payload.model_dump()
    doc["id"] = event_id
    doc["creator_id"] = current_user["id"]
    doc["visibile_a"] = [v.value if hasattr(v, "value") else v for v in doc["visibile_a"]]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.calendar_events.insert_one(doc)
    doc.pop("_id", None)

    # Auto-notify affected users
    if payload.classe_id:
        await notify_class(
            db, payload.classe_id, list(payload.visibile_a),
            title="Nuovo evento in calendario",
            body=payload.titolo,
            data={"type": "calendar", "event_id": event_id},
        )
    else:
        for role_target in payload.visibile_a:
            role_val = role_target.value if hasattr(role_target, "value") else role_target
            await notify_role(
                db, role_val,
                title="Nuovo evento in calendario",
                body=payload.titolo,
                data={"type": "calendar", "event_id": event_id},
            )

    return doc


@router.put("/events/{event_id}")
async def update_event(
    event_id: str,
    payload: CalendarEventUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    db = get_db()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    if "visibile_a" in updates:
        updates["visibile_a"] = [
            v.value if hasattr(v, "value") else v for v in updates["visibile_a"]
        ]

    result = await db.calendar_events.update_one({"id": event_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Evento non trovato")

    event = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})
    return event


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    result = await db.calendar_events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evento non trovato")
    return {"message": "Evento eliminato"}
