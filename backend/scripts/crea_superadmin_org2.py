#!/usr/bin/env python3
"""Crea/aggiorna i 2 superadmin di org 2 (dimensione-bimbo).
Hashing bcrypt IDENTICO a services.database.hash_password; il login verifica con bcrypt.checkpw.
Idempotente (upsert per email). NESSUN hash a mano. Password via ENV, non nel repo.

Uso (una tantum, contro PROD — es. console Railway):
  # DRY-RUN
  MONGO_URL="<PROD_URI>" DB_NAME="<db>" \
    SA1_PW='...' SA2_PW='...' python3 backend/scripts/crea_superadmin_org2.py
  # APPLICA (dopo che org 2 + le sue sedi esistono)
  MONGO_URL="<PROD_URI>" DB_NAME="<db>" \
    SA1_PW='...' SA2_PW='...' APPLY=1 python3 backend/scripts/crea_superadmin_org2.py
"""
import os, sys, uuid, datetime
import bcrypt
from pymongo import MongoClient

ORG2 = "dimensione-bimbo"
SUPERADMINS = [
    {"name": "Maria Angela", "cognome": "Matranga", "email": "matranga170@gmail.com", "pw_env": "SA1_PW"},
    {"name": "Provvidenza",  "cognome": "Matranga", "email": "matranga64@gmail.com",  "pw_env": "SA2_PW"},
]

def hash_password(pw: str) -> str:
    # IDENTICO a services.database.hash_password — bcrypt, verificato al login da bcrypt.checkpw
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def main():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "girogirotondo")]
    apply = os.environ.get("APPLY") == "1"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    n = db.sedi.count_documents({"org_id": ORG2, "active": True})
    print(f"[pre-check] sedi attive di org '{ORG2}': {n}")
    if n == 0:
        print("  ATTENZIONE: nessuna sede org 2 → superadmin bounded a ZERO sedi (LOCKOUT).")
        print("  Crea PRIMA l'org e le sedi di Dimensione Bimbo, poi ri-esegui.")

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
