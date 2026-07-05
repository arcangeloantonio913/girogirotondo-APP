"""Registro Presenze/Assenze router — tenant isolation via get_tenant_context.

Solo staff (teacher/admin). Scoping per CLASSE: i doc presenze non hanno sede_id, il
POST lo denormalizza sui NUOVI doc per audit/erasure GDPR ma il filtro di lettura resta
su class_id (presente al 100%). Denial -> 404. Superadmin all-access.
"""
import re
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.presenze import PresenzaDay
from middleware.auth import get_tenant_context, TenantContext, _resolve_class

router = APIRouter(prefix="/api/presenze", tags=["presenze"])

_DATE_RE  = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
_YEAR_RE  = re.compile(r"^\d{4}$")


# ---------------------------------------------------------------------------
# POST /api/presenze — salva registro giornaliero (maestra o admin) — ALL-OR-NOTHING
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def save_presenze(
    payload: PresenzaDay,
    ctx: TenantContext = Depends(get_tenant_context),
):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    if not _DATE_RE.match(payload.date):
        raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")

    db = get_db()

    # ── Validazione ATOMICA dell'intero batch: NESSUNA scrittura finché la classe e OGNI
    #    studente non sono validati (all-or-nothing, indipendente dall'ordine dell'array).
    ctx.assert_class(payload.class_id)                 # 404 se la classe non è del caller
    for rec in payload.records:
        await ctx.assert_student(rec.student_id)       # 404 se lo studente non è nello scope del caller

    # ── Solo ora che TUTTO il batch è valido: sede + scritture.
    cls = await _resolve_class(db, payload.class_id)
    sede_id = cls.get("sede_id") if cls else None      # audit/erasure GDPR (il filtro resta su class_id)

    saved = []
    for rec in payload.records:
        existing = await db.presenze.find_one({
            "class_id":   payload.class_id,
            "date":       payload.date,
            "student_id": rec.student_id,
        })
        doc = {
            "id":         str(uuid.uuid4()) if not existing else existing.get("id", str(uuid.uuid4())),
            "class_id":   payload.class_id,
            "sede_id":    sede_id,
            "date":       payload.date,
            "student_id": rec.student_id,
            "presente":   rec.presente,
            "nota":       rec.nota,
            "saved_by":   ctx.user_id,
            "saved_at":   datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            await db.presenze.replace_one({"_id": existing["_id"]}, doc)
        else:
            await db.presenze.insert_one(doc)
        doc.pop("_id", None)
        saved.append(doc)

    return {"saved": len(saved), "date": payload.date, "class_id": payload.class_id}


# ---------------------------------------------------------------------------
# GET /api/presenze — recupera presenze (giorno / mese / anno) — .find()
# ---------------------------------------------------------------------------

@router.get("")
async def get_presenze(
    class_id:  Optional[str] = None,
    date:      Optional[str] = None,   # YYYY-MM-DD  → giorno esatto
    mese:      Optional[str] = None,   # YYYY-MM     → tutto il mese
    anno:      Optional[str] = None,   # YYYY        → tutto l'anno
    ctx: TenantContext = Depends(get_tenant_context),
):
    if ctx.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Permesso negato")
    db = get_db()

    # base SEMPRE le classi del caller (mai {} per non-super; superadmin -> {})
    if not ctx.all_access and not ctx.allowed_class_ids:
        return []
    query: dict = {}
    query.update(ctx.class_filter())          # .find(): scope iniettato nel FILTRO
    if class_id:
        ctx.assert_class(class_id)            # 404 se la classe non è del caller
        query["class_id"] = class_id

    # Filtro temporale (vincolo aggiuntivo)
    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
        query["date"] = date
    elif mese:
        if not _MONTH_RE.match(mese):
            raise HTTPException(status_code=400, detail="Formato mese non valido (YYYY-MM)")
        query["date"] = {"$regex": f"^{mese}"}
    elif anno:
        if not _YEAR_RE.match(anno):
            raise HTTPException(status_code=400, detail="Formato anno non valido (YYYY)")
        query["date"] = {"$regex": f"^{anno}"}

    records = await db.presenze.find(query, {"_id": 0}).to_list(10000)
    return records


# ---------------------------------------------------------------------------
# GET /api/presenze/classi-summary — riepilogo admin (classi della SUA sede) — .find()
# ---------------------------------------------------------------------------

@router.get("/classi-summary")
async def get_classi_summary(
    date: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Admin only: presenze/assenze per ogni classe (della propria sede) in una data."""
    if ctx.role != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")

    today = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not _DATE_RE.match(today):
        raise HTTPException(status_code=400, detail="Formato data non valido")

    db = get_db()
    # NB: aggregazione fatta in Python su una .find() (NON una pipeline aggregate):
    #     lo scope va nel FILTRO della find, non in uno $match.
    q: dict = {"date": today}
    q.update(ctx.class_filter())
    records = await db.presenze.find(q, {"_id": 0}).to_list(5000)

    summary: dict = {}
    for r in records:
        cid = r["class_id"]
        if cid not in summary:
            summary[cid] = {"presenti": 0, "assenti": 0, "totale": 0}
        summary[cid]["totale"] += 1
        if r["presente"]:
            summary[cid]["presenti"] += 1
        else:
            summary[cid]["assenti"] += 1

    return {"date": today, "classes": summary}
