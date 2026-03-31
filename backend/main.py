"""Girogirotondo API — FastAPI entry point."""
import logging
import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
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


# --- Health check ---
@app.get("/api/")
async def root():
    return {"message": "Girogirotondo API v2"}


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
