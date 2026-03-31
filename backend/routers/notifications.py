"""Notifications router — FCM token registration and manual push send."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional

from services.database import get_db
from models.notifications import PushTokenRegister, NotificationSend
from middleware.auth import get_current_user
from utils.push_notifications import send_push_notification, send_multicast, notify_role

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# POST /api/notifications/register-token
# ---------------------------------------------------------------------------

@router.post("/register-token", status_code=201)
async def register_token(
    payload: PushTokenRegister,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["id"]

    existing = await db.push_tokens.find_one({"token": payload.token})
    if existing:
        # Re-associate token with current user if it moved
        await db.push_tokens.update_one(
            {"token": payload.token},
            {"$set": {"user_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"message": "Token aggiornato"}

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "token": payload.token,
        "device_type": payload.device_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.push_tokens.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# DELETE /api/notifications/token
# ---------------------------------------------------------------------------

@router.delete("/token")
async def delete_token(
    token: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    result = await db.push_tokens.delete_one(
        {"token": token, "user_id": current_user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token non trovato")
    return {"message": "Token rimosso"}


# ---------------------------------------------------------------------------
# POST /api/notifications/send  (admin only)
# ---------------------------------------------------------------------------

@router.post("/send")
async def send_notification(
    payload: NotificationSend,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono inviare notifiche")

    db = get_db()
    tokens = []

    if payload.user_ids:
        tokens_cursor = db.push_tokens.find(
            {"user_id": {"$in": payload.user_ids}}, {"token": 1}
        )
        tokens = [doc["token"] async for doc in tokens_cursor]

    elif payload.roles:
        users = await db.users.find(
            {"role": {"$in": payload.roles}, "active": True}, {"id": 1}
        ).to_list(1000)
        user_ids = [u["id"] for u in users]
        tokens_cursor = db.push_tokens.find(
            {"user_id": {"$in": user_ids}}, {"token": 1}
        )
        tokens = [doc["token"] async for doc in tokens_cursor]

    elif payload.class_id:
        users = await db.users.find(
            {"class_id": payload.class_id, "active": True}, {"id": 1}
        ).to_list(1000)
        user_ids = [u["id"] for u in users]
        tokens_cursor = db.push_tokens.find(
            {"user_id": {"$in": user_ids}}, {"token": 1}
        )
        tokens = [doc["token"] async for doc in tokens_cursor]

    if not tokens:
        return {"sent": 0, "message": "Nessun destinatario trovato"}

    sent = send_multicast(tokens, payload.title, payload.body, payload.data)
    return {"sent": sent, "total_tokens": len(tokens)}
