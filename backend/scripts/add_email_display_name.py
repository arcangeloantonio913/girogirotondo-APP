#!/usr/bin/env python3
"""Seed dei campi brand per le email: `email_display_name` sulle sedi + identità
mittente (from_name/from_email/support_email/portal_url) sulle ORG.

`email_display_name` (SEDE) è il nome-scuola ESPLICITO mostrato nel corpo email,
distinto da `name` (label dello switcher UI). Cascata: email_display_name → org.name → "Portale Famiglie".

L'identità mittente è BRAND-LEVEL (documento ORG, non sede): è ciò che il
destinatario vede nella inbox (From, Reply-To) e nel corpo (contatti, portale).
Cascata: org.<campo> → fallback tenant-neutro + log ERROR (mai un valore di Giro).

Idempotente: ri-eseguirlo non cambia nulla se i valori sono già corretti.
pymongo SYNC. Per `mongodb+srv://` usa certifi + tlsAllowInvalidCertificates.
MONGO_URL / DB_NAME letti da env.

Uso (una tantum, contro PROD — es. console Railway):
  # DRY-RUN (nessuna scrittura, stampa esattamente cosa cambierebbe)
  MONGO_URL="<PROD_URI>" DB_NAME="<db>" python3 backend/scripts/add_email_display_name.py --dry-run
  # APPLICA
  MONGO_URL="<PROD_URI>" DB_NAME="<db>" python3 backend/scripts/add_email_display_name.py
"""
import os
import sys

import certifi
from pymongo import MongoClient

# sede_id → email_display_name (brand-scuola mostrato nell'email)
EMAIL_DISPLAY_NAMES = {
    "girogirotondo":  "Girogirotondo — Scuola dell'Infanzia",
    "il-magico-mondo": "Il Magico Mondo — Scuola dell'Infanzia",
    "demo-sandbox":   "Girogirotondo — Demo",
    "db-centrale":    "Dimensione Bimbo — Sede Centrale",
    "db-nido":        "Dimensione Bimbo — Nido",
    "db-succursale":  "Dimensione Bimbo — Succursale",
    "db-micronido":   "Dimensione Bimbo — Micronido",
}

# org_id → identità mittente brand-level (From/Reply-To + contatti/portale nel corpo).
# girogirotondo-group: valori ATTUALI di Giro → l'email resta byte-identica, mittente incluso.
# dimensione-bimbo: mittente su dominio VERIFICATO Resend (omniamarketing.studio).
#   portal_url VUOTO: DB ha solo una landing, nessun login web → i link di reset non
#   hanno destinazione. Con portal_url vuoto il backend NON invia l'email di reset.
# reply_to NON è un campo memorizzato: è DERIVATO da support_email in _org_identity.
ORG_IDENTITIES = {
    "girogirotondo-group": {
        # from_email = mittente Resend VERIFICATO di produzione (NON l'SMTP di
        # fallback girogirotondo@libero.it). support_email/reply-to = casella Libero.
        # portal_url SENZA www: mantiene il deep-link di reset byte-identico a prod.
        "from_name":     "Girogirotondo Scuola dell'Infanzia",
        "from_email":    "noreply@girogirotondowebapp.it",
        "support_email": "girogirotondo@libero.it",
        "portal_url":    "https://girogirotondowebapp.it",
    },
    "dimensione-bimbo": {
        "from_name":     "Dimensione Bimbo",
        "from_email":    "noreply@omniamarketing.studio",   # dominio verificato Resend
        "support_email": "info@dimensionebimbo.it",         # → reply_to derivato
        "portal_url":    "",                                # nessun portale web
    },
}


def _connect():
    uri = os.environ.get("MONGO_URL")
    if not uri:
        print("ERRORE: env MONGO_URL mancante"); sys.exit(1)
    db_name = os.environ.get("DB_NAME", "girogirotondo")
    if uri.startswith("mongodb+srv://"):
        client = MongoClient(uri, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
    else:
        client = MongoClient(uri)
    return client[db_name]


def _seed_sedi(db, dry_run):
    print(f"--- SEDI: email_display_name ({len(EMAIL_DISPLAY_NAMES)}) ---")
    changed = missing = unchanged = 0
    for sede_id, new_val in EMAIL_DISPLAY_NAMES.items():
        sede = db.sedi.find_one({"id": sede_id}, {"_id": 0, "email_display_name": 1})
        if sede is None:
            print(f"  [SKIP]     '{sede_id}': sede NON trovata nel DB")
            missing += 1
            continue
        cur = sede.get("email_display_name")
        if cur == new_val:
            print(f"  [OK]       '{sede_id}': già = {new_val!r}")
            unchanged += 1
            continue
        print(f"  [{'WOULD SET' if dry_run else 'SET'}] '{sede_id}': {cur!r} -> {new_val!r}")
        changed += 1
        if not dry_run:
            db.sedi.update_one({"id": sede_id}, {"$set": {"email_display_name": new_val}})
    return changed, unchanged, missing


def _seed_orgs(db, dry_run):
    print(f"--- ORG: identità mittente ({len(ORG_IDENTITIES)}) ---")
    changed = missing = unchanged = 0
    for org_id, fields in ORG_IDENTITIES.items():
        org = db.orgs.find_one({"id": org_id}, {"_id": 0, **{k: 1 for k in fields}})
        if org is None:
            print(f"  [SKIP]     '{org_id}': org NON trovata nel DB")
            missing += 1
            continue
        diff = {k: v for k, v in fields.items() if org.get(k) != v}
        if not diff:
            print(f"  [OK]       '{org_id}': identità già corretta")
            unchanged += 1
            continue
        for k, v in diff.items():
            print(f"  [{'WOULD SET' if dry_run else 'SET'}] '{org_id}'.{k}: {org.get(k)!r} -> {v!r}")
        changed += 1
        if not dry_run:
            db.orgs.update_one({"id": org_id}, {"$set": diff})
    return changed, unchanged, missing


def main():
    dry_run = "--dry-run" in sys.argv[1:]
    db = _connect()
    mode = "DRY-RUN" if dry_run else "APPLY"
    print(f"=== seed brand email [{mode}] ===")

    s = _seed_sedi(db, dry_run)
    o = _seed_orgs(db, dry_run)

    print(f"--- riepilogo SEDI: {s[0]} da modificare, {s[1]} già ok, {s[2]} mancanti ---")
    print(f"--- riepilogo ORG:  {o[0]} da modificare, {o[1]} già ok, {o[2]} mancanti ---")
    if dry_run:
        print("DRY-RUN: nessuna scrittura. Ri-esegui SENZA --dry-run per applicare.")


if __name__ == "__main__":
    main()
