from typing import List, Optional
from pydantic import BaseModel


class PushTokenRegister(BaseModel):
    token: str
    device_type: Optional[str] = None  # ios | android | web


class NotificationSend(BaseModel):
    title: str
    body: str
    roles: Optional[List[str]] = None       # target by role
    user_ids: Optional[List[str]] = None    # target specific users
    class_id: Optional[str] = None          # target a class
    data: Optional[dict] = None
