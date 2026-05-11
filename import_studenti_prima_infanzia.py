#!/usr/bin/env python3
"""
import_studenti_prima_infanzia.py
──────────────────────────────────
Importa gli studenti della Sezione II Infanzia
di Girogirotondo — dati letti dalle foto allegate.

Esegui:  python3 import_studenti_prima_infanzia.py
         python3 import_studenti_prima_infanzia.py --dry-run
"""
import urllib.request, urllib.error, json, sys

DRY_RUN = "--dry-run" in sys.argv
BASE    = "https://girogirotondo-app-production.up.railway.app/api"
CREDS   = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]
SEDE_GGT = "girogirotondo"

# ── Dati letti dalle foto ────────────────────────────────────────────────────
# Classe: Sezione II Infanzia = Prima Infanzia, Il Magico Mondo
# Righe barrate (Johan Fusco / Di Maggio Jessica) ESCLUSE
STUDENTI = [
    {"bambino": "Alejandro Corrao",       "genitore": "Alexandra Giacalone",   "email": "alexandra_17@live.it"},
    {"bambino": "Natalia Gradino",         "genitore": "Frontini Chiara",       "email": "gradinoalessandro@gmail.com"},
    {"bambino": "Natan Ricchiari",         "genitore": "Croce Debora",          "email": "crocedebora1@gmail.com"},
    {"bambino": "Ambra Costantino",        "genitore": "Pistone Giulia",        "email": "giuliapistone52@gmail.com"},
    {"bambino": "Ginevra Fricano",         "genitore": "Giorlando Gaia",        "email": "gagiorlando@gmail.com"},
    {"bambino": "Ludovica Di Liberto",     "genitore": "Giambona Francesca",    "email": "giambona-francesca@libero.it"},
    {"bambino": "Noemi Macaluso",          "genitore": "Li Mandri Marzia",      "email": "devidbmw.dm@gmail.com"},
    {"bambino": "Celeste Cammarata",       "genitore": "Lo Cascio Dalila",      "email": "dalilalocascio@yahoo.it"},
    {"bambino": "Gioele Macchiarella",     "genitore": "Ingraffia Rosalia",     "email": "rosalaing89@libero.it"},
    {"bambino": "Rebecca Gennaro",         "genitore": "Di Maggio Roberta",     "email": None},  # email non visibile in foto
    {"bambino": "Noemi Fecarotta",         "genitore": "Pisani Alessandra",     "email": "alessandrapisani@outlook.com"},
    {"bambino": "Isabella Pantaleo",       "genitore": "Schiopu Mihaela",       "email": "roberto@islafood.it"},
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
print(f"\n{BOLD}═══════════════════════════════════════════════════════════════{W}")
print(f"{BOLD}  IMPORT STUDENTI — PRIMA INFANZIA, IL MAGICO MONDO{' [DRY-RUN]' if DRY_RUN else ''}{W}")
print(f"{BOLD}═══════════════════════════════════════════════════════════════{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── Trova la classe Girogirotondo (mostra elenco per scelta) ─────────────────
classes = req("GET", "/classes", token, sede=SEDE_GGT)
print(f"\nClassi disponibili in Girogirotondo:")
for i, c in enumerate(classes):
    n_s = sum(1 for s in req("GET", "/students", token, sede=SEDE_GGT) if s.get("class_id") == c["id"]) if i == 0 else "?"
    print(f"  {i+1}. {c.get('name')} (id: {c['id']})")

class_name_input = input("\nInserisci il NOME ESATTO della classe (es. I Infanzia): ").strip()
prima = next((c for c in classes if c.get("name","").lower() == class_name_input.lower()), None)
if not prima:
    # Ricerca parziale
    prima = next((c for c in classes if class_name_input.lower() in c.get("name","").lower()), None)
if not prima:
    print(f"{R}Classe '{class_name_input}' non trovata.{W}")
    print("Classi disponibili:", [c.get("name") for c in classes])
    sys.exit(1)

CLASS_ID = prima["id"]
print(f"📋 Classe: {prima['name']} (id: {CLASS_ID})\n")

# ── Fetch studenti esistenti (per evitare duplicati) ──────────────────────────
existing_students = req("GET", "/students", token, sede=SEDE_GGT)
existing_names    = {f"{s.get('name','')} {s.get('cognome','')}".strip().lower() for s in existing_students}
existing_emails   = req("GET", "/users", token, sede=SEDE_GGT)
existing_email_set= {u.get("email","").lower() for u in existing_emails if u.get("email")}

# ── IMPORT ────────────────────────────────────────────────────────────────────
print(f"{'Bambino':<28} {'Genitore':<28} {'Email':<35} Risultato")
print("─" * 105)

imported = skipped = errors = 0

for row in STUDENTI:
    bambino   = row["bambino"]
    genitore  = row["genitore"]
    email     = row["email"]
    nome_parts = bambino.split(" ", 1)
    nome      = nome_parts[0]
    cognome   = nome_parts[1] if len(nome_parts) > 1 else ""

    # Controlla se già esiste
    if bambino.lower() in existing_names:
        print(f"  {Y}⚠️  {bambino:<26} {genitore:<28} {email or '(no email)':<35} GIÀ PRESENTE — skip{W}")
        skipped += 1
        continue

    if email and email.lower() in existing_email_set:
        print(f"  {Y}⚠️  {bambino:<26} {genitore:<28} {email:<35} EMAIL GIÀ IN USO — skip{W}")
        skipped += 1
        continue

    if not email:
        print(f"  {Y}⚠️  {bambino:<26} {genitore:<28} {'(no email)':<35} NESSUNA EMAIL — skip manuale{W}")
        skipped += 1
        continue

    payload = {
        "bambino_nome":          nome,
        "bambino_cognome":       cognome,
        "bambino_data_nascita":  "",
        "class_id":              CLASS_ID,
        "sede_id":               SEDE_GGT,
        "genitore_email":        email,
        "genitore_nome":         genitore,
        "genitore_password":     None,  # auto-generata
    }

    if DRY_RUN:
        print(f"  {G}[DRY] {bambino:<24} {genitore:<28} {email:<35} OK{W}")
        imported += 1
        continue

    res = req("POST", "/users/iscrizione", token, payload, sede=SEDE_GGT)
    if res.get("__error__"):
        print(f"  {R}🔴  {bambino:<24} {genitore:<28} {email:<35} ERRORE: {res.get('detail','?')}{W}")
        errors += 1
    else:
        email_ok = res.get("email_inviata", False)
        pwd      = res.get("genitore_password") or "(non restituita)"
        flag     = f"{'📧 email inviata' if email_ok else '📧 nessuna email'}"
        print(f"  {G}✅  {bambino:<24} {genitore:<28} {email:<35} {flag}{W}")
        imported += 1

print(f"\n{'─'*105}")
print(f"  Importati: {G}{imported}{W}  |  Saltati: {Y}{skipped}{W}  |  Errori: {R}{errors}{W}")
if DRY_RUN:
    print(f"\n  {Y}[DRY-RUN] Nessuna modifica effettuata. Rimuovi --dry-run per importare.{W}")
print()
