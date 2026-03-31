"""
seed_users.py — Importa tutto lo staff di Girogirotondo e Il Magico Mondo.

Connessione diretta a MongoDB Atlas (bypassa le API e Firebase).
Compatibile con la modalità DEV_MODE (legacy JWT) e Firebase Auth.

Uso:
    pip install pymongo bcrypt dnspython
    python3 backend/scripts/seed_users.py
"""

import os
import sys
import uuid
import random
import string
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# Carica .env dal backend
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Controllo dipendenze
missing = []
try:
    import pymongo
    from pymongo import MongoClient
except ImportError:
    missing.append("pymongo")

try:
    import bcrypt
except ImportError:
    missing.append("bcrypt")

if missing:
    print(f"Installa: pip install {' '.join(missing)} dnspython")
    sys.exit(1)

MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME   = os.environ.get("DB_NAME", "girogirotondo")
CREDENTIALS_FILE = Path(__file__).parent / "credenziali_staff.txt"

if not MONGO_URL:
    print("ERRORE: MONGO_URL non trovato nel .env")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Sezioni
# ---------------------------------------------------------------------------
CLASSES = [
    # Girogirotondo
    {"name": "Nido Pesciolini",           "school": "Girogirotondo"},
    {"name": "Nido Tigrotti",             "school": "Girogirotondo"},
    {"name": "Primavera Pulcini",         "school": "Girogirotondo"},
    {"name": "Primavera Colorandia",      "school": "Girogirotondo"},
    {"name": "I Infanzia Girogirotondo",  "school": "Girogirotondo"},
    {"name": "II Infanzia Girogirotondo", "school": "Girogirotondo"},
    # Il Magico Mondo
    {"name": "Nido Il Magico Mondo",                      "school": "Il Magico Mondo"},
    {"name": "Primavera Giardino delle Meraviglie",       "school": "Il Magico Mondo"},
    {"name": "Primavera Oceano Incantato",                "school": "Il Magico Mondo"},
    {"name": "I Infanzia Il Magico Mondo",                "school": "Il Magico Mondo"},
    {"name": "II Infanzia Il Magico Mondo",               "school": "Il Magico Mondo"},
]

# (nome, cognome, email, ruolo, sezione_o_None)
STAFF = [
    # Direzione Girogirotondo
    ("Teresa",       "Melignano",  "melignanoTeresa@gmail.com",          "admin",   None),
    ("Giovanna",     "Melignano",  "giovannaMelignano@gmail.com",         "admin",   None),
    # Direzione Il Magico Mondo
    ("Maria Grazia", "Schiera",    "mariucciasc@gmail.com",               "admin",   None),
    # Maestre Girogirotondo
    ("Giorgia",      "Greco",      "giorgia.greco1495@gmail.com",         "teacher", "Nido Pesciolini"),
    ("Marika",       "Russo",      "graziamaruikarusso@gmail.com",        "teacher", "Nido Tigrotti"),
    ("Chiara",       "Lionetti",   "chiaralionetti98@gmail.com",          "teacher", "Primavera Pulcini"),
    ("Rachele",      "Impastato",  "rachele.impastato@gmail.com",         "teacher", "Primavera Colorandia"),
    ("Loredana",     "Pillitteri", "loredana.pillitteri@hotmail.it",      "teacher", "I Infanzia Girogirotondo"),
    ("Elisabetta",   "Saitta",     "saitta.es@libero.it",                 "teacher", "I Infanzia Girogirotondo"),
    ("Sefora",       "Caruso",     "seficar@hotmail.it",                  "teacher", "II Infanzia Girogirotondo"),
    ("Marzia",       "Barone",     "marziabarone34@gmail.com",            "teacher", "II Infanzia Girogirotondo"),
    # Maestre Il Magico Mondo
    ("Gabriella",    "Franco",     "gabri.franco@hotmail.it",             "teacher", "Nido Il Magico Mondo"),
    ("Claudia",      "Pizzo",      "claudiapizzo29@outlook.it",           "teacher", "Primavera Giardino delle Meraviglie"),
    ("Tatiana",      "Cardinale",  "tatianacardinale@icloud.com",         "teacher", "Primavera Oceano Incantato"),
]


def gen_password(cognome: str) -> str:
    base = cognome[:4].capitalize()
    digits = "".join(random.choices(string.digits, k=4))
    return base + digits


def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def main():
    print("=" * 65)
    print("  SEED STAFF — connessione diretta MongoDB Atlas")
    print("=" * 65)

    print(f"\nConnessione a MongoDB ({DB_NAME})...")
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]
    # Verifica connessione
    db.command("ping")
    print("  [OK] Connessione riuscita")

    # ----------------------------------------------------------------
    # PASSO 1 — Sezioni
    # ----------------------------------------------------------------
    print("\n[1/3] Gestione sezioni...")
    class_map = {}

    # Recupera sezioni già esistenti
    for c in db.classes.find({}, {"_id": 0, "id": 1, "name": 1}):
        class_map[c["name"]] = c["id"]

    created_classes = 0
    for cls in CLASSES:
        name = cls["name"]
        if name in class_map:
            print(f"  [SKIP] {name}")
            continue
        new_id = str(uuid.uuid4())
        db.classes.insert_one({
            "id": new_id,
            "name": name,
            "school": cls["school"],
            "teacher_id": None,
        })
        class_map[name] = new_id
        print(f"  [OK]   {name}")
        created_classes += 1

    # ----------------------------------------------------------------
    # PASSO 2 — Utenti staff
    # ----------------------------------------------------------------
    print(f"\n[2/3] Registrazione {len(STAFF)} utenti staff...")
    now = datetime.now(timezone.utc).isoformat()
    credentials = []
    created_users = 0
    skipped_users = 0

    for name, cognome, email, role, section in STAFF:
        password = gen_password(cognome)
        class_id = class_map.get(section) if section else None
        label = f"{name} {cognome} ({role})" + (f" → {section}" if section else "")

        # Controlla se esiste già
        existing = db.users.find_one({"email": email})
        if existing:
            print(f"  [SKIP] {label} — email già presente")
            skipped_users += 1
            # Recupera la password: non possiamo, la salviamo come "esistente"
            credentials.append((f"{name} {cognome}", email, "già registrato", role, section or "—"))
            continue

        user = {
            "id": str(uuid.uuid4()),
            "firebase_uid": None,
            "name": name,
            "cognome": cognome,
            "email": email,
            "password": hash_pw(password),
            "role": role,
            "class_id": class_id,
            "child_id": None,
            "avatar_url": None,
            "active": True,
            "created_at": now,
        }
        db.users.insert_one(user)
        created_users += 1
        print(f"  [OK]   {label}")
        credentials.append((f"{name} {cognome}", email, password, role, section or "—"))

    # ----------------------------------------------------------------
    # PASSO 3 — Salva credenziali
    # ----------------------------------------------------------------
    print(f"\n[3/3] Salvataggio credenziali...")
    lines = [
        "CREDENZIALI STAFF — Girogirotondo App",
        "=" * 70,
        "Consegnare personalmente a ciascun utente.",
        "Chiedere cambio password al primo accesso.",
        "NOTA: Gli utenti 'già registrato' hanno una password preesistente.",
        "",
        f"{'NOME':<25} {'EMAIL':<45} {'PASSWORD':<15} {'RUOLO':<10} SEZIONE",
        "-" * 120,
    ]
    for full_name, email, pwd, role, section in credentials:
        lines.append(f"{full_name:<25} {email:<45} {pwd:<15} {role:<10} {section}")

    CREDENTIALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    CREDENTIALS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  Salvato: {CREDENTIALS_FILE}")

    print(f"\n{'=' * 65}")
    print(f"  Nuovi utenti creati: {created_users}")
    print(f"  Utenti già presenti: {skipped_users}")
    print(f"  Nuove sezioni:       {created_classes}")
    print(f"  Totale sezioni:      {len(class_map)}")
    print()
    print("  ATTENZIONE: questi utenti usano solo bcrypt (legacy JWT).")
    print("  Per il login, imposta DEV_MODE=true su Railway oppure")
    print("  configura correttamente le variabili FIREBASE_* su Railway.")
    print("=" * 65)

    client.close()


if __name__ == "__main__":
    main()
