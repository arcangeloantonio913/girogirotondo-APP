"""Router Documenti fiscali (ricevute / fatture) — /api/fatture. Multi-tenant per sede.

Ruoli:
  - admin  → emette, elenca, elimina i documenti della sede.
  - parent → sola lettura dei documenti dei PROPRI figli (li scarica/stampa).
Nota: la fattura elettronica (XML + invio SDI) NON è implementata — qui si genera e si
stampa il documento; l'invio allo SDI è un passo successivo (serve regime + provider).
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header

from services.database import get_db
from services import fatture_service as fsvc
from models.fatture import RicevutaCreate
from middleware.auth import get_current_user, validate_admin_sede_access

router = APIRouter(prefix="/api/fatture", tags=["fatture"])


def _parent_child_ids(user: dict) -> list:
    ids = list(user.get("child_ids") or [])
    legacy = user.get("child_id")
    if legacy and legacy not in ids:
        ids.append(legacy)
    return ids


async def _assert_student_in_sede(db, student_id: str, sede_id: str, is_superadmin: bool) -> dict:
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


@router.post("", status_code=201)
async def emetti_documento(
    payload: RicevutaCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    student = await _assert_student_in_sede(db, payload.student_id, sede_id, bool(current_user.get("is_superadmin")))
    doc = await fsvc.build_document(db, sede_id, payload, student)
    if not doc["righe"]:
        raise HTTPException(status_code=400, detail="Nessun pagamento da documentare per questo bambino")
    await db.fatture.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_documenti(
    student_id: Optional[str] = None,
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
    return await db.fatture.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)


@router.get("/{doc_id}")
async def get_documento(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    role = current_user.get("role")
    doc = await db.fatture.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    if role == "parent":
        if doc.get("student_id") not in _parent_child_ids(current_user):
            raise HTTPException(status_code=404, detail="Documento non trovato")
    elif role == "admin":
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        if doc.get("sede_id") != sede_id and not current_user.get("is_superadmin"):
            raise HTTPException(status_code=404, detail="Documento non trovato")
    else:
        raise HTTPException(status_code=403, detail="Permesso negato")
    return doc


@router.delete("/{doc_id}")
async def elimina_documento(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    sede_id = await validate_admin_sede_access(current_user, x_sede_id)
    db = get_db()
    doc = await db.fatture.find_one({"id": doc_id, "sede_id": sede_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    await db.fatture.delete_one({"id": doc_id})
    return {"message": "Documento eliminato"}
