"""Read receipts router — mark documents as read, count unread (tenant-scoped)."""
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from services.database import get_db
from models.documents import ReadReceiptCreate
from middleware.auth import get_tenant_context, TenantContext

router = APIRouter(prefix="/api/read-receipts", tags=["read-receipts"])


def _visible_docs_query(ctx: TenantContext) -> dict:
    """Mongo fragment con i documenti visibili al chiamante — stessa logica di
    documents._tenant_scope (classe del chiamante OPPURE documento di sede senza classe
    nella sua sede). Superadmin/all_access = tutti."""
    if ctx.all_access:
        return {}
    return {"$or": [
        {"classe_id": {"$in": list(ctx.allowed_class_ids)}},
        {"classe_id": {"$in": [None, ""]}, "sede_id": {"$in": list(ctx.sede_ids)}},
    ]}


def _doc_visible(ctx: TenantContext, doc: dict) -> bool:
    if ctx.all_access:
        return True
    classe_id = doc.get("classe_id")
    if classe_id:
        return classe_id in ctx.allowed_class_ids
    return doc.get("sede_id") in ctx.sede_ids


@router.get("")
async def get_read_receipts(
    document_id: Optional[str] = None,
    parent_id: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()
    query: dict = {}
    if document_id:
        query["document_id"] = document_id
    # Un genitore vede SOLO le proprie ricevute: forziamo self, ignorando il
    # parent_id del client (altrimenti IDOR: leggerebbe le ricevute di altre famiglie).
    if ctx.role == "parent":
        query["parent_id"] = ctx.user_id
    elif parent_id:
        query["parent_id"] = parent_id

    # Staff (admin/teacher, non superadmin): limita le ricevute ai SOLI documenti della
    # propria sede/classe → il rapporto "prese visione" non conta famiglie di altre sedi.
    if not ctx.all_access and ctx.role in ("admin", "teacher"):
        visible = await db.documents.find(
            _visible_docs_query(ctx), {"_id": 0, "id": 1}
        ).to_list(5000)
        visible_ids = {d["id"] for d in visible}
        if document_id:
            # Un document_id esplicito NON è fidato: deve appartenere alla sede/classe del
            # chiamante, altrimenti leggerebbe le ricevute (parent_id) di un doc di altra sede.
            if document_id not in visible_ids:
                raise HTTPException(status_code=404, detail="Documento non trovato")
            query["document_id"] = document_id
        else:
            query["document_id"] = {"$in": list(visible_ids)}

    receipts = await db.read_receipts.find(query, {"_id": 0}).to_list(5000)
    return receipts


@router.post("", status_code=201)
async def create_read_receipt(
    payload: ReadReceiptCreate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    db = get_db()

    # SICUREZZA: il parent_id è SEMPRE quello del token autenticato — mai preso dal
    # payload — così un genitore non può forgiare ricevute "presa visione" a nome altrui.
    parent_id = ctx.user_id
    if not parent_id:
        raise HTTPException(status_code=401, detail="Utente non identificato")

    # Il documento deve esistere ed essere visibile al chiamante (no ack cross-tenant).
    doc = await db.documents.find_one({"id": payload.document_id}, {"_id": 0})
    if not doc or not _doc_visible(ctx, doc):
        raise HTTPException(status_code=404, detail="Documento non trovato")

    existing = await db.read_receipts.find_one(
        {"document_id": payload.document_id, "parent_id": parent_id}
    )
    if existing:
        existing.pop("_id", None)
        return existing

    doc_receipt = {
        "id": str(uuid.uuid4()),
        "document_id": payload.document_id,
        "parent_id": parent_id,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.read_receipts.insert_one(doc_receipt)
    doc_receipt.pop("_id", None)
    return doc_receipt


@router.get("/unread")
async def get_unread_count(ctx: TenantContext = Depends(get_tenant_context)):
    """Numero di documenti VISIBILI al chiamante non ancora presi in visione.
    Il totale è limitato alla sede/classe del chiamante (niente conteggio cross-tenant)."""
    db = get_db()
    parent_id = ctx.user_id
    if not parent_id:
        return {"unread": 0, "total": 0, "read": 0}

    visible = await db.documents.find(
        _visible_docs_query(ctx), {"_id": 0, "id": 1}
    ).to_list(5000)
    visible_ids = [d["id"] for d in visible]
    total_docs = len(visible_ids)
    read_count = await db.read_receipts.count_documents(
        {"parent_id": parent_id, "document_id": {"$in": visible_ids}}
    ) if visible_ids else 0
    unread = max(0, total_docs - read_count)
    return {"unread": unread, "total": total_docs, "read": read_count}
