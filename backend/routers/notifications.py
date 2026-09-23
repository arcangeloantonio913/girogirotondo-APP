"""Notifications router — FCM token registration and manual push send."""
import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional

from services.database import get_db
from models.notifications import PushTokenRegister, NotificationSend
from middleware.auth import get_current_user, get_tenant_context, TenantContext
from utils.expo_push import send_expo_push

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
        # I GENITORI non hanno class_id: si risolvono tramite i figli (students → parent_ids/
        # child_ids). Lo staff (maestre/admin) per class_id/class_ids. Prima si prendevano solo
        # gli utenti con class_id diretto → i genitori non ricevevano MAI la push di classe.
        uids: set = set()
        staff = await db.users.find(
            {"active": True, "$or": [
                {"class_id": payload.class_id},
                {"class_ids": payload.class_id},
            ]},
            {"id": 1},
        ).to_list(1000)
        uids.update(u["id"] for u in staff)
        students = await db.students.find(
            {"class_id": payload.class_id}, {"id": 1, "parent_id": 1, "parent_ids": 1}
        ).to_list(500)
        student_ids = [s["id"] for s in students if s.get("id")]
        for s in students:
            if s.get("parent_id"):
                uids.add(s["parent_id"])
            for pid in (s.get("parent_ids") or []):
                uids.add(pid)
        if student_ids:
            parents = await db.users.find(
                {"role": "parent", "active": True, "$or": [
                    {"child_ids": {"$in": student_ids}},
                    {"child_id": {"$in": student_ids}},
                ]},
                {"id": 1},
            ).to_list(1000)
            uids.update(p["id"] for p in parents)
        tokens = await _tokens_for(list(uids))

    if not tokens:
        # Nessun destinatario lecito -> NON inviare nulla (nessuna push emessa).
        return {"sent": 0, "message": "Nessun destinatario trovato"}

    # I token salvati sono Expo (non FCM): si invia via Expo Push API, altrimenti la push
    # manuale non verrebbe mai consegnata.
    # In un thread separato: send_expo_push è sincrona/bloccante (urllib, timeout 15s) e
    # bloccherebbe l'INTERO event loop per la durata dell'invio a tutti i token.
    sent = await asyncio.to_thread(send_expo_push, tokens, payload.title, payload.body, payload.data)
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
