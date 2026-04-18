"""Girogirotondo API — FastAPI entry point."""
# ── SSL fix: lower OpenSSL SECLEVEL to 1 for Railway + MongoDB Atlas ─────────
# Railway's OpenSSL 3.x defaults to SECLEVEL=2 which causes
# TLSV1_ALERT_INTERNAL_ERROR with Atlas M0. Patching create_default_context
# here (before any other import uses ssl) forces SECLEVEL=1.
import ssl as _ssl_mod
_orig_create_default_context = _ssl_mod.create_default_context

def _patched_create_default_context(*args, **kwargs):
    ctx = _orig_create_default_context(*args, **kwargs)
    try:
        ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
    except Exception:
        pass
    return ctx

_ssl_mod.create_default_context = _patched_create_default_context
# ─────────────────────────────────────────────────────────────────────────────

import logging
import os

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

_SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if _SENTRY_DSN:
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        traces_sample_rate=0.2,   # 20% delle transazioni tracciate (regola in produzione)
        profiles_sample_rate=0.1,
        environment=os.environ.get("RAILWAY_ENVIRONMENT", "development"),
        send_default_pii=False,   # Nessun dato personale inviato a Sentry (GDPR)
    )

from services.database import seed_database, get_client
from middleware.error_handler import add_error_handlers
from middleware.rate_limiter import limiter
from utils.firebase_client import init_firebase

# Routers
from routers.auth import router as auth_router
from routers.users import router as users_router
from routers.classes import router as classes_router
from routers.students import router as students_router
from routers.griglia import router as griglia_router
from routers.diary import router as diary_router
from routers.gallery import router as gallery_router
from routers.meals import router as meals_router
from routers.appointments import router as appointments_router
from routers.documents import router as documents_router
from routers.read_receipts import router as read_receipts_router
from routers.calendar import router as calendar_router
from routers.notifications import router as notifications_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Girogirotondo API", version="2.0.0")

# --- Middleware ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
add_error_handlers(app)

_raw_origins = os.environ.get("CORS_ORIGINS", "*")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# --- Routers ---
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(classes_router)
app.include_router(students_router)
app.include_router(griglia_router)
app.include_router(diary_router)
app.include_router(gallery_router)
app.include_router(meals_router)
app.include_router(appointments_router)
app.include_router(documents_router)
app.include_router(read_receipts_router)
app.include_router(calendar_router)
app.include_router(notifications_router)


# --- Security headers middleware ---
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# --- Health check ---
@app.get("/api/")
async def root():
    return {"message": "Girogirotondo API v2"}


# --- Temporary password reset endpoint (remove after use) ---
import uuid as _uuid
from datetime import datetime as _dt, timezone as _tz
from fastapi import Query as _Query
from services.database import get_db as _get_db

_NEW_PASSWORDS = [
    ("melignanoteresa@gmail.com",      "$2b$12$jX3uRmhVAp6qCoHXftB1Su2pwkUMgceR/qD0prxBJz2PUh9PTd5YO"),
    ("giovannamelignano@gmail.com",    "$2b$12$ncc35S6vRjnHPERIZOFJZOAvDOp9ImUNIIqYZUBg5HG./m.FCWlPm"),
    ("mariucciasc@gmail.com",          "$2b$12$A10UrhkD79BQA5reOUyQGuPko6F65YTGqW1fyvv7QQjK2rkQflODW"),
    ("giorgia.greco1495@gmail.com",    "$2b$12$Ub8vQ7ehm8WMFdt7KmRIr.d6Bkdno7IXJqPD69boZP.oxO9FXhqWe"),
    ("graziamaruikarusso@gmail.com",   "$2b$12$IFGVHC0tEZdg9zl5Q0MKUONMElf2xl7BxppNJxs11/cLuhQvPs5/."),
    ("chiaralionetti98@gmail.com",     "$2b$12$l2M6UFHg7/N/81Z.Dk5Oi.T6c4OcVO4ILsT.yzOTju16CvEL7y5l."),
    ("rachele.impastato@gmail.com",    "$2b$12$TxAYYQZ2dUN6gjRFH.BSROP6PdCqAF6rxz0XeqkThVad96CfhHs8y"),
    ("loredana.pillitteri@hotmail.it", "$2b$12$EzhXUWYc8l4Q7ao8o6KRVORRXFgNnX5yqaZIrQ.rQFUEjInesBRH."),
    ("saitta.es@libero.it",            "$2b$12$VHW1IJFNl4GzEt2gZpjPi.mBO2hF89oGbKuTyqmyTK3XE2RU0pF2K"),
    ("seficar@hotmail.it",             "$2b$12$479dECp9ErEpJL7Sw0cFp.Mq5HJN5sPtXe7anQdqCyBP4Oe3vXv06"),
    ("marziabarone34@gmail.com",       "$2b$12$p6sPsF0qZYjsND1d14gPt.bdWdpsbMlktuDPZXSeSnKo5PuRRL3g6"),
    ("gabri.franco@hotmail.it",        "$2b$12$jnbOHiCmOmgZpQYgPipnkudsvSOK1GYhn.d9i7wInbn5WC3lyqBbG"),
    ("claudiapizzo29@outlook.it",      "$2b$12$/naVQJ8EvuIOVYiFKBphTukPlTMMmvzufmh5LG9lK68xbEdDSQ8E6"),
    ("tatianacardinale@icloud.com",    "$2b$12$sXKJPPylylVGy0J1Cvh4EeKoRreIsyYHoNghopVMRcVIrHUhxsMr."),
]

@app.post("/api/internal/reset-passwords")
async def reset_passwords(secret: str = _Query(...)):
    if secret != "ggt-reset-2026":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
    db = _get_db()
    updated = 0
    for email, pw_hash in _NEW_PASSWORDS:
        result = await db.users.update_one({"email": email}, {"$set": {"password": pw_hash}})
        if result.modified_count:
            updated += 1
    return {"updated": updated, "total": len(_NEW_PASSWORDS)}
# --- End temporary endpoint ---


# --- Lifecycle ---
@app.on_event("startup")
async def startup():
    try:
        init_firebase()
    except Exception as exc:
        logger.warning("Firebase initialization skipped at startup: %s", exc)
    try:
        await seed_database()
    except Exception as exc:
        logger.warning("Database seeding skipped at startup: %s", exc)


@app.on_event("shutdown")
async def shutdown():
    try:
        get_client().close()
    except Exception:
        pass
