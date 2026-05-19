"""Meals / menu router — /api/meals and /api/meals/menu — multi-tenant."""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header

from services.database import get_db
from models.meals import MealCreate
from middleware.auth import get_current_user, validate_admin_sede_access, get_teacher_sede_id

router = APIRouter(tags=["meals"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@router.get("/api/meals")
@router.get("/api/meals/menu")
async def get_meals(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    query: dict = {}
    role = current_user.get("role")

    # Filtro data: cerca menu con data singola OPPURE range che include la data
    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        # Menu singolo-giorno (vecchio formato) OPPURE range che include la data
        query["$or"] = [
            {"date": date},
            {"date_from": {"$lte": date}, "date_to": {"$gte": date}},
        ]

    if role == "admin":
        # Admin: filtro per sede attiva
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
        query["sede_id"] = sede_id
        if class_id:
            query["class_id"] = class_id

    elif role == "teacher":
        # Maestra: vede solo menu delle sue classi (sede implicita)
        teacher_class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in teacher_class_ids:
            teacher_class_ids.append(legacy)
        if class_id:
            if class_id not in teacher_class_ids:
                raise HTTPException(status_code=403, detail="Accesso negato: classe non assegnata")
            query["class_id"] = class_id
        elif teacher_class_ids:
            query["class_id"] = {"$in": teacher_class_ids}

    else:
        # Parent: vede SOLO il menu della classe del proprio figlio
        # + menu universali (class_id vuoto = per tutte le classi)
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)
        if child_ids:
            students = await db.students.find(
                {"id": {"$in": child_ids}}, {"_id": 0, "class_id": 1}
            ).to_list(100)
            parent_class_ids = list({s["class_id"] for s in students if s.get("class_id")})

            if class_id:
                # Il frontend ha richiesto una classe specifica:
                # la mostriamo SOLO se appartiene ai figli del genitore
                if class_id in parent_class_ids:
                    allowed = [class_id, "", None]
                else:
                    # classe non autorizzata → mostra solo universali
                    allowed = ["", None]
            else:
                # Nessuna classe specificata → tutte le classi dei figli + universali
                allowed = parent_class_ids + ["", None]

            query["class_id"] = {"$in": allowed}

    meals = await db.meals.find(query, {"_id": 0}).to_list(100)
    return meals


@router.post("/api/meals/menu", status_code=201)
async def create_meal(
    payload: MealCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato: solo admin o maestra può creare menu")

    # Determina sede
    if current_user.get("role") == "admin":
        sede_id = validate_admin_sede_access(current_user, x_sede_id)
    else:
        sede_id = get_teacher_sede_id(current_user)

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

    sede_id = validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    meal = await db.meals.find_one({"id": meal_id})
    if not meal:
        raise HTTPException(status_code=404, detail="Menu non trovato")
    if meal.get("sede_id") and meal.get("sede_id") != sede_id:
        raise HTTPException(status_code=403, detail="Menu non appartiene alla sede selezionata")

    await db.meals.delete_one({"id": meal_id})
    return {"message": "Menu eliminato"}
