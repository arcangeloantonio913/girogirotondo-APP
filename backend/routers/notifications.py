"""Notifications router — FCM token registration and manual push send."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional

from services.database import get_db
from models.notifications import PushTokenRegister, NotificationSend
from middleware.auth import get_current_user, get_tenant_context, TenantContext
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
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Push manuale (admin). Ogni ramo è scopato per le sedi del caller (superadmin = tutte)
    così l'annuncio globale legittimo resta possibile. I destinatari sono SEMPRE derivati/
    ri-scopati server-side: un token di un'altra sede non riceve mai la push."""
    if ctx.role != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono inviare notifiche")

    db = get_db()
    sede_ids = list(ctx.sede_ids)

    async def _tokens_for(user_ids: list) -> list:
        if not user_ids:
            return []
        cur = db.push_tokens.find({"user_id": {"$in": user_ids}}, {"token": 1})
        return [d["token"] async for d in cur]

    tokens = []

    if payload.user_ids:
        # FILTER-OUT (fire-once): tieni solo gli id la cui sede è consentita, scarta gli altri.
        if ctx.all_access:
            allowed_uids = list(payload.user_ids)
        else:
            rows = await db.users.find(
                {"id": {"$in": payload.user_ids}, "sede_id": {"$in": sede_ids}}, {"id": 1}
            ).to_list(1000)
            allowed_uids = [u["id"] for u in rows]
        tokens = await _tokens_for(allowed_uids)

    elif payload.roles:
        # Vettore peggiore: filtra gli utenti per sede consentita.
        q: dict = {"role": {"$in": payload.roles}, "active": True}
        if not ctx.all_access:
            q["sede_id"] = {"$in": sede_ids}
        users = await db.users.find(q, {"id": 1}).to_list(1000)
        tokens = await _tokens_for([u["id"] for u in users])

    elif payload.class_id:
        if not ctx.all_access:
            ctx.assert_class(payload.class_id)   # 404 cross-sede PRIMA di risolvere destinatari
        users = await db.users.find(
            {"class_id": payload.class_id, "active": True}, {"id": 1}
        ).to_list(1000)
        tokens = await _tokens_for([u["id"] for u in users])

    if not tokens:
        # Nessun destinatario lecito -> NON chiamare send_multicast (nessuna push emessa).
        return {"sent": 0, "message": "Nessun destinatario trovato"}

    sent = send_multicast(tokens, payload.title, payload.body, payload.data)
    return {"sent": sent, "total_tokens": len(tokens)}


# ---------------------------------------------------------------------------
# POST /api/push-tokens  (alias semplificato per il client mobile)
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
async def register_token_alias(
    payload: PushTokenRegister,
    current_user: dict = Depends(get_current_user),
):
    """Alias di /register-token — compatibilità client mobile."""
    return await register_token(payload, current_user)
