#!/usr/bin/env python3
"""
invia_credenziali_ii_infanzia.py
─────────────────────────────────
Invia le credenziali di accesso ai genitori della classe II Infanzia
che non hanno ancora ricevuto l'email (cerca direttamente per email).

Esegui:  python3 invia_credenziali_ii_infanzia.py
"""
import urllib.request, urllib.error, json, sys

BASE  = "https://girogirotondo-app-production.up.railway.app/api"
CREDS_ADMIN = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

# Email genitori dalla foto — chi non ha email viene saltato
GENITORI = [
    {"bambino": "Alejandro Corrao",    "genitore": "Alexandra Giacalone",  "email": "alexandra_17@live.it"},
    {"bambino": "Natalia Gradino",     "genitore": "Frontini Chiara",      "email": "gradinoalessandro@gmail.com"},
    {"bambino": "Natan Ricchiari",     "genitore": "Croce Debora",         "email": "crocedebora1@gmail.com"},
    {"bambino": "Ambra Costantino",    "genitore": "Pistone Giulia",       "email": "giuliapistone52@gmail.com"},
    {"bambino": "Ginevra Fricano",     "genitore": "Giorlando Gaia",       "email": "gagiorlando@gmail.com"},
    {"bambino": "Ludovica Di Liberto", "genitore": "Giambona Francesca",   "email": "giambona-francesca@libero.it"},
    {"bambino": "Noemi Macaluso",      "genitore": "Li Mandri Marzia",     "email": "devidbmw.dm@gmail.com"},
    {"bambino": "Celeste Cammarata",   "genitore": "Lo Cascio Dalila",     "email": "dalilalocascio@yahoo.it"},
    {"bambino": "Gioele Macchiarella", "genitore": "Ingraffia Rosalia",    "email": "rosalaing89@libero.it"},
    {"bambino": "Noemi Fecarotta",     "genitore": "Pisani Alessandra",    "email": "alessandrapisani@outlook.com"},
    {"bambino": "Isabella Pantaleo",   "genitore": "Schiopu Mihaela",      "email": "roberto@islafood.it"},
    # Rebecca Gennaro — no email, saltata
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; W="\033[0m"; BOLD="\033[1m"

def req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-send/1.0"}
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
print(f"{BOLD}  INVIO CREDENZIALI — GENITORI CLASSE II INFANZIA{W}")
print(f"{BOLD}{'═'*65}{W}\n")

token = None
for c in CREDS_ADMIN:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── Fetch tutti gli utenti da entrambe le sedi ────────────────────────────────
print("📡 Fetch utenti...", end=" ", flush=True)
u_ggt = req("GET", "/users", token, sede="girogirotondo")
u_mm  = req("GET", "/users", token, sede="il-magico-mondo")
all_users = {u["email"].lower(): u for u in (u_ggt + u_mm) if u.get("email")}
print(f"{G}OK — {len(all_users)} utenti totali{W}\n")

# ── INVIO ─────────────────────────────────────────────────────────────────────
print(f"  {'Bambino':<25} {'Genitore':<28} {'Email':<35} Stato")
print(f"  {'─'*25} {'─'*28} {'─'*35} {'─'*20}")

sent = not_found = errors = 0

for row in GENITORI:
    bambino  = row["bambino"]
    genitore = row["genitore"]
    email    = row["email"].lower()

    user = all_users.get(email)
    if not user:
        print(f"  {Y}⚠️  {bambino:<23} {genitore:<28} {email:<35} account non trovato — skip{W}")
        not_found += 1
        continue

    uid = user["id"]

    # Se il sede_id è ancora MM, aggiorna a GGT
    if user.get("sede_id") == "il-magico-mondo":
        req("PUT", f"/users/{uid}", token, {"sede_id": "girogirotondo"}, silent=True)

    # Invia credenziali (genera nuova password + email)
    res = req("POST", f"/users/{uid}/resend-credentials", token, {})
    if res.get("__error__"):
        print(f"  {R}🔴  {bambino:<23} {genitore:<28} {email:<35} ERRORE: {res.get('detail','?')}{W}")
        errors += 1
    else:
        pwd      = res.get("new_password", "?")
        email_ok = res.get("email_sent", True)
        flag     = f"{G}📧 email inviata{W}" if email_ok else f"{Y}⚠️  email non inviata{W}"
        print(f"  {G}✅  {bambino:<23} {genitore:<28} {email:<35}{W} {flag}")
        print(f"       └ Password: {G}{BOLD}{pwd}{W}")
        sent += 1

print(f"\n{'─'*115}")
print(f"  Inviate: {G}{sent}{W}  |  Non trovate: {Y}{not_found}{W}  |  Errori: {R}{errors}{W}")

if not_found > 0:
    print(f"\n  {Y}⚠️  I {not_found} account 'non trovati' non esistono nel DB.{W}")
    print(f"  {Y}   Esegui prima: python3 import_studenti_prima_infanzia.py{W}")

print(f"\n  {Y}Nota: Rebecca Gennaro (Di Maggio Roberta) — nessuna email in foto.{W}")
print(f"  {Y}      Inserirla manualmente dal pannello admin quando disponibile.{W}\n")
