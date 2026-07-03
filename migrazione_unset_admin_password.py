#!/usr/bin/env python3
"""
Migrazione: rimuove il campo `admin_password` (plaintext) da TUTTI gli utenti.

NON tocca `password` (hash bcrypt) → il login continua a funzionare, nessun lockout.
Idempotente (re-eseguibile: la seconda volta non trova nulla da rimuovere).
DRY RUN di default; scrive solo con --yes.

USO:
  # anteprima (nessuna scrittura): mostra a quale DB sei collegato + quanti utenti
  MONGO_URL='<URI>' backend/.venv/bin/python migrazione_unset_admin_password.py
  # esecuzione
  MONGO_URL='<URI>' backend/.venv/bin/python migrazione_unset_admin_password.py --yes

Env opzionali: DB_NAME (default "girogirotondo")

ORDINE (prod): eseguire SOLO DOPO che il deploy del codice fase0 è live, altrimenti
la prima iscrizione/reset ri-scriverebbe admin_password.
"""
import os
import sys
from urllib.parse import urlparse

import certifi
from pymongo import MongoClient

DB_NAME = os.environ.get("DB_NAME", "girogirotondo")
WRITE = "--yes" in sys.argv


def mask(uri: str) -> str:
    try:
        p = urlparse(uri)
        return f"{p.scheme}://***@{p.hostname}/{DB_NAME}"
    except Exception:
        return f"<?>/{DB_NAME}"


def main():
    uri = os.environ.get("MONGO_URL")
    if not uri:
        sys.exit("❌ MONGO_URL non impostata.")
    kw = dict(serverSelectionTimeoutMS=20000)
    if uri.startswith("mongodb+srv://") or "mongodb.net" in uri:
        kw.update(tlsCAFile=certifi.where(),
                  tlsAllowInvalidCertificates=True, tlsAllowInvalidHostnames=True)
    cli = MongoClient(uri, **kw)
    cli.admin.command("ping")
    db = cli[DB_NAME]

    total = db.users.estimated_document_count()
    with_ap = db.users.count_documents({"admin_password": {"$exists": True}})
    print("=" * 60)
    print("DB     :", mask(uri))
    print(f"Utenti : {total}   |   con admin_password: {with_ap}")
    print("=" * 60)

    if with_ap == 0:
        print("Nessun admin_password presente — niente da rimuovere. ✅")
        return
    if not WRITE:
        print(f"\nDRY RUN — nessuna scrittura. Ri-esegui con --yes per rimuovere "
              f"admin_password da {with_ap} utenti.")
        return

    res = db.users.update_many(
        {"admin_password": {"$exists": True}},
        {"$unset": {"admin_password": ""}},
    )
    after = db.users.count_documents({"admin_password": {"$exists": True}})
    print(f"\n✍️  matched={res.matched_count}  modified={res.modified_count}")
    print(f"Utenti con admin_password DOPO: {after}   (atteso 0)")
    print("Il campo `password` (bcrypt) NON è stato toccato → login intatto, nessun lockout.")


if __name__ == "__main__":
    main()
