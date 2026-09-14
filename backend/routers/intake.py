"""Raccolta Iscrizioni — /api/intake.

- Token per scuola: creato/gestito solo da admin, legato all'org del creatore.
  Nel DB si salva SOLO l'hash SHA-256 del token; il valore in chiaro è mostrato una volta.
- Endpoint pubblici (config/submission/scan): autenticati SOLO dal token (query ?t=).
- Endpoint admin (lista/dettaglio/patch/export): get_current_user + isolamento per org_id.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from services.database import get_db
from middleware.auth import get_current_user
from models.intake import (
    IntakeTokenCreate, IntakeSubmissionUpsert, IntakeSubmissionPatch,
)
from utils.storage_helper import upload_file as _real_storage_upload_file

router = APIRouter(prefix="/api/intake", tags=["intake"])


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eseguire questa operazione")


def _caller_org(current_user: dict) -> str:
    org = current_user.get("org_id")
    if not org:
        raise HTTPException(status_code=400, detail="Account senza org_id: impossibile gestire iscrizioni")
    return org


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Dependency: autenticazione via token pubblico (?t=) ──────────────────────
async def get_intake_token(t: Optional[str] = None) -> dict:
    if not t:
        raise HTTPException(status_code=401, detail="Token mancante")
    db = get_db()
    doc = await db.intake_tokens.find_one(
        {"token_hash": _hash_token(t), "active": True}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=401, detail="Link non valido o revocato")
    exp = doc.get("expires_at")
    if exp and exp < _now_iso():
        raise HTTPException(status_code=401, detail="Link scaduto")
    return doc


# ── Token admin CRUD ─────────────────────────────────────────────────────────
@router.post("/tokens", status_code=201)
async def create_token(payload: IntakeTokenCreate, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    raw = secrets.token_urlsafe(24)
    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org,
        "label": payload.label,
        "token_hash": _hash_token(raw),
        "expires_at": payload.expires_at,
        "active": True,
        "created_by": current_user.get("id"),
        "created_at": _now_iso(),
    }
    await db.intake_tokens.insert_one(doc)
    # token in chiaro restituito UNA sola volta
    return {"id": doc["id"], "org_id": org, "label": doc["label"], "token": raw}


@router.get("/tokens")
async def list_tokens(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    rows = await db.intake_tokens.find(
        {"org_id": org}, {"_id": 0, "token_hash": 0}
    ).to_list(200)
    return rows


@router.delete("/tokens/{token_id}")
async def revoke_token(token_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    res = await db.intake_tokens.update_one(
        {"id": token_id, "org_id": org}, {"$set": {"active": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Token non trovato")
    return {"ok": True, "id": token_id}


# ── Config pubblica (branding-data + sedi) ───────────────────────────────────
@router.get("/config")
async def public_config(token: dict = Depends(get_intake_token)):
    """Dati necessari alla pagina pubblica: org + sedi attive dell'org. Il branding
    visivo è build-time (tenant.js); qui forniamo solo i DATI (org, sedi, sezioni note)."""
    db = get_db()
    org = token["org_id"]
    sedi = await db.sedi.find(
        {"org_id": org, "active": True}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(50)
    # sezioni/classi già esistenti per sede (per il menù a tendina "scegli esistente")
    sede_ids = [s["id"] for s in sedi]
    classes = await db.classes.find(
        {"sede_id": {"$in": sede_ids}}, {"_id": 0, "sede_id": 1, "name": 1}
    ).to_list(500)
    sezioni_by_sede = {}
    for c in classes:
        sezioni_by_sede.setdefault(c["sede_id"], []).append(c["name"])
    return {"org_id": org, "sedi": sedi, "sezioni_by_sede": sezioni_by_sede}


# ── Submission modalità form ─────────────────────────────────────────────────
@router.post("/submissions", status_code=201)
async def upsert_submission(payload: IntakeSubmissionUpsert, token: dict = Depends(get_intake_token)):
    db = get_db()
    org = token["org_id"]
    # sedi valide dell'org: rifiuta children/staff che puntano fuori org
    valid_sedi = {s["id"] for s in await db.sedi.find(
        {"org_id": org, "active": True}, {"_id": 0, "id": 1}).to_list(50)}
    for c in payload.children:
        if c.sede_id not in valid_sedi:
            raise HTTPException(status_code=400, detail=f"Sede '{c.sede_id}' non valida per questa scuola")
    for s in payload.staff:
        if s.sede_id not in valid_sedi:
            raise HTTPException(status_code=400, detail=f"Sede '{s.sede_id}' non valida per questa scuola")

    children = [c.model_dump() for c in payload.children]
    staff = [s.model_dump() for s in payload.staff]
    direttrici = [d.model_dump() for d in payload.direttrici]
    now = _now_iso()

    if payload.submission_id:
        res = await db.intake_submissions.update_one(
            {"id": payload.submission_id, "org_id": org},
            {"$set": {"children": children, "staff": staff, "direttrici": direttrici,
                      "status": payload.status, "mode": payload.mode, "updated_at": now,
                      **({"submitted_at": now} if payload.status == "inviata" else {})}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Bozza non trovata")
        doc = await db.intake_submissions.find_one({"id": payload.submission_id}, {"_id": 0})
        return doc

    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org,
        "token_id": token["id"],
        "mode": payload.mode,
        "status": payload.status,
        "children": children,
        "staff": staff,
        "direttrici": direttrici,
        "scans": [],
        "created_at": now,
        "updated_at": now,
        "submitted_at": now if payload.status == "inviata" else None,
    }
    await db.intake_submissions.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ── Upload scansione registro (modalità scan) ────────────────────────────────
_ALLOWED_SCAN_TYPES = {"image/jpeg", "image/png", "application/pdf"}


async def storage_upload_file(data: bytes, destination_path: str, content_type: str,
                              media_type: str = "document") -> str:
    """Wrapper attorno a utils.storage_helper.upload_file: quella funzione ritorna
    (url, storage_path), qui serve solo lo storage_path da persistere sulla submission.
    Definito come funzione a sé (non semplice alias) così i test possono patchare
    `routers.intake.storage_upload_file` con un valore di ritorno semplice (il path)."""
    _, storage_path = await _real_storage_upload_file(data, destination_path, content_type,
                                                       media_type=media_type)
    return storage_path


@router.post("/submissions/{submission_id}/scans", status_code=201)
async def upload_scan(submission_id: str, token: dict = Depends(get_intake_token),
                      file: UploadFile = File(...)):
    if file.content_type not in _ALLOWED_SCAN_TYPES:
        raise HTTPException(status_code=400, detail="Tipo file non ammesso: usa JPG, PNG o PDF")
    db = get_db()
    org = token["org_id"]
    sub = await db.intake_submissions.find_one({"id": submission_id, "org_id": org})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission non trovata")

    data = await file.read()
    file_id = str(uuid.uuid4())
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin")
    dest = f"intake/{org}/{submission_id}/{file_id}.{ext}"
    # media_type governa la compressione lato storage_helper: "document" = nessuna compressione
    storage_path = await storage_upload_file(data, dest, file.content_type, media_type="document")

    scan = {
        "file_id": file_id,
        "filename": file.filename,
        "storage_path": storage_path,
        "content_type": file.content_type,
        "size": len(data),
        "uploaded_at": _now_iso(),
    }
    await db.intake_submissions.update_one(
        {"id": submission_id}, {"$push": {"scans": scan}, "$set": {"updated_at": _now_iso()}}
    )
    return {"ok": True, "scan": scan}


# ── Admin: lista / dettaglio / patch ─────────────────────────────────────────
@router.get("/submissions")
async def list_submissions(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    rows = await db.intake_submissions.find(
        {"org_id": org}, {"_id": 0}
    ).sort([("created_at", -1)]).to_list(500)
    return rows


@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    doc = await db.intake_submissions.find_one({"id": submission_id, "org_id": org}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Submission non trovata")
    return doc


@router.patch("/submissions/{submission_id}")
async def patch_submission(submission_id: str, payload: IntakeSubmissionPatch,
                           current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()

    if payload.children is not None or payload.staff is not None:
        valid_sedi = {s["id"] for s in await db.sedi.find(
            {"org_id": org, "active": True}, {"_id": 0, "id": 1}).to_list(50)}
        if payload.children is not None:
            for c in payload.children:
                if c.sede_id not in valid_sedi:
                    raise HTTPException(status_code=400, detail=f"Sede '{c.sede_id}' non valida per questa scuola")
        if payload.staff is not None:
            for s in payload.staff:
                if s.sede_id not in valid_sedi:
                    raise HTTPException(status_code=400, detail=f"Sede '{s.sede_id}' non valida per questa scuola")

    updates = {}
    if payload.children is not None:
        updates["children"] = [c.model_dump() for c in payload.children]
    if payload.staff is not None:
        updates["staff"] = [s.model_dump() for s in payload.staff]
    if payload.direttrici is not None:
        updates["direttrici"] = [d.model_dump() for d in payload.direttrici]
    if payload.status is not None:
        updates["status"] = payload.status
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    updates["updated_at"] = _now_iso()
    res = await db.intake_submissions.update_one(
        {"id": submission_id, "org_id": org}, {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission non trovata")
    return await db.intake_submissions.find_one({"id": submission_id}, {"_id": 0})


# ── Export → formato importer iscrizioni_normalized.json ─────────────────────
@router.post("/submissions/{submission_id}/export")
async def export_submission(submission_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    sub = await db.intake_submissions.find_one({"id": submission_id, "org_id": org}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission non trovata")

    children = sub.get("children", [])
    staff_rows = sub.get("staff", [])
    dirs_rows = sub.get("direttrici", [])

    classes, seen_cls = [], set()

    def _add_class(sede_id, name):
        key = (sede_id, name)
        if name and key not in seen_cls:
            seen_cls.add(key)
            classes.append({"sede_id": sede_id, "name": name})

    students, parents, seen_email = [], [], set()
    for c in children:
        sede_id = c.get("sede_id", "")
        classe = c.get("classe", "")
        cognome = c.get("cognome", "")
        if not sede_id or not classe:
            continue   # riga malformata: salta invece di far crashare l'export
        _add_class(sede_id, classe)
        students.append({
            "sede_id": sede_id, "class_name": classe,
            "name": c.get("nome", ""), "cognome": cognome,
            "date_of_birth": c.get("data_nascita", ""),
            "email_genitore": c.get("genitore_email", ""),
        })
        em = c.get("genitore_email")
        if em and em not in seen_email:
            seen_email.add(em)
            full = f"{c.get('genitore_nome','')} {c.get('genitore_cognome','')}".strip()
            parents.append({"email": em, "name": full or f"Famiglia {cognome}"})

    # sezioni citate dalle maestre → classi anche senza bambini
    staff = []
    for s in staff_rows:
        for sez in s.get("sezioni", []):
            _add_class(s["sede_id"], sez)
        staff.append({"email": s["email"], "name": s["nome"], "cognome": s["cognome"],
                      "sede_id": s["sede_id"], "class_names": list(s.get("sezioni", []))})

    direttrici = [{"email": d["email"], "name": d["nome"], "cognome": d["cognome"]}
                  for d in dirs_rows]

    await db.intake_submissions.update_one(
        {"id": submission_id}, {"$set": {"status": "revisionata", "updated_at": _now_iso()}}
    )
    return {"org_id": org, "classes_to_create": classes, "students": students,
            "parents": parents, "staff": staff, "direttrici": direttrici}
