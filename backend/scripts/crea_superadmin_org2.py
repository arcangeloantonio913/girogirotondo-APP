#!/usr/bin/env python3
"""Crea/aggiorna i 2 superadmin di org 2 (dimensione-bimbo).
Hashing bcrypt IDENTICO a services.database.hash_password; il login verifica con bcrypt.checkpw.
Idempotente (upsert per email). NESSUN hash a mano. Password via ENV, non nel repo.

Uso (una tantum, contro PROD — nella CONSOLE/Shell di Railway, così le password NON
passano dalla chat). In /app:
  # DRY-RUN (mostra pre-check sedi + se gli account esistono già)
  CETTY_PW='...' ANGELA_PW='...' python3 scripts/crea_superadmin_org2.py
  # APPLICA (dopo che org 2 + le sue sedi esistono)
  CETTY_PW='...' ANGELA_PW='...' APPLY=1 python3 scripts/crea_superadmin_org2.py
(MONGO_URL e DB_NAME sono già nell'env del servizio Railway.)
"""
import os, sys, uuid, datetime
import bcrypt
from pymongo import MongoClient

ORG2 = "dimensione-bimbo"
# Direttrici di Dimensione Bimbo (superadmin dell'org DB → vedono TUTTE le 4 sedi DB,
# MAI i dati di Girogirotondo). Email ESATTE come indicate dalla direzione.
SUPERADMINS = [
    {"name": "Cetty",  "cognome": "Matranga", "email": "matranga.64@gmail.com", "pw_env": "CETTY_PW"},
    {"name": "Angela", "cognome": "Matranga", "email": "matranga170@gmail.com", "pw_env": "ANGELA_PW"},
]

def hash_password(pw: str) -> str:
    # IDENTICO a services.database.hash_password — bcrypt, verificato al login da bcrypt.checkpw
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

# Sedi di Dimensione Bimbo (id usati dall'import). Vanno tutte sotto l'org ORG2 così le
# direttrici (superadmin org-bounded) le vedono. Se in prod hanno id diversi, la stampa
# "[sedi in DB]" qui sotto lo rivela e va aggiornata.
DB_SEDE_IDS = ["db-centrale", "db-nido", "db-succursale", "db-micronido"]

def main():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "girogirotondo")]
    apply = os.environ.get("APPLY") == "1"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # ── Quadro reale: tutte le sedi in DB (id, nome, org_id) ─────────────────────
    print("[sedi in DB] (id | nome | org_id | active)")
    for s in db.sedi.find({}, {"_id": 0, "id": 1, "name": 1, "org_id": 1, "active": 1}):
        print(f"   - {s.get('id')} | {s.get('name')} | {s.get('org_id')} | {s.get('active')}")

    # ── 1. Garantisci l'org Dimensione Bimbo ─────────────────────────────────────
    org = db.orgs.find_one({"id": ORG2})
    print(f"[org] '{ORG2}' esiste: {bool(org)}")
    if apply and not org:
        db.orgs.insert_one({"id": ORG2, "name": "Dimensione Bimbo", "active": True, "created_at": now})
        print(f"  [APPLY] creata org '{ORG2}'")

    # ── 2. Backfill org_id sulle sedi DB che ne sono prive/errate ────────────────
    for sid in DB_SEDE_IDS:
        sede = db.sedi.find_one({"id": sid}, {"_id": 0, "id": 1, "org_id": 1})
        if not sede:
            print(f"  [sede] '{sid}' NON trovata in DB (salto)"); continue
        if sede.get("org_id") != ORG2:
            print(f"  [{'APPLY' if apply else 'DRY-RUN'}] sede '{sid}' org_id {sede.get('org_id')} -> {ORG2}")
            if apply:
                db.sedi.update_one({"id": sid}, {"$set": {"org_id": ORG2, "active": True}})

    n = db.sedi.count_documents({"org_id": ORG2, "active": True})
    print(f"[pre-check] sedi attive di org '{ORG2}': {n}"
          + ("" if apply else "  (post-backfill sarà >= le sedi DB trovate sopra)"))
    if apply and n == 0:
        print("  ATTENZIONE: 0 sedi org 2 dopo il backfill → gli id in DB_SEDE_IDS non combaciano")
        print("  con quelli reali (vedi '[sedi in DB]' sopra). Aggiorna DB_SEDE_IDS e ri-esegui.")

    for sa in SUPERADMINS:
        pw = os.environ.get(sa["pw_env"])
        if not pw:
            print(f"  ERRORE: manca la env {sa['pw_env']} per {sa['email']}"); sys.exit(1)
        existing = db.users.find_one({"email": sa["email"]}, {"id": 1})
        doc_set = {
            "firebase_uid": None,
            "name": sa["name"], "cognome": sa["cognome"], "email": sa["email"],
            "password": hash_password(pw),
            "role": "admin", "is_superadmin": True,
            "org_id": ORG2, "sede_id": None,
            "class_id": None, "class_ids": [], "child_id": None, "child_ids": [],
            "avatar_url": None, "active": True,
        }
        print(f"[{'APPLY' if apply else 'DRY-RUN'}] {'UPDATE' if existing else 'INSERT'} {sa['email']} (org={ORG2})")
        if apply:
            db.users.update_one(
                {"email": sa["email"]},
                {"$set": doc_set, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}},
                upsert=True,
            )

    if not apply:
        print("DRY-RUN: nessuna scrittura. Ri-esegui con APPLY=1 per applicare."); return

    print("=== VERIFY (non stampa password/hash) ===")
    for sa in SUPERADMINS:
        u = db.users.find_one({"email": sa["email"]})
        ok = bool(u) and bcrypt.checkpw(os.environ[sa["pw_env"]].encode(), u["password"].encode())
        print({"email": sa["email"], "is_superadmin": u and u.get("is_superadmin"),
               "org_id": u and u.get("org_id"), "sede_id": u and u.get("sede_id"),
               "password_bcrypt_ok": ok})   # True = verifica col login (bcrypt.checkpw)

if __name__ == "__main__":
    main()
