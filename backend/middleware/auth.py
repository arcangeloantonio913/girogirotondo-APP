"""Authentication middleware — verifies Firebase ID token (primary) or custom JWT (dev fallback).

Multi-Tenant Security
---------------------
* Admin/SuperAdmin: sede_id viene letto dall'header X-Sede-Id (inviato dal frontend).
  - SuperAdmin (is_superadmin=True): può accedere a qualsiasi sede valida.
  - Admin normale: può accedere SOLO alla propria sede (current_user.sede_id deve corrispondere).
* Teacher: sede_id viene letto ESCLUSIVAMENTE da current_user.sede_id — header ignorato.
  Un malintenzionato NON può manipolare l'API per accedere a un'altra sede.
* Parent: sede implicita dai figli — nessun parametro esterno accettato.
"""
import os
import logging
from typing import Optional

import jwt
from fastapi import HTTPException, Header, Depends

from services.database import get_db
from utils.firebase_client import get_auth, is_initialized

logger = logging.getLogger(__name__)

_JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"

if not _JWT_SECRET:
    logger.warning("JWT_SECRET env variable is not set — custom JWT fallback disabled.")

if DEV_MODE:
    logger.warning(
        "DEV_MODE is enabled: custom JWT fallback is active. "
        "NEVER enable DEV_MODE in production."
    )


def _decode_custom_jwt(token: str) -> dict:
    if not _JWT_SECRET:
        raise HTTPException(status_code=401, detail="JWT_SECRET non configurato")
    try:
        return jwt.decode(token, _JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")


async def get_current_user(authorization: Optional[str] = Header(None)):
    """FastAPI dependency that returns the authenticated MongoDB user dict."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token non fornito")

    token = authorization.split(" ", 1)[1]
    db = get_db()

    # --- Primary: Firebase ID token ---
    if is_initialized():
        try:
            firebase_auth = get_auth()
            decoded = firebase_auth.verify_id_token(token)
            uid = decoded["uid"]
            user = await db.users.find_one(
                {"firebase_uid": uid, "active": True}, {"_id": 0, "password": 0, "admin_password": 0}
            )
            if not user:
                raise HTTPException(
                    status_code=401,
                    detail="Profilo utente non trovato. Registrarsi prima con /api/auth/register.",
                )
            return user
        except HTTPException:
            raise
        except Exception as exc:
            logger.debug("Firebase token verification failed: %s", exc)

    # --- Fallback: custom JWT (always active when JWT_SECRET is set) ---
    if _JWT_SECRET:
        payload = _decode_custom_jwt(token)
        user = await db.users.find_one(
            {"id": payload["user_id"], "active": True},
            {"_id": 0, "password": 0, "admin_password": 0},
        )
        if user:
            return user

    raise HTTPException(status_code=401, detail="Token non valido o Firebase non configurato")


def require_role(*roles: str):
    """Dependency factory that checks the authenticated user's role.

    NOTE: the inner dependency must resolve the user via get_current_user — using
    Header(None) (the previous behaviour) bound current_user to a non-existent HTTP
    header, so the check raised AttributeError/500 instead of enforcing the role.
    """
    async def _check(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Permesso negato")
        return current_user
    return _check


def require_superadmin(current_user: dict = Depends(get_current_user)):
    """Dependency: consente l'operazione solo al SuperAdmin (is_superadmin=True)."""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Solo il SuperAdmin può eseguire questa operazione")
    return current_user


# ---------------------------------------------------------------------------
# Multi-Tenant: Sede Validation
# ---------------------------------------------------------------------------

# Sedi valide = DATA-DRIVEN da db.sedi (active=True). Nessun set hardcoded: una sede
# appena creata è valida SUBITO (query diretta, coerente cross-worker; nessuna cache —
# vedi railway.toml --workers 2, dove una cache in-memory sarebbe per-worker).

async def get_valid_sede_ids(db) -> set:
    rows = await db.sedi.find({"active": True}, {"_id": 0, "id": 1}).to_list(200)
    return {r["id"] for r in rows if r.get("id")}


async def get_default_sede_id(db) -> Optional[str]:
    """Sede di 'atterraggio' DETERMINISTICA quando non è indicata (es. superadmin senza
    X-Sede-Id): la sede attiva più VECCHIA (sort created_at asc, tiebreak id asc). È
    stabile anche aggiungendo nuove sedi e riproduce il vecchio default 'girogirotondo'
    senza hardcoding. NB: senza sort esplicito Mongo userebbe l'ordine naturale (non
    deterministico). Temporaneo: in Fase C, con i client che inviano sempre X-Sede-Id,
    questo caso diventerà un 400 esplicito."""
    rows = await db.sedi.find({"active": True}, {"_id": 0, "id": 1}) \
        .sort([("created_at", 1), ("id", 1)]).to_list(1)
    return rows[0]["id"] if rows else None


async def validate_admin_sede_access(current_user: dict, x_sede_id: Optional[str]) -> str:
    """
    Valida l'accesso dell'admin alla sede richiesta (header X-Sede-Id).

    Regole:
    - SuperAdmin: qualsiasi sede attiva.
    - Admin normale: SOLO la propria sede.
    - Nessuna sede indicata: default = prima sede attiva (data-driven, non hardcoded).
    """
    role = current_user.get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono specificare la sede")

    db = get_db()
    valid = await get_valid_sede_ids(db)

    requested_sede = (x_sede_id or "").strip() or current_user.get("sede_id")
    if not requested_sede:
        requested_sede = await get_default_sede_id(db)

    if not requested_sede or requested_sede not in valid:
        raise HTTPException(status_code=400, detail=f"Sede non valida: {requested_sede}")

    if not current_user.get("is_superadmin", False):
        # Admin normale: può accedere solo alla propria sede
        user_sede = current_user.get("sede_id")
        if user_sede and user_sede != requested_sede:
            raise HTTPException(
                status_code=403,
                detail=f"Accesso negato: non hai i permessi per la sede '{requested_sede}'",
            )

    return requested_sede


def get_teacher_sede_id(current_user: dict) -> str:
    """
    Restituisce la sede_id della maestra dal proprio profilo.
    NON accetta input esterno — sicurezza cross-tenant garantita.
    Deny esplicito se il profilo non ha sede (niente più fallback hardcoded a 'girogirotondo').
    """
    sede_id = current_user.get("sede_id")
    if not sede_id:
        raise HTTPException(
            status_code=403,
            detail="Profilo maestra senza sede assegnata — contattare l'amministratore",
        )
    return sede_id


# ---------------------------------------------------------------------------
# Multi-Tenant: unified per-request authorization context (get_tenant_context)
# ---------------------------------------------------------------------------
#
# Single source of truth for "what may this caller touch?". Routers that handle
# tenant- or child-scoped data should depend on get_tenant_context and use:
#   - ctx.assert_class(class_id) / await ctx.assert_student(student_id) / ctx.assert_sede(sede_id)
#       -> raise 404 (NOT 403) on denial, so object existence is not leaked
#   - ctx.class_filter()         -> base Mongo fragment scoping a list query by class
# Superadmin has all-access. Scoping is class-based (derived from the `classes`
# collection, which carries sede_id) so no historical-document backfill is needed.

async def _resolve_class(db, class_id):
    if not class_id:
        return None
    return await db.classes.find_one({"id": class_id}, {"_id": 0, "id": 1, "sede_id": 1})


async def _resolve_student(db, student_id):
    if not student_id:
        return None
    return await db.students.find_one(
        {"id": student_id}, {"_id": 0, "id": 1, "class_id": 1, "sede_id": 1}
    )


class TenantContext:
    """Resolved per-request view of the caller's allowed tenant scope."""

    def __init__(self, db, user: dict):
        self.db = db
        self.user = user
        self.role = user.get("role")
        self.user_id = user.get("id")
        self.is_superadmin = bool(user.get("is_superadmin"))
        self.all_access = self.is_superadmin
        self.sede_ids: list = []
        self.allowed_class_ids: set = set()
        self.allowed_student_ids: set = set()

    @staticmethod
    def _deny():
        # 404 (not 403) so a caller cannot probe which ids exist.
        raise HTTPException(status_code=404, detail="Risorsa non trovata")

    def assert_sede(self, sede_id):
        if self.all_access:
            return
        if not sede_id or sede_id not in self.sede_ids:
            self._deny()

    def assert_class(self, class_id):
        if self.all_access:
            return
        if not class_id or class_id not in self.allowed_class_ids:
            self._deny()

    async def assert_student(self, student_id):
        if self.all_access:
            return
        if self.role == "parent":
            if student_id not in self.allowed_student_ids:
                self._deny()
            return
        st = await _resolve_student(self.db, student_id)
        if not st or st.get("class_id") not in self.allowed_class_ids:
            self._deny()

    def class_filter(self, field: str = "class_id") -> dict:
        """Mongo fragment scoping a collection to the caller's classes."""
        if self.all_access:
            return {}
        return {field: {"$in": list(self.allowed_class_ids)}}


async def get_tenant_context(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
) -> "TenantContext":
    db = get_db()
    ctx = TenantContext(db, current_user)

    if ctx.all_access:
        ctx.sede_ids = list(await get_valid_sede_ids(db))
        return ctx

    role = ctx.role
    if role == "parent":
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        ctx.allowed_student_ids = set(child_ids)
        if child_ids:
            students = await db.students.find(
                {"id": {"$in": child_ids}}, {"_id": 0, "class_id": 1, "sede_id": 1}
            ).to_list(200)
            ctx.allowed_class_ids = {s["class_id"] for s in students if s.get("class_id")}
            ctx.sede_ids = list({s["sede_id"] for s in students if s.get("sede_id")})
        if not ctx.sede_ids and current_user.get("sede_id"):
            ctx.sede_ids = [current_user["sede_id"]]
    elif role == "teacher":
        ctx.sede_ids = [get_teacher_sede_id(current_user)]
        class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in class_ids:
            class_ids.append(legacy)
        ctx.allowed_class_ids = set(class_ids)
    elif role == "admin":
        sede = await validate_admin_sede_access(current_user, x_sede_id)
        ctx.sede_ids = [sede]
        classes = await db.classes.find({"sede_id": sede}, {"_id": 0, "id": 1}).to_list(2000)
        ctx.allowed_class_ids = {c["id"] for c in classes if c.get("id")}
    # unknown role -> empty scope (deny-by-default)

    return ctx
