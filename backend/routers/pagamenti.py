"""Router Pagamenti — incassi a fronte degli addebiti, certificazione annuale, solleciti.

Ruoli:
  - admin   → registra/elimina incassi, invia solleciti, certificazione di ogni bambino.
  - parent  → sola lettura dei propri incassi + certificazione annuale del proprio figlio (730).
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header

from services.database import get_db
from services import rette_service as svc
from models.pagamenti import PagamentoCreate
from middleware.auth import get_current_user, validate_admin_sede_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pagamenti", tags=["pagamenti"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parent_child_ids(user: dict) -> list:
    ids = list(user.get("child_ids") or [])
    legacy = user.get("child_id")
    if legacy and legacy not in ids:
        ids.append(legacy)
    return ids


# ===========================================================================
# INCASSI
# ===========================================================================

@router.post("", status_code=201)
async def registra_incasso(
    payload: PagamentoCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Registra un incasso su un addebito e ricalcola lo stato dell'addebito."""
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()

    charge = await db.charges.find_one({"id": payload.charge_id, "sede_id": sede_id}, {"_id": 0})
    if not charge:
        raise HTTPException(status_code=404, detail="Addebito non trovato nella sede")
    if charge.get("status") == "stornato":
        raise HTTPException(status_code=409, detail="Addebito stornato: impossibile incassare")

    doc = {
        "id": str(uuid.uuid4()),
        "sede_id": sede_id,
        "student_id": charge["student_id"],
        "charge_id": payload.charge_id,
        "amount": payload.amount,
        "method": payload.method,
        "paid_at": payload.paid_at or svc.today_str(),
        "note": payload.note,
        "created_at": _now_iso(),
    }
    await db.payments.insert_one(doc)
    doc.pop("_id", None)

    charge = await svc.recompute_charge(db, payload.charge_id)
    return {"pagamento": doc, "addebito": svc.annotate(charge) if charge else None}


@router.get("")
async def list_incassi(
    student_id: Optional[str] = None,
    charge_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    role = current_user.get("role")

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

    if charge_id:
        query["charge_id"] = charge_id
    return await db.payments.find(query, {"_id": 0}).sort("paid_at", -1).to_list(10000)


@router.delete("/{payment_id}")
async def elimina_incasso(
    payment_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Elimina un incasso (es. registrato per errore) e ricalcola l'addebito."""
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    pay = await db.payments.find_one({"id": payment_id, "sede_id": sede_id})
    if not pay:
        raise HTTPException(status_code=404, detail="Incasso non trovato")
    await db.payments.delete_one({"id": payment_id})
    await svc.recompute_charge(db, pay["charge_id"])
    return {"message": "Incasso eliminato"}


# ===========================================================================
# CERTIFICAZIONE ANNUALE (detrazione 730)
# ===========================================================================

@router.get("/certificazione/{student_id}")
async def certificazione_annuale(
    student_id: str,
    anno: int,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Riepilogo dei pagamenti di un anno per un bambino, per la detrazione 730.
    Il genitore può chiederla solo per i propri figli; l'admin per la sua sede."""
    db = get_db()
    role = current_user.get("role")

    if role == "parent":
        if student_id not in _parent_child_ids(current_user):
            raise HTTPException(status_code=403, detail="Accesso negato")
    elif role == "admin":
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        st = await db.students.find_one({"id": student_id}, {"_id": 0, "sede_id": 1, "class_id": 1})
        if not st:
            raise HTTPException(status_code=404, detail="Bambino non trovato")
        ok = st.get("sede_id") == sede_id or current_user.get("is_superadmin")
        if not ok and st.get("class_id"):
            cls = await db.classes.find_one({"id": st["class_id"]}, {"_id": 0, "sede_id": 1})
            ok = bool(cls) and cls.get("sede_id") == sede_id
        if not ok:
            raise HTTPException(status_code=403, detail="Bambino non appartiene alla sede")
    else:
        raise HTTPException(status_code=403, detail="Permesso negato")

    prefix = f"{int(anno):04d}-"
    rows = await db.payments.find(
        {"student_id": student_id}, {"_id": 0}
    ).sort("paid_at", 1).to_list(10000)
    year_rows = [r for r in rows if (r.get("paid_at") or "").startswith(prefix)]
    totale = round(sum(float(r.get("amount") or 0) for r in year_rows), 2)

    student = await db.students.find_one(
        {"id": student_id}, {"_id": 0, "name": 1, "cognome": 1, "date_of_birth": 1}
    )
    return {
        "anno": int(anno),
        "bambino": student or {"id": student_id},
        "totale_versato": totale,
        "numero_versamenti": len(year_rows),
        "pagamenti": year_rows,
    }


# ===========================================================================
# SOLLECITI (promemoria scaduti via email)
# ===========================================================================

@router.post("/solleciti")
async def invia_solleciti(
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    """Invia un promemoria email a ogni famiglia con addebiti SCADUTI nella sede.
    Un'email per famiglia, con il totale residuo scaduto. Richiede Resend configurato
    (RESEND_API_KEY + mittente verificato sull'org); altrimenti i messaggi vengono contati
    come 'non inviati' senza errori."""
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    today = svc.today_str()

    rows = await db.charges.find(
        {"sede_id": sede_id, "status": {"$in": ["da_pagare", "parziale"]}}, {"_id": 0}
    ).to_list(50000)
    scaduti = [svc.annotate(r, today) for r in rows]
    scaduti = [r for r in scaduti if r.get("scaduto")]
    if not scaduti:
        return {"inviati": 0, "saltati": 0, "famiglie": 0, "messaggio": "Nessun addebito scaduto"}

    # Raggruppa per bambino → somma residuo scaduto
    per_student: dict = {}
    for r in scaduti:
        per_student.setdefault(r["student_id"], 0.0)
        per_student[r["student_id"]] += float(r.get("residuo") or 0)

    org_id = current_user.get("org_id")
    inviati = saltati = 0
    famiglie = set()

    # Import locale: il modulo email è pesante e non sempre necessario altrove
    try:
        from services.email_service import send_sollecito_email
    except Exception as exc:  # pragma: no cover
        logger.error("[SOLLECITI] email_service non disponibile: %s", exc)
        return {"inviati": 0, "saltati": len(per_student), "famiglie": len(per_student),
                "messaggio": "Servizio email non disponibile"}

    for student_id, residuo in per_student.items():
        student = await db.students.find_one({"id": student_id}, {"_id": 0, "name": 1, "cognome": 1})
        if not student:
            continue
        # Genitori collegati (via child_ids) con email
        parents = await db.users.find(
            {"child_ids": student_id, "role": "parent", "active": True},
            {"_id": 0, "email": 1, "name": 1},
        ).to_list(10)
        if not parents:
            saltati += 1
            continue
        child_name = f"{student.get('name', '')} {student.get('cognome', '') or ''}".strip()
        for p in parents:
            if not p.get("email"):
                continue
            famiglie.add(student_id)
            ok = await send_sollecito_email(
                to_email=p["email"],
                sede_id=sede_id,
                org_id=org_id,
                parent_name=p.get("name") or "",
                child_name=child_name,
                amount=round(residuo, 2),
            )
            if ok:
                inviati += 1
            else:
                saltati += 1

    return {"inviati": inviati, "saltati": saltati, "famiglie": len(famiglie)}
