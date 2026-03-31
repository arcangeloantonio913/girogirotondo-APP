"""Centralised error handlers — no stack traces in production responses."""
import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)
IS_PROD = os.environ.get("VERCEL_ENV") == "production"


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
