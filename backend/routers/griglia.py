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
    for sid in entry.student_ids:
        await ctx.assert_student(sid)               # ogni studente dev'essere nello scope (404)

    # ── Solo ora che TUTTO il batch è valido: sede + scritture + notifiche.
    cls = await _resolve_class(db, entry.class_id)
    sede_id = cls.get("sede_id") if cls else None   # audit/erasure GDPR (il filtro resta su class_id)

    entries_created = []
    any_new = False   # per notificare UNA sola volta per salvataggio, non una per bambino

    # Deriva boolean da qty se qty è impostato ("no" = esplicitamente non mangiato -> False)
    def _active(flag: bool, qty: str) -> bool:
        if qty == "no": return False
        return bool(qty) or flag

    for sid in entry.student_ids:
        existing = await db.griglia.find_one(
            {"student_id": sid, "date": entry.date, "class_id": entry.class_id}
        )
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
            await db.griglia.replace_one({"_id": existing["_id"]}, doc)
        else:
            await db.griglia.insert_one(doc)
            any_new = True
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
    for e in payload.entries:
        await ctx.assert_student(e.student_id)

    cls = await _resolve_class(db, payload.class_id)
    sede_id = cls.get("sede_id") if cls else None

    entries_created = []
    any_new = False
    for e in payload.entries:
        existing = await db.griglia.find_one(
            {"student_id": e.student_id, "date": payload.date, "class_id": payload.class_id}
        )
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
            await db.griglia.replace_one({"_id": existing["_id"]}, doc)
        else:
            await db.griglia.insert_one(doc)
            any_new = True
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
