"""Griglia (daily activity grid) router — tenant isolation via get_tenant_context.

La griglia è per-STUDENTE: il genitore vede solo i propri figli; teacher/admin solo
le proprie classi; superadmin tutto. Denial -> 404. sede_id è denormalizzato sui
nuovi doc per audit/erasure GDPR (il filtro di lettura resta su class_id).
"""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pymongo import InsertOne, ReplaceOne

from services.database import get_db
from utils.expo_push import notify_parents_of_class
from models.griglia import GrigliaEntry, GrigliaBulk
from middleware.auth import get_tenant_context, TenantContext, _resolve_class


def _qty_active(flag: bool, qty: str) -> bool:
    """true se la quantità è impostata e non 'no' (esplicitamente non mangiato), o flag."""
    if qty == "no":
        return False
    return bool(qty) or flag

router = APIRouter(prefix="/api/griglia", tags=["griglia"])

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@router.get("")
async def get_griglia(
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    student_id: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()
    query: dict = {}

    if ctx.role == "parent":
        # Per-studente: il genitore vede SOLO i propri figli (student_id derivato dal profilo).
        allowed = ctx.allowed_student_ids
        if not allowed:
            return []
        if student_id:
            if student_id not in allowed:
                raise HTTPException(status_code=404, detail="Risorsa non trovata")
            query["student_id"] = student_id
        else:
            query["student_id"] = {"$in": list(allowed)}
    else:
        # teacher/admin/superadmin: base SEMPRE le classi del caller (mai {} per non-super).
        if not ctx.all_access and not ctx.allowed_class_ids:
            return []
        query.update(ctx.class_filter())
        if class_id:
            ctx.assert_class(class_id)              # 404 se la classe non è del caller
            query["class_id"] = class_id
        if student_id:
            await ctx.assert_student(student_id)    # 404 se lo studente non è nello scope del caller
            query["student_id"] = student_id

    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["date"] = date

    entries = await db.griglia.find(query, {"_id": 0}).to_list(1000)
    return entries


@router.post("")
async def save_griglia(
    entry: GrigliaEntry,
    ctx: TenantContext = Depends(get_tenant_context),
):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()

    # ── Validazione ATOMICA dell'intero batch: NESSUNA scrittura/notifica finché OGNI id
    #    del batch non è validato (all-or-nothing, indipendente dall'ordine dell'array).
    ctx.assert_class(entry.class_id)                # la classe target dev'essere del caller (404)
    # Membership check BATCHED: una sola query invece di un find_one per studente (N+1).
    # Mantiene la stessa semantica di ctx.assert_student per lo staff — uno studente esiste
    # ed è nello scope del caller SOLO se appare qui (class_id ∈ classi del caller). 404 su
    # qualunque id mancante (all-or-nothing). all_access (superadmin fallback) salta il check.
    if not ctx.all_access:
        found = await db.students.find(
            {"id": {"$in": entry.student_ids},
             "class_id": {"$in": list(ctx.allowed_class_ids)}},
            {"_id": 0, "id": 1},
        ).to_list(1000)
        valid_ids = {s["id"] for s in found}
        for sid in entry.student_ids:
            if sid not in valid_ids:
                raise HTTPException(status_code=404, detail="Risorsa non trovata")

    # ── Solo ora che TUTTO il batch è valido: sede + scritture + notifiche.
    cls = await _resolve_class(db, entry.class_id)
    sede_id = cls.get("sede_id") if cls else None   # audit/erasure GDPR (il filtro resta su class_id)

    entries_created = []
    any_new = False   # per notificare UNA sola volta per salvataggio, non una per bambino

    # Deriva boolean da qty se qty è impostato ("no" = esplicitamente non mangiato -> False)
    def _active(flag: bool, qty: str) -> bool:
        if qty == "no": return False
        return bool(qty) or flag

    # Documenti esistenti recuperati in UNA sola query ($in) invece di un find_one per studente.
    existing_docs = await db.griglia.find(
        {"student_id": {"$in": entry.student_ids},
         "date": entry.date, "class_id": entry.class_id}
    ).to_list(1000)
    existing_by_sid = {d["student_id"]: d for d in existing_docs}

    ops = []
    docs_in_order = []
    for sid in entry.student_ids:
        existing = existing_by_sid.get(sid)
        doc = {
            "id": str(uuid.uuid4()) if not existing else existing.get("id", str(uuid.uuid4())),
            "class_id":    entry.class_id,
            "sede_id":     sede_id,
            "student_id":  sid,
            "date":        entry.date,
            # boolean (true se qty impostata e non "no", o flag esplicito)
            "merenda":  _active(entry.merenda, entry.merenda_qty or ""),
            "pasta":    _active(entry.pasta,   entry.pasta_qty   or ""),
            "secondo":  _active(entry.secondo, entry.secondo_qty or ""),
            "pane":     _active(entry.pane,    entry.pane_qty    or ""),
            "frutta":   _active(entry.frutta,  entry.frutta_qty  or ""),
            # quantità (tutto | bis | poca | metà | no | "")
            "merenda_qty": entry.merenda_qty or "",
            "pasta_qty":   entry.pasta_qty   or "",
            "secondo_qty": entry.secondo_qty or "",
            "pane_qty":    entry.pane_qty    or "",
            "frutta_qty":  entry.frutta_qty  or "",
            # igiene e riposo
            "pupu":  entry.pupu,
            "nanna": entry.nanna,
            "notes": entry.notes,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            ops.append(ReplaceOne({"_id": existing["_id"]}, doc))
        else:
            ops.append(InsertOne(doc))
            any_new = True
        docs_in_order.append(doc)

    # Scritture in UNA sola round-trip (bulk_write) invece di una replace/insert per studente.
    if ops:
        await db.griglia.bulk_write(ops, ordered=False)

    for doc in docs_in_order:
        doc.pop("_id", None)
        entries_created.append(doc)

    # Notifica UNA sola volta per classe (non una per bambino): prima ogni insert nel loop
    # mandava una push → un salvataggio da 20 bambini generava 20 notifiche identiche.
    if any_new:
        try:
            await notify_parents_of_class(
                db, entry.class_id, "🍝 Griglia pasti aggiornata",
                "La maestra ha registrato i pasti di oggi",
            )
        except Exception:
            pass
    return entries_created


@router.post("/bulk")
async def save_griglia_bulk(
    payload: GrigliaBulk,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Salva in UNA sola richiesta la griglia di più bambini, ciascuno con i propri valori,
    e notifica i genitori UNA sola volta. Sostituisce le N chiamate separate dell'app (che
    generavano N notifiche push identiche)."""
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()

    # Validazione ATOMICA dell'intero batch PRIMA di qualsiasi scrittura (all-or-nothing).
    ctx.assert_class(payload.class_id)
    if not _DATE_RE.match(payload.date):
        raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
    # Membership check BATCHED (una query invece di un find_one per studente) — stessa
    # semantica di ctx.assert_student per lo staff: 404 se un id non è nello scope del caller.
    entry_sids = [e.student_id for e in payload.entries]
    if not ctx.all_access:
        found = await db.students.find(
            {"id": {"$in": entry_sids},
             "class_id": {"$in": list(ctx.allowed_class_ids)}},
            {"_id": 0, "id": 1},
        ).to_list(1000)
        valid_ids = {s["id"] for s in found}
        for sid in entry_sids:
            if sid not in valid_ids:
                raise HTTPException(status_code=404, detail="Risorsa non trovata")

    cls = await _resolve_class(db, payload.class_id)
    sede_id = cls.get("sede_id") if cls else None

    # Documenti esistenti in UNA sola query ($in) invece di un find_one per studente.
    existing_docs = await db.griglia.find(
        {"student_id": {"$in": entry_sids},
         "date": payload.date, "class_id": payload.class_id}
    ).to_list(1000)
    existing_by_sid = {d["student_id"]: d for d in existing_docs}

    entries_created = []
    any_new = False
    ops = []
    docs_in_order = []
    for e in payload.entries:
        existing = existing_by_sid.get(e.student_id)
        doc = {
            "id": existing.get("id", str(uuid.uuid4())) if existing else str(uuid.uuid4()),
            "class_id":    payload.class_id,
            "sede_id":     sede_id,
            "student_id":  e.student_id,
            "date":        payload.date,
            "merenda":  _qty_active(e.merenda, e.merenda_qty or ""),
            "pasta":    _qty_active(e.pasta,   e.pasta_qty   or ""),
            "secondo":  _qty_active(e.secondo, e.secondo_qty or ""),
            "pane":     _qty_active(e.pane,    e.pane_qty    or ""),
            "frutta":   _qty_active(e.frutta,  e.frutta_qty  or ""),
            "merenda_qty": e.merenda_qty or "",
            "pasta_qty":   e.pasta_qty   or "",
            "secondo_qty": e.secondo_qty or "",
            "pane_qty":    e.pane_qty    or "",
            "frutta_qty":  e.frutta_qty  or "",
            "pupu":  e.pupu,
            "nanna": e.nanna,
            "notes": e.notes,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            ops.append(ReplaceOne({"_id": existing["_id"]}, doc))
        else:
            ops.append(InsertOne(doc))
            any_new = True
        docs_in_order.append(doc)

    if ops:
        await db.griglia.bulk_write(ops, ordered=False)

    for doc in docs_in_order:
        doc.pop("_id", None)
        entries_created.append(doc)

    if any_new:
        try:
            await notify_parents_of_class(
                db, payload.class_id, "🍝 Griglia pasti aggiornata",
                "La maestra ha registrato i pasti di oggi",
            )
        except Exception:
            pass
    return entries_created
