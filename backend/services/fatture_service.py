"""Logica Documenti fiscali — numerazione progressiva per sede/anno e costruzione documento.

Numero = progressivo "N/AAAA" per sede e per anno (come da prassi). Idempotenza NON
garantita (emettere una ricevuta è un atto esplicito): due chiamate = due documenti.
"""
import uuid
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def next_number(db, sede_id: str, anno: int) -> str:
    """Prossimo progressivo 'N/AAAA' per la sede nell'anno. Conta i documenti già emessi
    (per quella sede e anno) + 1. Sufficiente ai volumi di una scuola."""
    n = await db.fatture.count_documents({"sede_id": sede_id, "anno": anno})
    return f"{n + 1}/{anno}"


async def _intestatario_from_parent(db, student_id: str) -> dict:
    """Ricava l'intestatario dal primo genitore collegato al bambino (via child_ids)."""
    p = await db.users.find_one(
        {"role": "parent", "child_ids": student_id},
        {"_id": 0, "name": 1, "email": 1},
    )
    if not p:
        return {"nome": "", "codice_fiscale": None, "indirizzo": None, "email": None}
    return {"nome": p.get("name", ""), "codice_fiscale": None, "indirizzo": None, "email": p.get("email")}


async def build_document(db, sede_id: str, payload, student: dict) -> dict:
    """Costruisce (senza inviare a SDI) un documento ricevuta/fattura dai pagamenti registrati
    sugli addebiti indicati. Le righe riportano l'INCASSATO (quietanza), non il dovuto."""
    # Addebiti da includere
    q = {"sede_id": sede_id, "student_id": payload.student_id}
    if payload.charge_ids:
        q["id"] = {"$in": payload.charge_ids}
    else:
        q["paid_amount"] = {"$gt": 0}
    charges = await db.charges.find(q, {"_id": 0}).to_list(5000)

    righe = []
    totale = 0.0
    for c in charges:
        incassato = round(float(c.get("paid_amount") or 0), 2)
        if incassato <= 0:
            continue
        periodo = "una tantum" if c.get("period") == "una_tantum" else c.get("period", "")
        righe.append({
            "descrizione": f"{c.get('description', '')}" + (f" ({periodo})" if periodo else ""),
            "importo": incassato,
            "charge_id": c.get("id"),
        })
        totale += incassato

    data = payload.data or today_str()
    anno = int(data[:4]) if data[:4].isdigit() else datetime.now(timezone.utc).year
    numero = await next_number(db, sede_id, anno)

    intest = payload.intestatario.model_dump() if payload.intestatario else await _intestatario_from_parent(db, payload.student_id)

    return {
        "id": str(uuid.uuid4()),
        "sede_id": sede_id,
        "student_id": payload.student_id,
        "bambino": f"{student.get('name', '')} {student.get('cognome', '') or ''}".strip(),
        "tipo": payload.tipo,
        "numero": numero,
        "anno": anno,
        "data": data,
        "intestatario": intest,
        "righe": righe,
        "totale": round(totale, 2),
        "note": payload.note,
        # La trasmissione SDI (fattura elettronica XML) NON è gestita: marcata per il futuro.
        "sdi_inviata": False,
        "created_at": _now_iso(),
    }
