"""
seed_staff_reali.py
Inserisce gli account staff leggendo le password da un file ESTERNO non versionato
(nessuna password in chiaro nel sorgente). Usa bcrypt su MongoDB (bypass Firebase).

File credenziali (NON versionare): una riga per account, formato
    email,password
Percorso di default: backend/credenziali_staff.csv  (sovrascrivibile con
la env STAFF_CREDENTIALS_FILE o come 2° argomento).

Uso:
    cd girogirotondo-APP
    # con MONGO_URL dal .env e file credenziali di default:
    python3 backend/scripts/seed_staff_reali.py
    # oppure passando URL Mongo e file credenziali:
    python3 backend/scripts/seed_staff_reali.py "mongodb+srv://..." ./backend/credenziali_staff.csv
"""

import os
import sys
import csv
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

try:
    import pymongo  # noqa: F401
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

# File credenziali esterno (NON versionato) — 2° argomento, env, o default
CRED_FILE = (
    sys.argv[2] if len(sys.argv) > 2
    else os.environ.get("STAFF_CREDENTIALS_FILE", str(Path(__file__).parent.parent / "credenziali_staff.csv"))
)

if not MONGO_URL:
    print("ERRORE: fornisci MONGO_URL nel .env o come argomento.")
    sys.exit(1)

# ────────────────────────────────────────────────────
# Anagrafica staff SENZA password (i segreti stanno nel file esterno).
# (nome, cognome, email, ruolo, sezione)
# ────────────────────────────────────────────────────
STAFF = [
    # Admin / Direzione
    ("Teresa",       "Melignano",  "melignanoTeresa@gmail.com",     "admin",   None),
    ("Giovanna",     "Melignano",  "giovannaMelignano@gmail.com",   "admin",   None),
    ("Maria Grazia", "Schiera",    "mariucciasc@gmail.com",         "admin",   None),
    # Maestre
    ("Giorgia",      "Greco",      "giorgia.greco1495@gmail.com",   "teacher", None),
    ("Marika",       "Russo",      "graziamaruikarusso@gmail.com",  "teacher", None),
    ("Chiara",       "Lionetti",   "chiaralionetti98@gmail.com",    "teacher", None),
    ("Rachele",      "Impastato",  "rachele.impastato@gmail.com",   "teacher", None),
    ("Loredana",     "Pillitteri", "loredana.pillitteri@hotmail.it","teacher", None),
    ("Elisabetta",   "Saitta",     "saitta.es@libero.it",           "teacher", None),
    ("Sefora",       "Caruso",     "seficar@hotmail.it",            "teacher", None),
    ("Marzia",       "Barone",     "marziabarone34@gmail.com",      "teacher", None),
    ("Gabriella",    "Franco",     "gabri.franco@hotmail.it",       "teacher", None),
    ("Claudia",      "Pizzo",      "claudiapizzo29@outlook.it",     "teacher", None),
    ("Tatiana",      "Cardinale",  "tatianacardinale@icloud.com",   "teacher", None),
]


def load_passwords(path: str) -> dict:
    """Legge email,password dal file esterno (una coppia per riga)."""
    p = Path(path)
    if not p.exists():
        print(f"ERRORE: file credenziali non trovato: {path}")
        print("Crea un CSV 'email,password' (NON versionarlo) e riprova.")
        sys.exit(1)
    creds = {}
    with p.open(newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) >= 2 and row[0].strip():
                creds[row[0].strip().lower()] = row[1].strip()
    return creds


def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def main():
    print("=" * 60)
    print("  SEED STAFF — password da file esterno (non in codice)")
    print("=" * 60)
    passwords = load_passwords(CRED_FILE)
    print(f"\nConnessione a {DB_NAME}...")

    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=12000)
    db = client[DB_NAME]
    db.command("ping")
    print("  [OK] Connessione riuscita\n")

    now = datetime.now(timezone.utc).isoformat()
    created = 0
    skipped = 0

    for name, cognome, email, role, section in STAFF:
        label = f"{name} {cognome} <{email}> [{role}]"
        key = email.strip().lower()
        existing = db.users.find_one({"email": key})
        if existing:
            print(f"  [SKIP]   {label} — già presente")
            skipped += 1
            continue
        password = passwords.get(key)
        if not password:
            print(f"  [MANCA PW] {label} — nessuna password nel file credenziali, salto")
            skipped += 1
            continue

        user = {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": name,
            "cognome": cognome,
            "email": key,
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
    client.close()


if __name__ == "__main__":
    main()
