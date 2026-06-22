"""Centralised error handlers — no stack traces in production responses."""
import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# Detect production across hosts. The backend runs on Railway (RAILWAY_ENVIRONMENT),
# not Vercel — relying on VERCEL_ENV alone left IS_PROD always False in prod, leaking
# raw exception text to clients. Check Railway/Vercel/APP_ENV; default to NOT prod only
# when no environment marker is present (i.e. local dev).
_ENV = (
    os.environ.get("RAILWAY_ENVIRONMENT")
    or os.environ.get("VERCEL_ENV")
    or os.environ.get("APP_ENV")
    or ""
).lower()
IS_PROD = _ENV in ("production", "prod")


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
