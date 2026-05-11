#!/usr/bin/env python3
"""
cleanup_import.py
─────────────────
Rimuove SOLO i record studenti creati per errore su Il Magico Mondo.
Gli account genitori vengono MANTENUTI con le credenziali originali.
I child_ids errati vengono rimossi dai genitori, ma l'account resta invariato.

Esegui:  python3 cleanup_import.py --dry-run   (vedi cosa farebbe)
         python3 cleanup_import.py              (applica il fix)
"""
import urllib.request, urllib.error, json, sys

DRY_RUN = "--dry-run" in sys.argv
BASE    = "https://girogirotondo-app-production.up.railway.app/api"
CREDS   = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

# Nomi dei bambini da rimuovere (in MM)
NOMI_BAMBINI = [
    "Alejandro Corrao", "Natalia Gradino", "Natan Ricchiari",
    "Ambra Costantino", "Ginevra Fricano", "Ludovica Di Liberto",
    "Noemi Macaluso", "Celeste Cammarata", "Gioele Macchiarella",
    "Rebecca Gennaro", "Noemi Fecarotta", "Isabella Pantaleo",
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
print(f"\n{BOLD}{'═'*65}{W}")
print(f"{BOLD}  CLEANUP STUDENTI MM (account genitori invariati){' [DRY-RUN]' if DRY_RUN else ''}{W}")
print(f"{BOLD}{'═'*65}{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── FETCH dati MM ─────────────────────────────────────────────────────────────
print("📡 Fetch dati...", end=" ", flush=True)
stud_mm  = req("GET", "/students", token, sede="il-magico-mondo")
users_mm = req("GET", "/users",    token, sede="il-magico-mondo")
print(f"{G}OK — {len(stud_mm)} studenti · {len(users_mm)} utenti MM{W}\n")

nomi_lower = {n.lower() for n in NOMI_BAMBINI}

# Trova i record studenti da eliminare (solo quelli in MM)
students_to_delete = [
    s for s in stud_mm
    if f"{s.get('name','')} {s.get('cognome','')}".strip().lower() in nomi_lower
]

print(f"  Studenti MM da eliminare: {len(students_to_delete)}")
ids_to_remove = {s["id"] for s in students_to_delete}

for s in students_to_delete:
    print(f"    🗑  {s.get('name')} {s.get('cognome','')} — class_id: {s.get('class_id','')}")

if not students_to_delete:
    print(f"\n{Y}  Nessuno studente trovato — forse non era stato importato o è già stato rimosso.{W}")
    sys.exit(0)

# Trova genitori che hanno questi student_id nei child_ids
print(f"\n  Genitori con child_ids da correggere:")
parents_to_fix = []
for u in users_mm:
    if u.get("role") != "parent": continue
    curr_ids = list(u.get("child_ids") or [])
    if u.get("child_id") and u["child_id"] not in curr_ids:
        curr_ids.append(u["child_id"])
    overlap = [cid for cid in curr_ids if cid in ids_to_remove]
    if overlap:
        new_ids = [cid for cid in curr_ids if cid not in ids_to_remove]
        parents_to_fix.append((u, new_ids, overlap))
        print(f"    👤 {u.get('name')} ({u.get('email')}) — rimuovo {len(overlap)} child_id(s), restano {len(new_ids)}")

if not parents_to_fix:
    print(f"    (nessun genitore da aggiornare)")

if DRY_RUN:
    print(f"\n{Y}  [DRY-RUN] Nessuna modifica. Rimuovi --dry-run per applicare.{W}\n")
    sys.exit(0)

# ── ELIMINAZIONE STUDENTI ─────────────────────────────────────────────────────
print(f"\n{BOLD}  STEP 1 — Eliminazione studenti MM...{W}")
del_ok = del_err = 0
for s in students_to_delete:
    res = req("DELETE", f"/students/{s['id']}", token)
    if res.get("__error__"):
        print(f"  {R}🔴 {s.get('name')} {s.get('cognome','')} — {res.get('detail')}{W}")
        del_err += 1
    else:
        print(f"  {G}✅ Studente eliminato: {s.get('name')} {s.get('cognome','')}{W}")
        del_ok += 1

# ── AGGIORNAMENTO child_ids GENITORI ─────────────────────────────────────────
print(f"\n{BOLD}  STEP 2 — Aggiornamento child_ids genitori (credenziali invariate)...{W}")
fix_ok = fix_err = 0
for u, new_ids, removed in parents_to_fix:
    new_child_id = new_ids[0] if new_ids else None
    res = req("PUT", f"/users/{u['id']}", token, {
        "child_ids": new_ids,
        "child_id":  new_child_id,
    })
    if res.get("__error__"):
        print(f"  {R}🔴 {u.get('name')} — {res.get('detail')}{W}")
        fix_err += 1
    else:
        print(f"  {G}✅ {u.get('name')} — child_ids ripristinati: {new_ids}{W}")
        fix_ok += 1

# ── RIEPILOGO ─────────────────────────────────────────────────────────────────
print(f"\n{'─'*65}")
print(f"  Studenti eliminati: {G}{del_ok}{W}  Errori: {R if del_err else G}{del_err}{W}")
print(f"  Genitori aggiornati: {G}{fix_ok}{W}  Errori: {R if fix_err else G}{fix_err}{W}")
print(f"\n  {G}✅ Account genitori MANTENUTI con credenziali originali.{W}")
print(f"  Ora riesegui: python3 import_studenti_prima_infanzia.py su Girogirotondo.\n")
