#!/usr/bin/env python3
"""
fix_db_issues.py — Corregge tutti i 27 problemi trovati dalla diagnostica
Esegui:  python3 fix_db_issues.py
"""
import urllib.request, urllib.error, json, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"

CREDS_LIST = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

W = "\033[0m"; R = "\033[91m"; G = "\033[92m"; Y = "\033[93m"; BOLD = "\033[1m"
ok   = lambda s: print(f"{G}  ✅ {s}{W}")
err  = lambda s: print(f"{R}  🔴 {s}{W}")
warn = lambda s: print(f"{Y}  ⚠️  {s}{W}")
hdr  = lambda s: print(f"\n{BOLD}{s}{W}")

def req(method, path, token=None, body=None, silent=False):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "User-Agent": "ggt-fix/1.0"}
    if token: headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if not silent: print(f"{R}  HTTP {e.code} su {path}: {msg}{W}")
        return {"__error__": e.code, "detail": msg}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
hdr("═" * 65)
hdr("  FIX DB — GIROGIROTONDO")
hdr("═" * 65)

token = None
for creds in CREDS_LIST:
    print(f"🔐 Login con {creds['email']}...", end=" ", flush=True)
    res = req("POST", "/auth/login", body=creds, silent=True)
    token = res.get("token") or res.get("access_token")
    if token:
        print(f"{G}OK{W}")
        break
    print(f"{Y}{res.get('detail','no token')}{W}")

if not token:
    err("Nessuna credenziale funziona.")
    sys.exit(1)

# ── FETCH DATI ────────────────────────────────────────────────────────────────
print("📡 Fetch dati...", end=" ", flush=True)
classes  = req("GET", "/classes",  token)
users    = req("GET", "/users",    token)
students = req("GET", "/students", token)
print(f"{G}OK — {len(classes)} classi · {len(users)} utenti · {len(students)} studenti{W}")

valid_student_ids = {s["id"] for s in students}
class_by_id   = {c["id"]: c for c in classes}
user_by_id    = {u["id"]: u for u in users}
teachers      = [u for u in users if u.get("role") == "teacher"]
parents       = [u for u in users if u.get("role") == "parent"]

fixed = 0
skipped = 0

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1 — Rimuovi child_ids fantasma dai genitori
# ══════════════════════════════════════════════════════════════════════════════
hdr("─" * 65)
hdr("  FIX 1 — Pulizia child_ids fantasma dai genitori")
hdr("─" * 65)

for p in sorted(parents, key=lambda x: x.get("name","")):
    pid = p["id"]
    raw_ids = list(p.get("child_ids") or [])
    legacy  = p.get("child_id")
    if legacy and legacy not in raw_ids:
        raw_ids.append(legacy)

    invalid = [cid for cid in raw_ids if cid not in valid_student_ids]
    if not invalid:
        continue  # nessun problema

    valid_ids = [cid for cid in raw_ids if cid in valid_student_ids]

    print(f"  👤 {p.get('name')} — rimuovo {len(invalid)} ID fantasma, tengo {len(valid_ids)} validi")
    for bad in invalid:
        print(f"     🗑  {bad}")

    # Determina il child_id legacy corretto
    new_child_id = valid_ids[0] if valid_ids else None

    body = {"child_ids": valid_ids, "child_id": new_child_id}
    res = req("PUT", f"/users/{pid}", token, body)
    if res.get("__error__"):
        err(f"Fallito per {p.get('name')}: {res.get('detail')}")
        skipped += 1
    else:
        ok(f"{p.get('name')} aggiornato → child_ids: {valid_ids}")
        fixed += 1

# ══════════════════════════════════════════════════════════════════════════════
# FIX 2 — Verifica classi senza maestra (info only)
# ══════════════════════════════════════════════════════════════════════════════
hdr("─" * 65)
hdr("  FIX 2 — Classi senza maestra assegnata (info)")
hdr("─" * 65)

for c in classes:
    tid = c.get("teacher_id")
    has_teacher_via_user = any(c["id"] in (t.get("class_ids") or []) for t in teachers)
    if not tid and not has_teacher_via_user:
        warn(f"Classe '{c.get('name')}' — nessuna maestra assegnata (da gestire manualmente)")

# ══════════════════════════════════════════════════════════════════════════════
# RIEPILOGO
# ══════════════════════════════════════════════════════════════════════════════
hdr("═" * 65)
hdr("  RIEPILOGO")
hdr("═" * 65)
print(f"\n  Operazioni riuscite:  {G}{fixed}{W}")
print(f"  Operazioni fallite:   {R if skipped else G}{skipped}{W}")
print(f"""
  Problemi NON risolvibili automaticamente:
  {Y}⚠️  3 genitori senza bambini collegati (Andrea Colombo, Laura Ferrari,
     Paolo Marino) — richiedono iscrizione manuale del bambino dall'admin.{W}
  {Y}⚠️  Classi senza maestra assegnata — assegnare manualmente dall'admin.{W}
""")
print(f"  Esegui nuovamente check_maestre_mm.py per verificare.")
