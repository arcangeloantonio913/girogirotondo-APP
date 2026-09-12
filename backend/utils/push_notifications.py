"""Push notification helpers.

NOTA: le notifiche vengono inviate via **Expo Push API** (i token salvati sono token
Expo, non FCM). `notify_role`/`notify_class` delegano a `utils.expo_push` e risolvono i
GENITORI tramite i figli (i genitori non hanno `class_id`), non per class_id diretto.
Le funzioni FCM (`send_push_notification`/`send_multicast`) restano solo per retro-compatibilità.
"""
import logging
from typing import List, Optional

from utils.firebase_client import get_messaging, is_initialized
from utils.expo_push import notify_users as _expo_notify_users

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
    """Notifica (via Expo) tutti gli utenti attivi di un ruolo."""
    users = await db.users.find({"role": role, "active": True}, {"id": 1}).to_list(1000)
    user_ids = [u["id"] for u in users]
    return await _expo_notify_users(db, user_ids, title, body, data)


async def notify_class(
    db,
    class_id: str,
    roles: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
):
    """Notifica (via Expo) gli utenti dei ruoli indicati collegati a una classe.

    I GENITORI non hanno class_id: si risolvono tramite i figli (student.parent_id/
    parent_ids + user.child_ids). Lo staff (maestra/admin) si risolve per class_id/class_ids.
    """
    user_ids: set = set()

    staff_roles = [r for r in roles if r != "parent"]
    if staff_roles:
        staff = await db.users.find(
            {"role": {"$in": staff_roles}, "active": True,
             "$or": [{"class_id": class_id}, {"class_ids": class_id}]},
            {"id": 1},
        ).to_list(1000)
        user_ids.update(u["id"] for u in staff)

    if "parent" in roles:
        students = await db.students.find(
            {"class_id": class_id}, {"id": 1, "parent_id": 1, "parent_ids": 1}
        ).to_list(500)
        student_ids = [s["id"] for s in students if s.get("id")]
        for s in students:
            if s.get("parent_id"):
                user_ids.add(s["parent_id"])
            for pid in (s.get("parent_ids") or []):
                user_ids.add(pid)
        if student_ids:
            parents = await db.users.find(
                {"role": "parent", "active": True, "$or": [
                    {"child_ids": {"$in": student_ids}},
                    {"child_id": {"$in": student_ids}},
                ]},
                {"id": 1},
            ).to_list(1000)
            user_ids.update(p["id"] for p in parents)

    return await _expo_notify_users(db, list(user_ids), title, body, data)
