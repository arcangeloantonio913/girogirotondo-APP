"""Meals / menu router — /api/meals and /api/meals/menu — multi-tenant."""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header

from services.database import get_db
from models.meals import MealCreate
from middleware.auth import (
    get_current_user, get_tenant_context, TenantContext,
    validate_admin_sede_access, get_teacher_sede_id,
)

router = APIRouter(tags=["meals"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@router.get("/api/meals")
@router.get("/api/meals/menu")
async def get_meals(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()
    query: dict = {}

    # ── Tenant scope. meals è scopato per SEDE. Gli "universali" (class_id vuoto/null)
    #    sono sede-wide → filtrati per la sede del caller (mai globali). Un universale
    #    SENZA sede_id non matcha nessuno: {sede_id: {$in: [...]}} esclude i null (FAIL-CLOSED).
    if ctx.role == "admin":
        if not ctx.all_access:
            query["sede_id"] = {"$in": list(ctx.sede_ids)}   # universali + class-specific della sede A
        if class_id:
            query["class_id"] = class_id

    elif ctx.role == "teacher":
        universal = {"class_id": {"$in": ["", None]}, "sede_id": {"$in": list(ctx.sede_ids)}}
        if class_id:
            if class_id not in ctx.allowed_class_ids:
                raise HTTPException(status_code=403, detail="Accesso negato: classe non assegnata")
            query["$or"] = [{"class_id": class_id}, universal]
        else:
            query["$or"] = [{"class_id": {"$in": list(ctx.allowed_class_ids)}}, universal]

    elif ctx.role == "parent":
        if not ctx.allowed_student_ids:
            return []
        universal = {"class_id": {"$in": ["", None]}, "sede_id": {"$in": list(ctx.sede_ids)}}
        if class_id:
            if class_id in ctx.allowed_class_ids:
                query["$or"] = [{"class_id": class_id}, universal]
            else:
                query["$or"] = [universal]   # classe non autorizzata → solo universali della propria sede
        else:
            query["$or"] = [{"class_id": {"$in": list(ctx.allowed_class_ids)}}, universal]

    else:
        raise HTTPException(status_code=403, detail="Permesso negato")

    # ── Filtro data: singola data OPPURE range. Combina con l'$or del tenant via $and. ──
    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        date_or = [
            {"date": date},
            {"date_from": {"$lte": date}, "date_to": {"$gte": date}},
        ]
        if "$or" in query:
            tenant_or = query.pop("$or")
            query["$and"] = [{"$or": tenant_or}, {"$or": date_or}]
        else:
            query["$or"] = date_or

    meals = await db.meals.find(query, {"_id": 0}).to_list(100)
    return meals


@router.post("/api/meals/menu", status_code=201)
async def create_meal(
    payload: MealCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    x_sede_id: Optional[str] = Header(None),
):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato: solo admin o maestra può creare menu")

    # Class-specific: la classe dev'essere del caller (404 cross-sede) PRIMA di creare.
    if payload.class_id:
        ctx.assert_class(payload.class_id)

    # sede_id SEMPRE dal creatore (mai dal body); l'universale (class_id nullo) porta comunque
    # la sede del creatore -> mai universale globale per omissione.
    if ctx.role == "admin":
        sede_id = await validate_admin_sede_access(ctx.user, x_sede_id)
    else:
        sede_id = get_teacher_sede_id(ctx.user)

    db = get_db()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["sede_id"] = sede_id
    doc["created_at"] = datetime.now(timezone.utc).isoformat()

    # Normalizza: se è range senza date singola, rimuovi date=None
    if doc.get("date_from") and doc.get("date_to") and not doc.get("date"):
        doc["date"] = None  # range mode

    await db.meals.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/api/meals/menu/{meal_id}", status_code=200)
async def delete_meal(
    meal_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Elimina un menu — solo admin, verifica appartenenza alla sede."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eliminare menu")

    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    meal = await db.meals.find_one({"id": meal_id})
    if not meal:
        raise HTTPException(status_code=404, detail="Menu non trovato")
    if meal.get("sede_id") and meal.get("sede_id") != sede_id:
        raise HTTPException(status_code=404, detail="Menu non trovato")   # 404 cross-tenant (convenzione)

    await db.meals.delete_one({"id": meal_id})
    return {"message": "Menu eliminato"}
