"""Router Rette — piani retta, assegnazioni ai bambini, addebiti. Multi-tenant per sede_id.

Ruoli:
  - admin      → CRUD completo su piani/assegnazioni, generazione e storno addebiti.
  - teacher    → nessun accesso (dato amministrativo).
  - parent     → sola lettura degli addebiti dei PROPRI figli (scadenzario).
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header

from services.database import get_db
from services import rette_service as svc
from models.rette import (
    PianoRettaCreate, PianoRettaUpdate,
    AssegnazioneCreate, AssegnazioneUpdate,
    GeneraAddebitiRequest, AddebitoManualeCreate,
)
from middleware.auth import get_current_user, validate_admin_sede_access

router = APIRouter(prefix="/api/rette", tags=["rette"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parent_child_ids(user: dict) -> list:
    ids = list(user.get("child_ids") or [])
    legacy = user.get("child_id")
    if legacy and legacy not in ids:
        ids.append(legacy)
    return ids


async def _assert_student_in_sede(db, student_id: str, sede_id: str, is_superadmin: bool) -> dict:
    """Il bambino deve appartenere alla sede (via sede_id o via classe). 404 se non trovato."""
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Bambino non trovato")
    if is_superadmin:
        return student
    ok = student.get("sede_id") == sede_id
    if not ok and student.get("class_id"):
        cls = await db.classes.find_one({"id": student["class_id"]}, {"_id": 0, "sede_id": 1})
        ok = bool(cls) and cls.get("sede_id") == sede_id
    if not ok:
        raise HTTPException(status_code=403, detail="Bambino non appartiene alla sede selezionata")
    return student


# ===========================================================================
# PIANI RETTA
# ===========================================================================

@router.get("/piani")
async def list_piani(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    return await db.fee_plans.find({"sede_id": sede_id}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/piani", status_code=201)
async def create_piano(
    payload: PianoRettaCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["sede_id"] = sede_id
    doc["created_at"] = _now_iso()
    doc["updated_at"] = _now_iso()
    await db.fee_plans.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/piani/{plan_id}")
async def get_piano(
    plan_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    plan = await db.fee_plans.find_one({"id": plan_id, "sede_id": sede_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Piano non trovato")
    return plan


@router.put("/piani/{plan_id}")
async def update_piano(
    plan_id: str,
    payload: PianoRettaUpdate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    plan = await db.fee_plans.find_one({"id": plan_id, "sede_id": sede_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Piano non trovato")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    updates["updated_at"] = _now_iso()
    await db.fee_plans.update_one({"id": plan_id}, {"$set": updates})
    return await db.fee_plans.find_one({"id": plan_id}, {"_id": 0})


@router.delete("/piani/{plan_id}")
async def delete_piano(
    plan_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    plan = await db.fee_plans.find_one({"id": plan_id, "sede_id": sede_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Piano non trovato")
    # Non eliminare un piano ancora assegnato a dei bambini → addebiti orfani.
    in_use = await db.student_fees.find_one({"plan_id": plan_id, "active": True})
    if in_use:
        raise HTTPException(
            status_code=409,
            detail="Piano ancora assegnato a dei bambini: disattiva prima le assegnazioni.",
        )
    await db.fee_plans.delete_one({"id": plan_id})
    return {"message": "Piano eliminato"}


# ===========================================================================
# ASSEGNAZIONI (piano → bambino)
# ===========================================================================

@router.get("/assegnazioni")
async def list_assegnazioni(
    student_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    query = {"sede_id": sede_id}
    if student_id:
        query["student_id"] = student_id
    return await db.student_fees.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)


@router.post("/assegnazioni", status_code=201)
async def create_assegnazione(
    payload: AssegnazioneCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    is_super = bool(current_user.get("is_superadmin"))

    await _assert_student_in_sede(db, payload.student_id, sede_id, is_super)
    plan = await db.fee_plans.find_one({"id": payload.plan_id, "sede_id": sede_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Piano non trovato nella sede")

    # Un bambino non può avere due rette attive sullo stesso piano
    dup = await db.student_fees.find_one(
        {"sede_id": sede_id, "student_id": payload.student_id, "plan_id": payload.plan_id, "active": True}
    )
    if dup:
        raise HTTPException(status_code=409, detail="Il bambino ha già questo piano attivo")

    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["sede_id"] = sede_id
    doc["created_at"] = _now_iso()
    doc["updated_at"] = _now_iso()
    await db.student_fees.insert_one(doc)
    doc.pop("_id", None)

    # All'attivazione genera subito gli addebiti una-tantum/annuali (es. iscrizione)
    one_off = []
    if doc.get("active"):
        one_off = await svc.generate_one_off_charges(db, sede_id, doc, plan)

    return {"assegnazione": doc, "addebiti_generati": one_off}


@router.put("/assegnazioni/{assign_id}")
async def update_assegnazione(
    assign_id: str,
    payload: AssegnazioneUpdate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    a = await db.student_fees.find_one({"id": assign_id, "sede_id": sede_id})
    if not a:
        raise HTTPException(status_code=404, detail="Assegnazione non trovata")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    updates["updated_at"] = _now_iso()
    await db.student_fees.update_one({"id": assign_id}, {"$set": updates})
    return await db.student_fees.find_one({"id": assign_id}, {"_id": 0})


@router.delete("/assegnazioni/{assign_id}")
async def delete_assegnazione(
    assign_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Disattiva l'assegnazione (non elimina gli addebiti già emessi, che restano storici)."""
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    a = await db.student_fees.find_one({"id": assign_id, "sede_id": sede_id})
    if not a:
        raise HTTPException(status_code=404, detail="Assegnazione non trovata")
    await db.student_fees.update_one(
        {"id": assign_id}, {"$set": {"active": False, "updated_at": _now_iso()}}
    )
    return {"message": "Assegnazione disattivata"}


# ===========================================================================
# ADDEBITI
# ===========================================================================

@router.post("/genera-addebiti")
async def genera_addebiti(
    payload: GeneraAddebitiRequest,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    return await svc.generate_monthly_charges(db, sede_id, payload.period, payload.due_day)


@router.get("/addebiti")
async def list_addebiti(
    student_id: Optional[str] = None,
    period: Optional[str] = None,
    status: Optional[str] = None,
    solo_scaduti: bool = False,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    role = current_user.get("role")
    today = svc.today_str()

    if role == "parent":
        child_ids = _parent_child_ids(current_user)
        if not child_ids:
            return []
        query = {"student_id": {"$in": child_ids}}
        if student_id:
            if student_id not in child_ids:
                raise HTTPException(status_code=403, detail="Accesso negato")
            query["student_id"] = student_id
    elif role == "admin":
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        query = {"sede_id": sede_id}
        if student_id:
            query["student_id"] = student_id
    else:
        raise HTTPException(status_code=403, detail="Permesso negato")

    if period:
        query["period"] = period
    if status:
        query["status"] = status

    rows = await db.charges.find(query, {"_id": 0}).sort("due_date", 1).to_list(10000)
    rows = [svc.annotate(r, today) for r in rows]
    if solo_scaduti:
        rows = [r for r in rows if r.get("scaduto")]
    return rows


@router.post("/addebiti", status_code=201)
async def crea_addebito_manuale(
    payload: AddebitoManualeCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    is_super = bool(current_user.get("is_superadmin"))
    await _assert_student_in_sede(db, payload.student_id, sede_id, is_super)

    doc = {
        "id": str(uuid.uuid4()),
        "sede_id": sede_id,
        "student_id": payload.student_id,
        "plan_id": None,
        "assegnazione_id": None,
        "period": payload.period,
        "component_key": "manuale",
        "description": payload.description,
        "gross_amount": payload.amount,
        "discount_pct": 0.0,
        "amount": payload.amount,
        "due_date": payload.due_date,
        "status": "da_pagare",
        "paid_amount": 0.0,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.charges.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/addebiti/{charge_id}/storna")
async def storna_addebito(
    charge_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Annulla un addebito (es. emesso per errore). Non eliminabile se ha già incassi."""
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    charge = await db.charges.find_one({"id": charge_id, "sede_id": sede_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Addebito non trovato")
    paid = await db.payments.find_one({"charge_id": charge_id})
    if paid:
        raise HTTPException(
            status_code=409,
            detail="Addebito con incassi registrati: elimina prima i pagamenti.",
        )
    await db.charges.update_one(
        {"id": charge_id}, {"$set": {"status": "stornato", "updated_at": _now_iso()}}
    )
    return {"message": "Addebito stornato"}


# ===========================================================================
# RIEPILOGO (KPI per la dashboard direzione)
# ===========================================================================

@router.get("/riepilogo")
async def riepilogo(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """KPI di cassa della sede: dovuto / incassato / residuo / scaduto (euro) + conteggi."""
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    today = svc.today_str()
    rows = await db.charges.find(
        {"sede_id": sede_id, "status": {"$ne": "stornato"}}, {"_id": 0}
    ).to_list(50000)

    dovuto = incassato = scaduto = 0.0
    n_scaduti = 0
    for r in rows:
        svc.annotate(r, today)
        dovuto += float(r.get("amount") or 0)
        incassato += float(r.get("paid_amount") or 0)
        if r.get("scaduto"):
            scaduto += float(r.get("residuo") or 0)
            n_scaduti += 1

    return {
        "sede_id": sede_id,
        "totale_dovuto": round(dovuto, 2),
        "totale_incassato": round(incassato, 2),
        "totale_residuo": round(dovuto - incassato, 2),
        "totale_scaduto": round(scaduto, 2),
        "n_addebiti": len(rows),
        "n_scaduti": n_scaduti,
    }
