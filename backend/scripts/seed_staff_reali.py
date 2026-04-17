"""
seed_staff_reali.py
Inserisce tutti i 14 account staff con le password ESATTE dal file credenziali.
Usa direttamente bcrypt su MongoDB Atlas (bypass Firebase).

Uso:
    # Con MONGO_URL dal .env:
    cd girogirotondo-APP
    python3 backend/scripts/seed_staff_reali.py

    # Oppure passando l'URL Railway come argomento:
    python3 backend/scripts/seed_staff_reali.py "mongodb+srv://user:pass@cluster.mongodb.net/db"
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

try:
    import pymongo
    from pymongo import MongoClient
except ImportError:
    print("Manca pymongo: pip install pymongo dnspython")
    sys.exit(1)

try:
    import bcrypt
except ImportError:
    print("Manca bcrypt: pip install bcrypt")
    sys.exit(1)

# Accetta MONGO_URL da argomento oppure .env
MONGO_URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MONGO_URL", "")
DB_NAME   = os.environ.get("DB_NAME", "girogirotondo")

if not MONGO_URL:
    print("ERRORE: fornisci MONGO_URL nel .env o come argomento.")
    sys.exit(1)

# ────────────────────────────────────────────────────
# STAFF con password ESATTE da credenziali_staff.txt
# (nome, cognome, email, password, ruolo, sezione)
# ────────────────────────────────────────────────────
STAFF = [
    # Admin / Direzione
    ("Teresa",       "Melignano",  "melignanoTeresa@gmail.com",          "OdN7d4YeY1", "admin",   None),
    ("Giovanna",     "Melignano",  "giovannaMelignano@gmail.com",         "jdejQfWqqq", "admin",   None),
    ("Maria Grazia", "Schiera",    "mariucciasc@gmail.com",               "32Gn4VAXAu", "admin",   None),
    # Maestre
    ("Giorgia",      "Greco",      "giorgia.greco1495@gmail.com",         "q5W6fzHYzE", "teacher", None),
    ("Marika",       "Russo",      "graziamaruikarusso@gmail.com",        "RLNZdYTe81", "teacher", None),
    ("Chiara",       "Lionetti",   "chiaralionetti98@gmail.com",          "3o4GmOQZGP", "teacher", None),
    ("Rachele",      "Impastato",  "rachele.impastato@gmail.com",         "IKds8B3JOk", "teacher", None),
    ("Loredana",     "Pillitteri", "loredana.pillitteri@hotmail.it",      "clo9MKeBxO", "teacher", None),
    ("Elisabetta",   "Saitta",     "saitta.es@libero.it",                 "xLukAUBOoy", "teacher", None),
    ("Sefora",       "Caruso",     "seficar@hotmail.it",                  "GiqoldVpvz", "teacher", None),
    ("Marzia",       "Barone",     "marziabarone34@gmail.com",            "OgfuYRfC1J", "teacher", None),
    ("Gabriella",    "Franco",     "gabri.franco@hotmail.it",             "kxkRvMUChH", "teacher", None),
    ("Claudia",      "Pizzo",      "claudiapizzo29@outlook.it",           "bobb9ErWmu", "teacher", None),
    ("Tatiana",      "Cardinale",  "tatianacardinale@icloud.com",         "pmwYcV0eR2", "teacher", None),
]


def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def main():
    print("=" * 60)
    print("  SEED STAFF — password reali da credenziali_staff.txt")
    print("=" * 60)
    print(f"\nConnessione a {DB_NAME}...")

    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=12000)
    db = client[DB_NAME]
    db.command("ping")
    print("  [OK] Connessione riuscita\n")

    now = datetime.now(timezone.utc).isoformat()
    created = 0
    skipped = 0

    for name, cognome, email, password, role, section in STAFF:
        label = f"{name} {cognome} <{email}> [{role}]"
        existing = db.users.find_one({"email": email.strip().lower()})
        if existing:
            print(f"  [SKIP]   {label} — già presente")
            skipped += 1
            continue

        user = {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": name,
            "cognome": cognome,
            "email": email.strip().lower(),
            "password": hash_pw(password),
            "role": role,
            "class_id": None,
            "child_id": None,
            "avatar_url": None,
            "active": True,
            "created_at": now,
        }
        db.users.insert_one(user)
        print(f"  [OK]     {label}")
        created += 1

    print(f"\n  Creati:  {created}")
    print(f"  Saltati: {skipped}")
    print("=" * 60)
    print("\n  Credenziali per il login:")
    print("  Email = quella indicata sopra")
    print("  Password = quella del file credenziali_staff.txt")
    print("  Login via: /api/auth/login (JWT fallback)\n")
    client.close()


if __name__ == "__main__":
    main()
