"""Rate limiting with slowapi.

Key function: rate-limit authenticated requests PER USER (not per IP) so that many
families/teachers behind a single school NAT are not throttled as one. Falls back to
the client IP for unauthenticated requests (correct for login/register/forgot).
"""
import hashlib
import os

import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address


def user_or_ip_key(request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1]
        secret = os.environ.get("JWT_SECRET", "")
        if secret:
            try:
                payload = jwt.decode(
                    token, secret, algorithms=["HS256"], options={"verify_exp": False}
                )
                uid = payload.get("user_id")
                if uid:
                    return f"user:{uid}"
            except Exception:
                pass
        # Firebase / non-HS256 tokens: hash the token for a stable per-session key.
        return "tok:" + hashlib.sha256(token.encode()).hexdigest()[:16]
    return get_remote_address(request)


limiter = Limiter(key_func=user_or_ip_key)

# Decorators to apply on specific endpoints (endpoint must accept `request: Request`):
#   @router.post("/upload")
#   @limiter.limit("60/minute")
#   async def upload(request: Request, ...): ...
