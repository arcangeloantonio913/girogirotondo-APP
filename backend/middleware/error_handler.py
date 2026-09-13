"""Centralised error handlers — no stack traces in production responses."""
import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# Fail safe: treat the app as production (hide internal error details) UNLESS an
# explicit development marker is set. A missing or misspelled env variable therefore
# yields the SAFE, non-verbose behaviour instead of leaking raw exception text.
# Dev mode is enabled only when APP_ENV/ENV is a known dev value, or DEV_MODE is truthy.
_DEV_ENV = (
    os.environ.get("APP_ENV")
    or os.environ.get("ENV")
    or ""
).strip().lower()
_DEV_MODE = os.environ.get("DEV_MODE", "").strip().lower() in ("1", "true", "yes", "on")
IS_DEV = _DEV_ENV in ("development", "dev", "local") or _DEV_MODE
IS_PROD = not IS_DEV


def add_error_handlers(app: FastAPI):
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        detail = "Errore interno del server" if IS_PROD else str(exc)
        return JSONResponse(status_code=500, content={"detail": detail})
