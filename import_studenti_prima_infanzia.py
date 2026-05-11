#!/usr/bin/env python3
"""
import_studenti_prima_infanzia.py
──────────────────────────────────
Crea la classe "II Infanzia" in Girogirotondo (se non esiste)
e importa gli studenti della Sezione II Infanzia dalle foto.

Esegui:  python3 import_studenti_prima_infanzia.py
         python3 import_studenti_prima_infanzia.py --dry-run
"""
import urllib.request, urllib.error, json, sys

DRY_RUN  = "--dry-run" in sys.argv
BASE     = "https://girogirotondo-app-production.up.railway.app/api"
SEDE_GGT = "girogirotondo"
NOME_CLASSE = "II Infanzia"   # nome della nuova classe da creare

CREDS = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

# ── Studenti dalle foto ───────────────────────────────────────────────────────
# Sezione: SEZIONE II INFANZIA — Girogirotondo
# Barrati (Johan Fusco / Di Maggio Jessica) ESCLUSI
STUDENTI = [
    {"bambino": "Alejandro Corrao",    "genitore": "Alexandra Giacalone",  "email": "alexandra_17@live.it"},
    {"bambino": "Natalia Gradino",     "genitore": "Frontini Chiara",      "email": "gradinoalessandro@gmail.com"},
    {"bambino": "Natan Ricchiari",     "genitore": "Croce Debora",         "email": "crocedebora1@gmail.com"},
    {"bambino": "Ambra Costantino",    "genitore": "Pistone Giulia",       "email": "giuliapistone52@gmail.com"},
    {"bambino": "Ginevra Fricano",     "genitore": "Giorlando Gaia",       "email": "gagiorlando@gmail.com"},
    {"bambino": "Ludovica Di Liberto", "genitore": "Giambona Francesca",   "email": "giambona-francesca@libero.it"},
    {"bambino": "Noemi Macaluso",      "genitore": "Li Mandri Marzia",     "email": "devidbmw.dm@gmail.com"},
    {"bambino": "Celeste Cammarata",   "genitore": "Lo Cascio Dalila",     "email": "dalilalocascio@yahoo.it"},
    {"bambino": "Gioele Macchiarella", "genitore": "Ingraffia Rosalia",    "email": "rosalaing89@libero.it"},
    {"bambino": "Rebecca Gennaro",     "genitore": "Di Maggio Roberta",    "email": None},  # no email in foto
    {"bambino": "Noemi Fecarotta",     "genitore": "Pisani Alessandra",    "email": "alessandrapisani@outlook.com"},
    {"bambino": "Isabella Pantaleo",   "genitore": "Schiopu Mihaela",      "email": "roberto@islafood.it"},
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; W="\033[0m"; BOLD="\033[1m"

def req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-import/1.0"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    if sede:  hdrs["X-Sede-Id"] = sede
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if not silent: print(f"  {R}HTTP {e.code}: {msg}{W}")
        return {"__error__": True, "detail": msg}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}{'═'*65}{W}")
print(f"{BOLD}  IMPORT SEZIONE II INFANZIA — GIROGIROTONDO{' [DRY-RUN]' if DRY_RUN else ''}{W}")
print(f"{BOLD}{'═'*65}{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── STEP 1: verifica / crea la classe "II Infanzia" ──────────────────────────
print(f"\n{BOLD}STEP 1 — Verifica classe '{NOME_CLASSE}' in Girogirotondo{W}")
classes = req("GET", "/classes", token, sede=SEDE_GGT)
print(f"  Classi esistenti: {[c.get('name') for c in classes]}")

classe = next((c for c in classes if c.get("name","").lower() == NOME_CLASSE.lower()), None)

if classe:
    print(f"  {G}✅ Classe '{NOME_CLASSE}' già esistente (id: {classe['id']}){W}")
else:
    print(f"  {Y}⚠️  Classe '{NOME_CLASSE}' non trovata — verrà creata{W}")
    if not DRY_RUN:
        res = req("POST", "/classes", token, {"name": NOME_CLASSE, "teacher_id": None}, sede=SEDE_GGT)
        if res.get("__error__"):
            print(f"  {R}🔴 Creazione classe fallita: {res.get('detail')}{W}")
            sys.exit(1)
        classe = res
        print(f"  {G}✅ Classe '{NOME_CLASSE}' creata (id: {classe['id']}){W}")
    else:
        print(f"  {Y}  [DRY-RUN] Avrebbe creato la classe '{NOME_CLASSE}'{W}")
        classe = {"id": "DRY-RUN-ID", "name": NOME_CLASSE}

CLASS_ID = classe["id"]

# ── STEP 2: controlla duplicati ───────────────────────────────────────────────
print(f"\n{BOLD}STEP 2 — Verifica duplicati in Girogirotondo{W}")
existing_students = req("GET", "/students", token, sede=SEDE_GGT)
existing_names    = {f"{s.get('name','')} {s.get('cognome','')}".strip().lower() for s in existing_students}
existing_users    = req("GET", "/users",    token, sede=SEDE_GGT)
existing_emails   = {u.get("email","").lower() for u in existing_users if u.get("email")}
print(f"  {len(existing_students)} studenti e {len(existing_users)} utenti già presenti in GGT")

# ── STEP 3: import ────────────────────────────────────────────────────────────
print(f"\n{BOLD}STEP 3 — Import studenti{W}")
print(f"  {'Bambino':<25} {'Genitore':<28} {'Email':<35} Stato")
print(f"  {'─'*25} {'─'*28} {'─'*35} {'─'*20}")

imported = skipped = errors = 0

for row in STUDENTI:
    bambino  = row["bambino"]
    genitore = row["genitore"]
    email    = row["email"]
    parts    = bambino.split(" ", 1)
    nome     = parts[0]
    cognome  = parts[1] if len(parts) > 1 else ""

    # Controlla duplicati
    if bambino.lower() in existing_names:
        print(f"  {Y}⚠️  {bambino:<25} {genitore:<28} {'—':<35} già presente, skip{W}")
        skipped += 1
        continue

    if email and email.lower() in existing_emails:
        print(f"  {Y}⚠️  {bambino:<25} {genitore:<28} {email:<35} email in uso, skip{W}")
        skipped += 1
        continue

    if not email:
        print(f"  {Y}⚠️  {bambino:<25} {genitore:<28} {'(no email)':<35} inserire manualmente{W}")
        skipped += 1
        continue

    if DRY_RUN:
        print(f"  {G}[DRY] {bambino:<23} {genitore:<28} {email:<35} OK → classe {NOME_CLASSE}{W}")
        imported += 1
        continue

    payload = {
        "bambino_nome":         nome,
        "bambino_cognome":      cognome,
        "bambino_data_nascita": "",
        "class_id":             CLASS_ID,
        "sede_id":              SEDE_GGT,
        "genitore_email":       email,
        "genitore_nome":        genitore,
        "genitore_password":    None,
    }
    res = req("POST", "/users/iscrizione", token, payload, sede=SEDE_GGT)
    if res.get("__error__"):
        print(f"  {R}🔴  {bambino:<25} {genitore:<28} {email:<35} {res.get('detail','errore')}{W}")
        errors += 1
    else:
        flag = "📧 email inviata" if res.get("email_inviata") else "📧 no email (consegna manuale)"
        print(f"  {G}✅  {bambino:<25} {genitore:<28} {email:<35} {flag}{W}")
        imported += 1

# ── RIEPILOGO ─────────────────────────────────────────────────────────────────
print(f"\n{'─'*105}")
print(f"  Importati: {G}{imported}{W}  |  Saltati: {Y}{skipped}{W}  |  Errori: {R}{errors}{W}")
if DRY_RUN:
    print(f"\n  {Y}[DRY-RUN] Nessuna modifica effettuata. Esegui senza --dry-run per importare.{W}")
else:
    print(f"\n  {Y}⚠️  Rebecca Gennaro (Di Maggio Roberta) non ha email — inserirla manualmente dal pannello admin.{W}")
print()
