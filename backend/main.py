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


# --- Temporary staff seed endpoint (remove after use) ---
import uuid as _uuid
from datetime import datetime as _dt, timezone as _tz
from fastapi import Query as _Query
from services.database import get_db as _get_db

_STAFF_DATA = [
    ("Teresa","Melignano","melignanoteresa@gmail.com","$2b$12$9fH3ov/CF6jcGkgOAiBO/OMgKMBRkDfeJsIQcQqJaTFgkXApKoQ/y","admin"),
    ("Giovanna","Melignano","giovannamelignano@gmail.com","$2b$12$Xo56iatrMOMRQKmd0uK36.oQoy.jGUbgYHAo/Qp6h4LlG7GTt7YC2","admin"),
    ("Maria Grazia","Schiera","mariucciasc@gmail.com","$2b$12$TJOa3ggfxZ3w0e/xRXopZ.kTEDnvRJroa9YHQxe7yEK.hTCOndKwm","admin"),
    ("Giorgia","Greco","giorgia.greco1495@gmail.com","$2b$12$vKjnjPeorc2k.gLRA2wL6O5dRmMUldiTzY.S1aXGDH1X2Z98e9qhK","teacher"),
    ("Marika","Russo","graziamaruikarusso@gmail.com","$2b$12$/QHmyVxIOW8qb6U9upddCuVb4oLphn8y2STfzAO5LjZSjNHzDgeoC","teacher"),
    ("Chiara","Lionetti","chiaralionetti98@gmail.com","$2b$12$JKuH9nqebV9udV/mUEqaqOuVgN5g/GTIHBduTSaiGELPlT.tT0n.u","teacher"),
    ("Rachele","Impastato","rachele.impastato@gmail.com","$2b$12$jpyOLURQHQq3zW8bNBsiDeu9.8zNPA0Y6Ovr.vIaFDqrcaAn.1W4a","teacher"),
    ("Loredana","Pillitteri","loredana.pillitteri@hotmail.it","$2b$12$1zYeh1Nq7dz0KL/fI.jU7ud7iWKWSsjvFtHaLCCVawhT1WP0Wdylq","teacher"),
    ("Elisabetta","Saitta","saitta.es@libero.it","$2b$12$NPmGdg.CbaoOBmkwgMDNE.T/LDXjiLe3V1pEPlv/OBVNoZrfC9mCS","teacher"),
    ("Sefora","Caruso","seficar@hotmail.it","$2b$12$QOu9t.lw31blOpR4gRGbceY2F2rdsiyiroiIoyY5OeUqTCH0ZFwGG","teacher"),
    ("Marzia","Barone","marziabarone34@gmail.com","$2b$12$Bzn3yoMgNH6b.RoVgKYVQuiL5NzW9t.aT8SjDfEuv5cf5GK8IZ9eu","teacher"),
    ("Gabriella","Franco","gabri.franco@hotmail.it","$2b$12$u5eLZFBtH/V5nu.3VWVWJOKz/wkp11.Q.32.hOolsDynHD2p1m50a","teacher"),
    ("Claudia","Pizzo","claudiapizzo29@outlook.it","$2b$12$J0xmt9dEZlEx2.Uyu1Rw5.weWSRzN.YPUIPwW3mzBHSZ713HTYXwO","teacher"),
    ("Tatiana","Cardinale","tatianacardinale@icloud.com","$2b$12$6LvPPv9XuembCWB79g5fcesTtuHBBc9C.D/cVIqt9Os8hyei2Jcpu","teacher"),
]

@app.post("/api/internal/seed-staff")
async def seed_staff(secret: str = _Query(...)):
    if secret != "ggt-seed-2026":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
    db = _get_db()
    now = _dt.now(_tz.utc).isoformat()
    created, skipped = 0, 0
    for name, cognome, email, pw_hash, role in _STAFF_DATA:
        existing = await db.users.find_one({"email": email})
        if existing:
            skipped += 1
            continue
        await db.users.insert_one({
            "id": str(_uuid.uuid4()),
            "firebase_uid": None,
            "name": name,
            "cognome": cognome,
            "email": email,
            "password": pw_hash,
            "role": role,
            "class_id": None,
            "child_id": None,
            "avatar_url": None,
            "active": True,
            "created_at": now,
        })
        created += 1
    return {"created": created, "skipped": skipped, "total": len(_STAFF_DATA)}


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
