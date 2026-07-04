"""Avvisi e Comunicazioni router — targeting avanzato multi-sede."""
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header

from services.database import get_db
from utils.expo_push import notify_role, notify_parents_of_class, notify_users
from models.avvisi import AvvisoCreate, AvvisoUpdate
from middleware.auth import get_current_user, validate_admin_sede_access, get_teacher_sede_id

router = APIRouter(prefix="/api/avvisi", tags=["avvisi"])


def _avviso_visible_to(avviso: dict, role: str, user_id: str,
                        user_class_ids: list, user_child_ids: list,
                        user_sede_id: Optional[str]) -> bool:
    """
    Verifica se un avviso è visibile a un utente specifico.
    Applica le regole di targeting avanzato.
    """
    a_sede       = avviso.get("sede_id")
    a_sedi       = avviso.get("target_sedi") or ([a_sede] if a_sede else [])
    a_roles      = avviso.get("target_roles") or ["parent", "teacher", "admin"]
    a_class_ids  = avviso.get("target_class_ids") or []
    a_parent_ids = avviso.get("target_parent_ids") or []

    # 1. Verifica ruolo
    if role not in a_roles:
        return False

    # 2. Verifica sede
    if a_sedi and user_sede_id and user_sede_id not in a_sedi:
        return False

    # 3. Verifica classe
    if a_class_ids:
        if role == "teacher":
            # Maestra: almeno una delle sue classi deve essere inclusa
            if not any(c in a_class_ids for c in user_class_ids):
                return False
        elif role == "parent":
            # Genitore: classe del figlio deve essere inclusa
            if not any(c in a_class_ids for c in user_class_ids):
                return False

    # 4. Verifica genitori specifici
    if a_parent_ids and role == "parent":
        if user_id not in a_parent_ids:
            return False

    return True


# ---------------------------------------------------------------------------
# GET /api/avvisi
# ---------------------------------------------------------------------------

@router.get("")
async def get_avvisi(
    class_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    db = get_db()
    role = current_user.get("role")
    user_id = current_user.get("id", "")

    # Recupera tutti gli avvisi accessibili per sede, poi filtra per targeting
    if role == "admin":
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        # Admin vede tutti gli avvisi della sede attiva + quelli multi-sede che la includono
        all_avvisi = await db.avvisi.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
        avvisi = [
            a for a in all_avvisi
            if (a.get("sede_id") == sede_id) or
               (sede_id in (a.get("target_sedi") or []))
        ]

    elif role == "teacher":
        sede_id = get_teacher_sede_id(current_user)
        teacher_class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in teacher_class_ids:
            teacher_class_ids.append(legacy)

        all_avvisi = await db.avvisi.find(
            {"$or": [{"sede_id": sede_id}, {"target_sedi": {"$in": [sede_id]}}]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)

        avvisi = [
            a for a in all_avvisi
            if _avviso_visible_to(a, "teacher", user_id, teacher_class_ids, [], sede_id)
        ]

    elif role == "parent":
        # Deriva sede e classi dai figli
        child_ids = list(current_user.get("child_ids") or [])
        legacy = current_user.get("child_id")
        if legacy and legacy not in child_ids:
            child_ids.append(legacy)

        if not child_ids:
            return []

        students = await db.students.find(
            {"id": {"$in": child_ids}}, {"_id": 0, "class_id": 1, "sede_id": 1}
        ).to_list(100)
        parent_class_ids = list({s["class_id"] for s in students if s.get("class_id")})
        sede_id = next((s.get("sede_id") for s in students if s.get("sede_id")), None)

        all_avvisi = await db.avvisi.find(
            {"$or": [{"sede_id": sede_id}, {"target_sedi": {"$in": [sede_id]}}]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)

        avvisi = [
            a for a in all_avvisi
            if _avviso_visible_to(a, "parent", user_id, parent_class_ids, child_ids, sede_id)
        ]
    else:
        return []

    return avvisi


# ---------------------------------------------------------------------------
# POST /api/avvisi
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_avviso(
    payload: AvvisoCreate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    role = current_user.get("role")
    if role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Solo admin o maestra possono creare avvisi")

    db = get_db()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["author_id"]   = current_user.get("id", "")
    doc["author_name"] = current_user.get("name", "")
    doc["author_role"] = role
    doc["created_at"]  = datetime.now(timezone.utc).isoformat()

    if role == "admin":
        # Admin: usa sede attiva + eventuali sedi extra dal targeting
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        doc["sede_id"] = sede_id

        # target_sedi: se non specificato, usa solo la sede attiva
        if not doc.get("target_sedi"):
            doc["target_sedi"] = [sede_id]

        # Verifica che le classi target appartengano alle sedi selezionate
        if doc.get("target_class_ids"):
            valid_classes = await db.classes.find(
                {"id": {"$in": doc["target_class_ids"]},
                 "sede_id": {"$in": doc["target_sedi"]}},
                {"_id": 0, "id": 1}
            ).to_list(100)
            valid_ids = {c["id"] for c in valid_classes}
            doc["target_class_ids"] = [c for c in doc["target_class_ids"] if c in valid_ids]

    else:
        # Maestra: sede e classi fisse dal profilo — targeting solo genitori
        sede_id = get_teacher_sede_id(current_user)
        teacher_class_ids = list(current_user.get("class_ids") or [])
        legacy = current_user.get("class_id")
        if legacy and legacy not in teacher_class_ids:
            teacher_class_ids.append(legacy)

        if not teacher_class_ids:
            raise HTTPException(status_code=403, detail="Nessuna classe assegnata")

        doc["sede_id"]         = sede_id
        doc["target_sedi"]     = [sede_id]
        doc["target_roles"]    = ["parent"]          # maestra → SOLO genitori
        doc["target_class_ids"]= teacher_class_ids   # SOLO le sue classi
        doc["target"] = "class"

        # Verifica che i genitori target appartengano alle sue classi
        if doc.get("target_parent_ids"):
            # Recupera i figli delle classi della maestra
            students = await db.students.find(
                {"class_id": {"$in": teacher_class_ids}}, {"_id": 0, "id": 1}
            ).to_list(200)
            student_ids = {s["id"] for s in students}

            # Trova i genitori legittimi
            parents = await db.users.find(
                {"role": "parent", "child_ids": {"$in": list(student_ids)}},
                {"_id": 0, "id": 1}
            ).to_list(200)
            valid_parent_ids = {p["id"] for p in parents}
            doc["target_parent_ids"] = [
                pid for pid in doc["target_parent_ids"] if pid in valid_parent_ids
            ]

    await db.avvisi.insert_one(doc)
    doc.pop("_id", None)

    # ── Push notification ────────────────────────────────────────────────────
    try:
        push_title = f"📢 Nuovo avviso: {doc.get('title', '')}"
        push_body  = (doc.get('body') or doc.get('message') or '')[:120]
        target_roles = doc.get('target_roles') or ['parent']
        class_ids    = doc.get('target_class_ids') or []
        parent_ids   = doc.get('target_parent_ids') or []
        sede_push    = doc.get('sede_id')

        if parent_ids:
            await notify_users(db, parent_ids, push_title, push_body)
        elif class_ids:
            for cid in class_ids:
                await notify_parents_of_class(db, cid, push_title, push_body)
        else:
            for role in target_roles:
                await notify_role(db, role, sede_push, push_title, push_body)
    except Exception:
        pass  # Push non bloccante

    return doc


# ---------------------------------------------------------------------------
# PUT /api/avvisi/{avviso_id}  — modifica titolo/testo (autore o admin)
# ---------------------------------------------------------------------------

@router.put("/{avviso_id}")
async def update_avviso(
    avviso_id: str,
    payload: AvvisoUpdate,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    role = current_user.get("role")
    db = get_db()
    avviso = await db.avvisi.find_one({"id": avviso_id}, {"_id": 0})
    if not avviso:
        raise HTTPException(status_code=404, detail="Avviso non trovato")

    # Solo admin o l'autore possono modificare
    if role == "admin":
        await validate_admin_sede_access(current_user, x_sede_id)
    elif avviso.get("author_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Non puoi modificare questo avviso")

    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    await db.avvisi.update_one({"id": avviso_id}, {"$set": updates})
    updated = await db.avvisi.find_one({"id": avviso_id}, {"_id": 0})
    return updated


# ---------------------------------------------------------------------------
# DELETE /api/avvisi/{avviso_id}
# ---------------------------------------------------------------------------

@router.delete("/{avviso_id}")
async def delete_avviso(
    avviso_id: str,
    current_user: dict = Depends(get_current_user),
    x_sede_id: Optional[str] = Header(None),
):
    role = current_user.get("role")
    db = get_db()
    avviso = await db.avvisi.find_one({"id": avviso_id}, {"_id": 0})
    if not avviso:
        raise HTTPException(status_code=404, detail="Avviso non trovato")

    if role == "admin":
        sede_id = await validate_admin_sede_access(current_user, x_sede_id)
        if avviso.get("sede_id") != sede_id and sede_id not in (avviso.get("target_sedi") or []):
            raise HTTPException(status_code=403, detail="Avviso non appartiene alla sede selezionata")
    elif avviso.get("author_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Permesso negato")

    await db.avvisi.delete_one({"id": avviso_id})
    return {"message": "Avviso eliminato"}
