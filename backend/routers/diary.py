"""Diary router — /api/diary and /api/diary/entries (alias).

Tenant isolation via get_tenant_context: parents see only their children's class
diary, teachers/admins only their classes/sede, superadmin all. Denied access -> 404.
"""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request

from services.database import get_db
from utils.expo_push import notify_parents_of_class, notify_users
from models.diary import DiaryEntryCreate, DiaryEntryUpdate
from middleware.auth import get_tenant_context, TenantContext, _resolve_class
from middleware.rate_limiter import limiter

router = APIRouter(tags=["diary"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


async def _get_diary(class_id: Optional[str], date: Optional[str], ctx: TenantContext,
                     student_id: Optional[str] = None):
    db = get_db()
    query: dict = {}

    if student_id:
        # Narrow to that specific child's/student's class.
        if ctx.role == "parent":
            if student_id not in ctx.allowed_student_ids:
                raise HTTPException(status_code=404, detail="Risorsa non trovata")
        else:
            await ctx.assert_student(student_id)
        st = await db.students.find_one({"id": student_id}, {"_id": 0, "class_id": 1})
        cls = st.get("class_id") if st else None
        if not cls:
            return []
        ctx.assert_class(cls)
        query["class_id"] = cls
    elif class_id:
        ctx.assert_class(class_id)
        query["class_id"] = class_id
    else:
        if not ctx.all_access and not ctx.allowed_class_ids:
            return []
        query.update(ctx.class_filter())

    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["date"] = date

    # Voci di diario mirate a specifici bambini (student_ids valorizzato): visibili al
    # genitore SOLO se includono un suo figlio. Le voci senza targeting valgono per tutta
    # la classe. Difesa in profondità: oggi l'app maestra non invia student_ids, ma il
    # campo esiste nel modello e non era onorato → potenziale leak su dati di minori.
    if ctx.role == "parent":
        allowed = list(ctx.allowed_student_ids)
        query["$or"] = [
            {"student_ids": {"$in": allowed}},
            {"student_ids": {"$in": [None, []]}},
            {"student_ids": {"$exists": False}},
        ]
    return await db.diary.find(query, {"_id": 0}).to_list(100)


async def _create_diary(entry: DiaryEntryCreate, ctx: TenantContext):
    db = get_db()
    # Caller must own the target class (cross-tenant write protection).
    ctx.assert_class(entry.class_id)
    # Valida la data: una data malformata renderebbe la voce invisibile al genitore
    # (la vista genitore filtra per data esatta YYYY-MM-DD).
    if entry.date and not _DATE_RE.match(entry.date):
        raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
    doc = entry.model_dump()
    cls = await _resolve_class(db, entry.class_id)
    doc["sede_id"] = cls.get("sede_id") if cls else None
    doc["id"] = str(uuid.uuid4())
    doc["created_by"] = ctx.user_id
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.diary.insert_one(doc)
    # Push ai genitori della classe
    try:
        class_ids = doc.get("class_ids") or ([doc["class_id"]] if doc.get("class_id") else [])
        for cid in class_ids:
            await notify_parents_of_class(
                db, cid,
                "📓 Nuovo diario di bordo",
                f"La maestra ha scritto il diario del {doc.get('date', 'oggi')}"
            )
    except Exception:
        pass
    doc.pop("_id", None)
    return doc


@router.get("/api/diary")
@router.get("/api/diary/entries")
async def get_diary(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    student_id: Optional[str] = None,   # filtro per figlio attivo (fratellini)
    ctx: TenantContext = Depends(get_tenant_context),
):
    return await _get_diary(class_id, date, ctx, student_id)


@router.post("/api/diary", status_code=201)
@router.post("/api/diary/entries", status_code=201)
@limiter.limit("120/minute")
async def create_diary(
    request: Request,
    entry: DiaryEntryCreate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    # Solo admin e maestre possono scrivere nel diario
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato: solo admin o maestra può scrivere nel diario")
    return await _create_diary(entry, ctx)


@router.put("/api/diary/{entry_id}")
@router.put("/api/diary/entries/{entry_id}")
async def update_diary(
    entry_id: str,
    payload: DiaryEntryUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Modifica una voce del diario — solo admin/maestra della classe della voce."""
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    entry = await db.diary.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Voce non trovata")
    ctx.assert_class(entry.get("class_id"))   # 404 cross-tenant

    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    if updates.get("date") and not _DATE_RE.match(updates["date"]):
        raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.diary.update_one({"id": entry_id}, {"$set": updates})
    updated = await db.diary.find_one({"id": entry_id}, {"_id": 0})
    return updated


@router.delete("/api/diary/{entry_id}")
@router.delete("/api/diary/entries/{entry_id}")
async def delete_diary(
    entry_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Elimina una voce del diario — solo admin/maestra della classe della voce."""
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()
    entry = await db.diary.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Voce non trovata")
    ctx.assert_class(entry.get("class_id"))   # 404 cross-tenant

    await db.diary.delete_one({"id": entry_id})
    return {"message": "Voce eliminata"}
