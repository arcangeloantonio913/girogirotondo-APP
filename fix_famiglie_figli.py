#!/usr/bin/env python3
"""
fix_famiglie_figli.py
──────────────────────
Trova genitori che nel DB hanno meno figli di quanti dichiarano
e mostra come aggiungere i figli mancanti tramite il pannello admin.

Casi noti:
- Pilato Rosaria (rosario_pilato91@hotmail.it): ha 2 figli ma ne vede 1
- Famiglie con 3 figli ma child_ids con solo 2 voci

Esegui: python3 fix_famiglie_figli.py
"""
import urllib.request, urllib.error, json, sys

BASE  = "https://girogirotondo-app-production.up.railway.app/api"
CREDS = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; W="\033[0m"; BOLD="\033[1m"

def req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-fix/1.0"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    if sede:  hdrs["X-Sede-Id"] = sede
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if not silent: print(f"  {R}HTTP {e.code}: {e.read().decode()[:200]}{W}")
        return {"__error__": True}

print(f"\n{BOLD}{'═'*65}{W}")
print(f"{BOLD}  DIAGNOSI FAMIGLIE — FIGLI MANCANTI{W}")
print(f"{BOLD}{'═'*65}{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# Fetch
print("📡 Fetch...", end=" ")
users_ggt   = req("GET", "/users",    token, sede="girogirotondo")
users_mm    = req("GET", "/users",    token, sede="il-magico-mondo")
students_ggt= req("GET", "/students", token, sede="girogirotondo")
students_mm = req("GET", "/students", token, sede="il-magico-mondo")
print(f"{G}OK{W}\n")

all_students   = {s["id"]: s for s in students_ggt + students_mm}
parents = [u for u in users_ggt + users_mm if u.get("role") == "parent"]

print(f"{'Genitore':<30} {'Email':<40} {'Figli nel DB':>12}  Nomi bambini")
print("─" * 100)

problems = []
for p in sorted(parents, key=lambda x: x.get("name","")):
    cids = list(p.get("child_ids") or [])
    if p.get("child_id") and p["child_id"] not in cids:
        cids.append(p["child_id"])

    valid   = [all_students[c] for c in cids if c in all_students]
    invalid = [c for c in cids if c not in all_students]

    names = ", ".join(f"{s.get('name')} {s.get('cognome','')}" for s in valid)

    if invalid:
        print(f"{R}🔴 {p.get('name','?'):<28} {p.get('email','?'):<40} {len(valid):>5} validi  {names}{W}")
        print(f"   {R}   ID fantasma: {invalid}{W}")
        problems.append(p)
    elif len(valid) == 0:
        print(f"{Y}⚠️  {p.get('name','?'):<28} {p.get('email','?'):<40} {0:>5} figli    (nessun bambino!){W}")
        problems.append(p)

print(f"\n{'─'*100}")
print(f"  Genitori con problemi: {R if problems else G}{len(problems)}{W}")

# ── Pilato Rosaria nello specifico ────────────────────────────────────────────
print(f"\n{BOLD}  DETTAGLIO — Pilato Rosaria:{W}")
pilato = next((u for u in parents if "pilato" in u.get("name","").lower() or
               "pilato" in u.get("email","").lower()), None)
if pilato:
    cids   = list(pilato.get("child_ids") or [])
    valid  = [all_students[c] for c in cids if c in all_students]
    invalid= [c for c in cids if c not in all_students]
    print(f"  Email:   {pilato.get('email')}")
    nomi_validi = [s.get('name','') + ' ' + s.get('cognome','') for s in valid]
    print(f"  Figli validi: {nomi_validi}")
    if invalid:
        print(f"  {R}ID fantasma: {invalid}{W}")
        print(f"\n  {Y}SOLUZIONE:{W}")
        print(f"  1. Vai su Admin → Utenti → cerca 'Pilato'")
        print(f"  2. Trova il secondo figlio in Admin → Alunni")
        print(f"  3. Clicca 👤+ sul secondo bambino e inserisci: {pilato.get('email')}")
        print(f"  4. Questo aggiungerà il bambino all'account esistente")
else:
    print(f"  {Y}Genitore Pilato non trovato nel DB{W}")

print(f"""
{BOLD}  COME AGGIUNGERE UN FIGLIO A UN GENITORE ESISTENTE:{W}
  1. Admin → Utenti → sezione Alunni
  2. Trova il bambino da associare
  3. Clicca il pulsante 👤+ (Aggiungi secondo genitore)
  4. Inserisci l'email del genitore che deve vederlo
  5. Se l'email esiste già → il bambino viene aggiunto automaticamente
     Se non esiste → viene creato un nuovo account
""")
