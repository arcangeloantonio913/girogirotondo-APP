#!/usr/bin/env python3
"""
cleanup_import.py
─────────────────
Elimina studenti e genitori creati per errore su Il Magico Mondo.
Li trova per nome bambino o email genitore, poi li cancella.

Esegui:  python3 cleanup_import.py --dry-run   (vedi cosa verrebbe eliminato)
         python3 cleanup_import.py              (elimina davvero)
"""
import urllib.request, urllib.error, json, sys

DRY_RUN = "--dry-run" in sys.argv
BASE    = "https://girogirotondo-app-production.up.railway.app/api"
CREDS   = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

# Dati da cancellare (bambini + email genitori)
NOMI_BAMBINI = [
    "Alejandro Corrao", "Natalia Gradino", "Natan Ricchiari",
    "Ambra Costantino", "Ginevra Fricano", "Ludovica Di Liberto",
    "Noemi Macaluso", "Celeste Cammarata", "Gioele Macchiarella",
    "Rebecca Gennaro", "Noemi Fecarotta", "Isabella Pantaleo",
]

EMAIL_GENITORI = [
    "alexandra_17@live.it", "gradinoalessandro@gmail.com",
    "crocedebora1@gmail.com", "giuliapistone52@gmail.com",
    "gagiorlando@gmail.com", "giambona-francesca@libero.it",
    "devidbmw.dm@gmail.com", "dalilalocascio@yahoo.it",
    "rosalaing89@libero.it", "alessandrapisani@outlook.com",
    "roberto@islafood.it",
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; W="\033[0m"; BOLD="\033[1m"

def req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-cleanup/1.0"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    if sede:  hdrs["X-Sede-Id"] = sede
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:200]
        if not silent: print(f"  {R}HTTP {e.code}: {msg}{W}")
        return {"__error__": True, "detail": msg}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  CLEANUP IMPORT ERRATO{' [DRY-RUN]' if DRY_RUN else ''}{W}")
print(f"{BOLD}{'═'*60}{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── FETCH TUTTI GLI UTENTI E STUDENTI (tutte le sedi) ────────────────────────
print("📡 Fetch dati...", end=" ", flush=True)

# Fetch GGT
users_ggt  = req("GET", "/users",    token, sede="girogirotondo")
stud_ggt   = req("GET", "/students", token, sede="girogirotondo")
# Fetch MM
users_mm   = req("GET", "/users",    token, sede="il-magico-mondo")
stud_mm    = req("GET", "/students", token, sede="il-magico-mondo")

all_users    = {u["id"]: u for u in (users_ggt + users_mm) if u.get("id")}
all_students = {s["id"]: s for s in (stud_ggt + stud_mm) if s.get("id")}
print(f"{G}OK — {len(all_users)} utenti · {len(all_students)} studenti{W}\n")

# ── TROVA GLI ACCOUNT DA ELIMINARE ───────────────────────────────────────────
nomi_lower  = {n.lower() for n in NOMI_BAMBINI}
email_lower = {e.lower() for e in EMAIL_GENITORI}

students_to_delete = [
    s for s in all_students.values()
    if f"{s.get('name','')} {s.get('cognome','')}".strip().lower() in nomi_lower
]

parents_to_delete = [
    u for u in all_users.values()
    if u.get("role") == "parent" and (u.get("email","")).lower() in email_lower
]

print(f"  Studenti trovati da eliminare: {len(students_to_delete)}")
for s in students_to_delete:
    print(f"    🗑  {s.get('name')} {s.get('cognome','')} (class_id: {s.get('class_id','')})")

print(f"\n  Genitori trovati da eliminare: {len(parents_to_delete)}")
for u in parents_to_delete:
    print(f"    🗑  {u.get('name')} — {u.get('email')}")

if not students_to_delete and not parents_to_delete:
    print(f"\n{Y}  Nessun account trovato — forse non era stato importato.{W}")
    sys.exit(0)

if DRY_RUN:
    print(f"\n{Y}  [DRY-RUN] Nessuna modifica. Rimuovi --dry-run per eliminare.{W}\n")
    sys.exit(0)

# ── ELIMINAZIONE ──────────────────────────────────────────────────────────────
print(f"\n{BOLD}  ELIMINAZIONE...{W}")
deleted = errors = 0

for s in students_to_delete:
    res = req("DELETE", f"/students/{s['id']}", token)
    if res.get("__error__"):
        print(f"  {R}🔴 Studente {s.get('name')} — errore: {res.get('detail')}{W}")
        errors += 1
    else:
        print(f"  {G}✅ Studente eliminato: {s.get('name')} {s.get('cognome','')}{W}")
        deleted += 1

for u in parents_to_delete:
    res = req("DELETE", f"/users/{u['id']}", token)
    if res.get("__error__"):
        print(f"  {R}🔴 Genitore {u.get('email')} — errore: {res.get('detail')}{W}")
        errors += 1
    else:
        print(f"  {G}✅ Genitore eliminato: {u.get('name')} ({u.get('email')}){W}")
        deleted += 1

print(f"\n  Eliminati: {G}{deleted}{W}  |  Errori: {R}{errors}{W}\n")
