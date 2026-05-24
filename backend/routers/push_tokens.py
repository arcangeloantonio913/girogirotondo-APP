"""Push tokens — endpoint semplificato /api/push-tokens per il client mobile."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from services.database import get_db
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/push-tokens", tags=["push-tokens"])

class TokenPayload(BaseModel):
    token: str
    device_type: Optional[str] = None

@router.post("", status_code=201)
async def save_push_token(payload: TokenPayload, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["id"]
    existing = await db.push_tokens.find_one({"token": payload.token})
    if existing:
        await db.push_tokens.update_one(
            {"token": payload.token},
            {"$set": {"user_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Token aggiornato"}
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "token": payload.token,
        "device_type": payload.device_type or "ios",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.push_tokens.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.delete("/{token}")
async def delete_push_token(token: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.push_tokens.delete_one({"token": token, "user_id": current_user["id"]})
    return {"message": "Token rimosso"}
