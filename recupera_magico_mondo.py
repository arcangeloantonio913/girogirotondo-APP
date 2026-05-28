#!/usr/bin/env python3
"""
RECUPERO DATI IL MAGICO MONDO
================================
Interroga Firebase Firestore e Firebase Auth per recuperare
tutti gli utenti (genitori, maestre, admin) della sede Il Magico Mondo
e ricostruisce lo script di ripristino.

Uso:
    pip3 install firebase-admin requests
    python3 recupera_magico_mondo.py

Output:
    - dati_magico_mondo.json  → dati grezzi recuperati
    - iscrivi_magico_mondo_RECUPERATO.py → script ripristino pronto
"""

import json, os, sys, time
from pathlib import Path
from dotenv import load_dotenv

# Carica credenziali dal .env del backend
env_path = Path(__file__).parent / "backend" / ".env"
load_dotenv(env_path)

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; B = "\033[94m"
BOLD = "\033[1m"; W = "\033[0m"

def sep(t): print(f"\n{BOLD}{B}{'═'*60}\n  {t}\n{'═'*60}{W}\n")

sep("RECUPERO DATI IL MAGICO MONDO — Firebase")

# ── Dipendenze ────────────────────────────────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials, firestore, auth as fb_auth
    print(f"{G}✅ firebase-admin disponibile{W}")
except ImportError:
    print(f"{R}❌ Installa: pip3 install firebase-admin{W}")
    sys.exit(1)

# ── Inizializza Firebase Admin SDK ────────────────────────────────────────────
sep("1. Connessione Firebase")

FIREBASE_PROJECT_ID    = os.environ.get("FIREBASE_PROJECT_ID", "")
FIREBASE_PRIVATE_KEY   = os.environ.get("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")
FIREBASE_CLIENT_EMAIL  = os.environ.get("FIREBASE_CLIENT_EMAIL", "")

if not all([FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL]):
    print(f"{R}❌ Credenziali Firebase mancanti nel .env{W}")
    sys.exit(1)

cred_dict = {
    "type": "service_account",
    "project_id": FIREBASE_PROJECT_ID,
    "private_key": FIREBASE_PRIVATE_KEY,
    "client_email": FIREBASE_CLIENT_EMAIL,
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
}

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    db  = firestore.client()
    print(f"{G}✅ Firebase Admin SDK inizializzato — Progetto: {FIREBASE_PROJECT_ID}{W}")
except Exception as e:
    print(f"{R}❌ Errore inizializzazione Firebase: {e}{W}")
    sys.exit(1)

# ── FONTE 1: Firebase Auth — lista tutti gli utenti ───────────────────────────
sep("2. Firebase Auth — tutti gli utenti registrati")

auth_users = []
try:
    page = fb_auth.list_users()
    while page:
        for user in page.users:
            auth_users.append({
                "uid":          user.uid,
                "email":        user.email or "",
                "display_name": user.display_name or "",
                "created_at":   str(user.user_metadata.creation_timestamp),
                "last_login":   str(user.user_metadata.last_sign_in_timestamp),
            })
        page = page.get_next_page()
    print(f"{G}✅ Firebase Auth: {len(auth_users)} utenti totali trovati{W}")
except Exception as e:
    print(f"{Y}⚠️  Firebase Auth non accessibile: {e}{W}")

# ── FONTE 2: Firestore — collezione 'users' ───────────────────────────────────
sep("3. Firestore — profili utente")

fs_users = []
fs_mm_users = []

try:
    # Tutti gli utenti in Firestore
    docs = db.collection("users").get()
    for doc in docs:
        data = doc.to_dict()
        data["_firestore_id"] = doc.id
        fs_users.append(data)

    print(f"{G}✅ Firestore 'users': {len(fs_users)} documenti totali{W}")

    # Filtra Il Magico Mondo
    mm_keywords = ["magico", "il-magico-mondo", "il_magico_mondo", "magico-mondo"]
    for u in fs_users:
        sede = str(u.get("sede_id") or u.get("sede") or "").lower()
        role = u.get("role", "")
        if any(kw in sede for kw in mm_keywords):
            fs_mm_users.append(u)
            icon = "👤" if role == "parent" else "👩‍🏫" if role == "teacher" else "🔑"
            print(f"  {icon} {u.get('name','?')} {u.get('cognome','')} "
                  f"<{u.get('email','?')}> [{role}]")

    if not fs_mm_users:
        print(f"{Y}  ⚠️  Nessun utente MM trovato in Firestore con sede_id{W}")
        # Prova anche senza sede_id — guarda per email note maestre MM
        mm_emails = [
            "gabri.franco@hotmail.it",
            "claudiapizzo29@outlook.it",
            "tatianacardinale@icloud.com",
        ]
        for u in fs_users:
            if u.get("email", "").lower() in mm_emails:
                fs_mm_users.append(u)
                print(f"  {G}✅ Trovata maestra MM: {u.get('name')} <{u.get('email')}>{W}")

except Exception as e:
    print(f"{Y}⚠️  Firestore 'users' non accessibile: {e}{W}")

# ── FONTE 3: Firestore — collezione 'students' ────────────────────────────────
sep("4. Firestore — studenti")

fs_students = []
fs_mm_students = []

try:
    docs = db.collection("students").get()
    for doc in docs:
        data = doc.to_dict()
        data["_firestore_id"] = doc.id
        fs_students.append(data)
    print(f"{G}✅ Firestore 'students': {len(fs_students)} studenti totali{W}")

    # Cerca studenti MM per class_id o sede_id
    # Prima recuperiamo le classi MM da MongoDB tramite API
    import urllib.request
    try:
        req = urllib.request.Request(
            "https://girogirotondo-app-production.up.railway.app/api/classes",
            headers={"X-Sede-Id": "il-magico-mondo",
                     "Content-Type": "application/json",
                     "User-Agent": "recupero-mm/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            classes_mm = json.loads(r.read())
            mm_class_ids = {c["id"] for c in classes_mm}
            print(f"  Classi MM trovate: {[c['name'] for c in classes_mm]}")
    except Exception as ce:
        print(f"  {Y}⚠️  Impossibile caricare classi MM dal backend: {ce}{W}")
        mm_class_ids = set()

    for s in fs_students:
        class_id = s.get("class_id", "")
        sede = str(s.get("sede_id") or "").lower()
        if class_id in mm_class_ids or "magico" in sede:
            fs_mm_students.append(s)
            print(f"  👶 {s.get('name','?')} {s.get('cognome','')} "
                  f"— classe: {s.get('class_id','?')[:8]}...")

    if not fs_mm_students:
        print(f"{Y}  ⚠️  Nessuno studente MM trovato in Firestore{W}")

except Exception as e:
    print(f"{Y}⚠️  Firestore 'students' non accessibile: {e}{W}")

# ── FONTE 4: Resend API — email inviate ───────────────────────────────────────
sep("5. Resend API — email di iscrizione inviate")

resend_recipients = []
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

if not RESEND_API_KEY:
    # Prova a cercarlo nelle variabili Railway (non nel .env locale)
    print(f"{Y}⚠️  RESEND_API_KEY non nel .env locale.{W}")
    print(f"    Inserisci il valore di RESEND_API_KEY da Railway Variables:")
    rkey = input("    RESEND_API_KEY (premi Invio per saltare): ").strip()
    if rkey:
        RESEND_API_KEY = rkey

if RESEND_API_KEY:
    try:
        import urllib.request
        # Resend API — lista email inviate
        page = 0
        while page < 10:  # max 10 pagine × 100 = 1000 email
            req = urllib.request.Request(
                f"https://api.resend.com/emails?limit=100&page={page}",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}",
                         "Content-Type": "application/json"}
            )
            try:
                with urllib.request.urlopen(req, timeout=15) as r:
                    data = json.loads(r.read())
                    emails = data.get("data", [])
                    if not emails:
                        break
                    for email in emails:
                        to = email.get("to", [])
                        subject = email.get("subject", "")
                        created = email.get("created_at", "")
                        # Filtra email di benvenuto scuola
                        if any(kw in subject.lower() for kw in ["benvenuto", "credenziali", "girogirotondo", "magico"]):
                            for recipient in to:
                                resend_recipients.append({
                                    "email": recipient,
                                    "subject": subject,
                                    "date": created,
                                })
                    page += 1
                    time.sleep(0.3)
            except Exception as pe:
                print(f"  Pagina {page}: {pe}")
                break

        print(f"{G}✅ Resend: {len(resend_recipients)} email di iscrizione trovate{W}")
        for r in resend_recipients[:10]:
            print(f"  📧 {r['email']} — {r['subject'][:40]} ({r['date'][:10]})")
        if len(resend_recipients) > 10:
            print(f"  ... e altri {len(resend_recipients)-10}")

    except Exception as e:
        print(f"{Y}⚠️  Resend API: {e}{W}")

# ── RIEPILOGO E SALVATAGGIO ───────────────────────────────────────────────────
sep("6. Riepilogo e salvataggio dati")

result = {
    "firebase_auth_total":   len(auth_users),
    "firestore_users_mm":    fs_mm_users,
    "firestore_students_mm": fs_mm_students,
    "resend_recipients":     resend_recipients,
    "firebase_auth_users":   auth_users,  # tutti, per ricerca manuale
}

output_file = Path(__file__).parent / "dati_magico_mondo.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"{G}✅ Dati salvati: {output_file}{W}")
print(f"""
Trovati:
  • Utenti MM in Firestore: {len(fs_mm_users)}
  • Studenti MM in Firestore: {len(fs_mm_students)}
  • Email Resend: {len(resend_recipients)}
  • Tutti gli utenti Firebase Auth: {len(auth_users)}
""")

# ── GENERA SCRIPT RIPRISTINO ──────────────────────────────────────────────────
sep("7. Generazione script di ripristino")

if fs_mm_students:
    # Raggruppa per classe
    by_class: dict = {}
    for s in fs_mm_students:
        cid = s.get("class_id", "UNKNOWN")
        if cid not in by_class:
            by_class[cid] = []
        # Trova genitore
        parent_email = ""
        parent_name  = ""
        for u in fs_mm_users:
            if u.get("role") == "parent":
                child_ids = u.get("child_ids") or ([u.get("child_id")] if u.get("child_id") else [])
                if s.get("id") in child_ids or s.get("_firestore_id") in child_ids:
                    parent_email = u.get("email", "")
                    parent_name  = f"{u.get('name','')} {u.get('cognome','')}".strip()
                    break
        by_class[cid].append({
            "nome":    s.get("name", ""),
            "cognome": s.get("cognome", ""),
            "email":   parent_email,
            "genitore": parent_name,
        })

    script_lines = ['#!/usr/bin/env python3', '"""']
    script_lines.append(f'Script generato automaticamente da recupera_magico_mondo.py')
    script_lines.append(f'Contiene {len(fs_mm_students)} studenti recuperati da Firestore')
    script_lines.append('"""')
    script_lines.append('import requests, time, sys')
    script_lines.append('')
    script_lines.append('BASE = "https://girogirotondo-app-production.up.railway.app/api"')
    script_lines.append('SEDE = "il-magico-mondo"')
    script_lines.append('')
    script_lines.append('r = requests.post(f"{BASE}/auth/login",')
    script_lines.append('    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},')
    script_lines.append('    headers={"X-Sede-Id": SEDE})')
    script_lines.append('TOKEN = r.json().get("token") or r.json().get("access_token")')
    script_lines.append('if not TOKEN: print("Login fallito:", r.json()); sys.exit(1)')
    script_lines.append('H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}')
    script_lines.append('')

    for cid, students in by_class.items():
        script_lines.append(f'# Classe: {cid}')
        script_lines.append(f'STUDENTI_{cid[:8].upper()} = [')
        for s in students:
            script_lines.append(f'    ("{s["nome"]}", "{s["cognome"]}", '
                                f'"{s["email"]}", "{s["genitore"]}"),')
        script_lines.append(']')
        script_lines.append('')

    script_file = Path(__file__).parent / "iscrivi_magico_mondo_RECUPERATO.py"
    with open(script_file, "w", encoding="utf-8") as f:
        f.write("\n".join(script_lines))
    print(f"{G}✅ Script generato: {script_file}{W}")
else:
    print(f"{Y}⚠️  Nessuno studente MM trovato in Firestore.{W}")
    print(f"    Apri dati_magico_mondo.json per analisi manuale.")
    print(f"    Controlla anche firebase_auth_users per email delle famiglie.")

print(f"""
{BOLD}PROSSIMI PASSI:{W}
1. Apri dati_magico_mondo.json e cerca manualmente le famiglie MM
2. Cerca in firebase_auth_users utenti con email che riconosci come MM
3. Compila iscrivi_magico_mondo.py con i dati trovati
4. Esegui: python3 iscrivi_magico_mondo.py

{B}Oppure:{W}
Controlla il tab "Backups" su MongoDB-qPD4 in Railway — se c'è un backup
automatico, i dati si ripristinano con un click.
""")
