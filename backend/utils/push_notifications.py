"""FCM push notification helpers."""
import logging
from typing import List, Optional

from utils.firebase_client import get_messaging, is_initialized

logger = logging.getLogger(__name__)


def send_push_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> bool:
    """Send a single FCM push notification. Returns True on success."""
    if not is_initialized():
        logger.warning("FCM not configured – skipping push notification")
        return False
    try:
        messaging = get_messaging()
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={str(k): str(v) for k, v in (data or {}).items()},
            token=token,
        )
        messaging.send(message)
        return True
    except Exception as exc:
        logger.warning("FCM send failed for token %s: %s", token[:10], exc)
        return False


def send_multicast(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """Send to multiple tokens. Returns count of successful sends."""
    if not is_initialized() or not tokens:
        return 0
    try:
        messaging = get_messaging()
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data={str(k): str(v) for k, v in (data or {}).items()},
            tokens=tokens,
        )
        response = messaging.send_each_for_multicast(message)
        return response.success_count
    except Exception as exc:
        logger.warning("FCM multicast failed: %s", exc)
        return 0


async def notify_role(db, role: str, title: str, body: str, data: Optional[dict] = None):
    """Send push notification to all active devices for a given role."""
    users = await db.users.find({"role": role, "active": True}, {"id": 1}).to_list(1000)
    user_ids = [u["id"] for u in users]
    if not user_ids:
        return

    tokens_cursor = db.push_tokens.find(
        {"user_id": {"$in": user_ids}}, {"token": 1}
    )
    tokens = [doc["token"] async for doc in tokens_cursor]
    if tokens:
        send_multicast(tokens, title, body, data)


async def notify_class(
    db,
    class_id: str,
    roles: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
):
    """Send push notification to users of specified roles in a class."""
    query = {"class_id": class_id, "role": {"$in": roles}, "active": True}
    users = await db.users.find(query, {"id": 1}).to_list(1000)
    user_ids = [u["id"] for u in users]
    if not user_ids:
        return

    tokens_cursor = db.push_tokens.find(
        {"user_id": {"$in": user_ids}}, {"token": 1}
    )
    tokens = [doc["token"] async for doc in tokens_cursor]
    if tokens:
        send_multicast(tokens, title, body, data)
