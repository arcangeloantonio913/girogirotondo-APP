"""Export CSV per la segreteria/commercialista — addebiti, pagamenti, anagrafiche, SIDI.

CSV puro (stdlib, nessuna dipendenza). Tutto filtrato per sede (multi-tenant). I nomi
di bambini/sezioni sono risolti con una sola lettura per tipo (niente N+1).
"""
import csv
import io

from services import rette_service as svc

METHOD_LABEL = {
    "bonifico": "Bonifico", "sdd": "Addebito SDD", "pagopa": "PagoPA",
    "stripe": "Carta (Stripe)", "contanti": "Contanti", "pos": "POS", "altro": "Altro",
}
STATUS_LABEL = {
    "da_pagare": "Da pagare", "parziale": "Parziale", "pagato": "Pagato", "stornato": "Stornato",
}


def _csv(headers: list, rows: list) -> str:
    """Serializza righe in CSV (separatore ';' = compatibile Excel IT; BOM per gli accenti)."""
    buf = io.StringIO()
    buf.write("﻿")  # BOM UTF-8 → Excel apre gli accenti correttamente
    w = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow(headers)
    w.writerows(rows)
    return buf.getvalue()


async def _student_index(db, sede_id: str) -> dict:
    """Mappa student_id → dict bambino (per nome/sezione), limitata alla sede."""
    classes = await db.classes.find({"sede_id": sede_id}, {"_id": 0, "id": 1, "name": 1}).to_list(2000)
    cls_name = {c["id"]: c.get("name", "") for c in classes}
    cls_ids = list(cls_name.keys())
    # Studenti della sede: per sede_id OPPURE per classe (record vecchi senza sede_id)
    students = await db.students.find(
        {"$or": [{"sede_id": sede_id}, {"class_id": {"$in": cls_ids}}]}, {"_id": 0}
    ).to_list(10000)
    idx = {}
    for s in students:
        idx[s["id"]] = {**s, "sezione": cls_name.get(s.get("class_id"), "")}
    return idx


def _full_name(s: dict) -> str:
    return f"{(s or {}).get('name', '')} {(s or {}).get('cognome', '') or ''}".strip()


async def addebiti_csv(db, sede_id: str) -> str:
    idx = await _student_index(db, sede_id)
    rows_src = await db.charges.find({"sede_id": sede_id}, {"_id": 0}).sort("due_date", 1).to_list(50000)
    today = svc.today_str()
    rows = []
    for c in rows_src:
        svc.annotate(c, today)
        st = idx.get(c.get("student_id")) or {}
        stato = "Scaduto" if c.get("scaduto") else STATUS_LABEL.get(c.get("status"), c.get("status", ""))
        rows.append([
            _full_name(st), st.get("sezione", ""),
            c.get("description", ""),
            "una tantum" if c.get("period") == "una_tantum" else c.get("period", ""),
            f"{float(c.get('amount') or 0):.2f}".replace(".", ","),
            f"{float(c.get('paid_amount') or 0):.2f}".replace(".", ","),
            f"{float(c.get('residuo') or 0):.2f}".replace(".", ","),
            stato, c.get("due_date") or "",
        ])
    return _csv(
        ["Bambino", "Sezione", "Descrizione", "Periodo", "Importo", "Incassato", "Residuo", "Stato", "Scadenza"],
        rows,
    )


async def pagamenti_csv(db, sede_id: str) -> str:
    idx = await _student_index(db, sede_id)
    rows_src = await db.payments.find({"sede_id": sede_id}, {"_id": 0}).sort("paid_at", 1).to_list(50000)
    rows = []
    for p in rows_src:
        st = idx.get(p.get("student_id")) or {}
        rows.append([
            _full_name(st), st.get("sezione", ""),
            p.get("paid_at", ""),
            f"{float(p.get('amount') or 0):.2f}".replace(".", ","),
            METHOD_LABEL.get(p.get("method"), p.get("method", "")),
            p.get("note") or "",
        ])
    return _csv(["Bambino", "Sezione", "Data", "Importo", "Metodo", "Nota"], rows)


async def anagrafiche_csv(db, sede_id: str) -> str:
    idx = await _student_index(db, sede_id)
    # Genitori collegati per bambino (via users.child_ids)
    parents = await db.users.find(
        {"role": "parent", "child_ids": {"$exists": True}},
        {"_id": 0, "name": 1, "email": 1, "child_ids": 1},
    ).to_list(20000)
    par_by_child: dict = {}
    for p in parents:
        for cid in (p.get("child_ids") or []):
            par_by_child.setdefault(cid, []).append(p)
    rows = []
    for sid, s in idx.items():
        pp = par_by_child.get(sid, [])
        rows.append([
            s.get("name", ""), s.get("cognome", "") or "", s.get("date_of_birth", "") or "",
            s.get("sezione", ""),
            ", ".join(s.get("allergies") or []),
            "; ".join(f"{x.get('name','')} <{x.get('email','')}>" for x in pp),
        ])
    return _csv(["Nome", "Cognome", "Data nascita", "Sezione", "Allergie", "Genitori"], rows)


async def sidi_alunni_csv(db, sede_id: str) -> str:
    """Export anagrafico orientato al SIDI (anagrafe alunni). Le colonne rispecchiano i campi
    del SIDI 'Inserisci Dati Alunno'. I campi non ancora presenti nei dati (CF, comune nascita,
    residenza) restano vuoti: vanno completati. ⚠️ NON è il flusso SIDI certificato — serve il
    tracciato ufficiale per l'import automatico; questo è un export di lavoro per la segreteria."""
    idx = await _student_index(db, sede_id)
    rows = []
    for s in idx.values():
        rows.append([
            s.get("cognome", "") or "", s.get("name", ""),
            "",                       # Codice fiscale (da calcolare/raccogliere)
            s.get("date_of_birth", "") or "",
            "", "",                   # Comune / Provincia di nascita
            "",                       # Cittadinanza
            "", "", "",               # Residenza: indirizzo / comune / provincia
            s.get("sezione", ""),
        ])
    return _csv(
        ["Cognome", "Nome", "Codice fiscale", "Data nascita", "Comune nascita", "Prov. nascita",
         "Cittadinanza", "Residenza", "Comune residenza", "Prov. residenza", "Sezione"],
        rows,
    )
