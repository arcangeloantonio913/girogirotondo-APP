"""
Expo Push Notifications — usa l'API HTTP di Expo (no SDK, no Firebase).
Funziona sia con account Expo gratuito che a pagamento.
"""
import json
import logging
import urllib.request
import urllib.error
from typing import List, Optional

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _is_expo_token(token: str) -> bool:
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


def send_expo_push(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
    sound: str = "default",
) -> int:
    """
    Invia notifiche push tramite Expo Push API.
    Ritorna il numero di notifiche inviate con successo.
    """
    expo_tokens = [t for t in tokens if _is_expo_token(t)]
    if not expo_tokens:
        logger.debug("Nessun token Expo valido trovato tra %d token", len(tokens))
        return 0

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "sound": sound,
            "data": data or {},
            "priority": "high",
        }
        for token in expo_tokens
    ]

    try:
        payload = json.dumps(messages).encode("utf-8")
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            errors = [r for r in result.get("data", []) if r.get("status") == "error"]
            if errors:
                logger.warning("Expo push errors: %s", errors[:3])
            success = len(expo_tokens) - len(errors)
            logger.info("Expo push: %d/%d inviati", success, len(expo_tokens))
            return success
    except urllib.error.HTTPError as e:
        logger.error("Expo push HTTP error %d: %s", e.code, e.read().decode()[:200])
        return 0
    except Exception as exc:
        logger.error("Expo push error: %s", exc)
        return 0


async def notify_users(db, user_ids: List[str], title: str, body: str, data: Optional[dict] = None) -> int:
    """Invia notifica a una lista di user_id."""
    if not user_ids:
        return 0
    tokens_cursor = db.push_tokens.find({"user_id": {"$in": user_ids}}, {"token": 1})
    tokens = [doc["token"] async for doc in tokens_cursor]
    return send_expo_push(tokens, title, body, data)


async def notify_role(db, role: str, sede_id: Optional[str], title: str, body: str, data: Optional[dict] = None) -> int:
    """Invia notifica a tutti gli utenti con un certo ruolo (e sede opzionale)."""
    query: dict = {"role": role, "active": True}
    if sede_id:
        query["sede_id"] = sede_id
    users = await db.users.find(query, {"id": 1}).to_list(1000)
    user_ids = [u["id"] for u in users]
    return await notify_users(db, user_ids, title, body, data)


async def notify_parents_of_class(db, class_id: str, title: str, body: str, data: Optional[dict] = None) -> int:
    """Invia notifica ai genitori degli alunni di una classe."""
    students = await db.students.find({"class_id": class_id}, {"parent_ids": 1, "parent_id": 1}).to_list(500)
    parent_ids = []
    for s in students:
        if s.get("parent_ids"):
            parent_ids.extend(s["parent_ids"])
        elif s.get("parent_id"):
            parent_ids.append(s["parent_id"])
    # Cerca anche tramite child_ids
    if not parent_ids:
        student_ids = [s["id"] for s in students if "id" in s]
        if student_ids:
            parents = await db.users.find(
                {"role": "parent", "active": True, "$or": [
                    {"child_ids": {"$in": student_ids}},
                    {"child_id": {"$in": student_ids}},
                ]}, {"id": 1}
            ).to_list(500)
            parent_ids = [p["id"] for p in parents]
    return await notify_users(db, list(set(parent_ids)), title, body, data)
