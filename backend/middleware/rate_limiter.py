"""Rate limiting with slowapi."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Decorators to apply on specific endpoints:
#   @router.post("/upload")
#   @limiter.limit("10/minute")
#   async def upload(..., request: Request): ...
