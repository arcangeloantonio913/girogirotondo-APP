#!/usr/bin/env python3
"""
check_finale.py — Check completo di tutta la web app Girogirotondo
Esegui: python3 check_finale.py
"""
import urllib.request, urllib.error, json, sys
from datetime import datetime

BASE = "https://girogirotondo-app-production.up.railway.app/api"
CREDS = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; B="\033[94m"; W="\033[0m"; BOLD="\033[1m"
ok   = lambda s: f"{G}✅ {s}{W}"
err  = lambda s: f"{R}🔴 {s}{W}"
warn = lambda s: f"{Y}⚠️  {s}{W}"
info = lambda s: f"{B}ℹ️  {s}{W}"

issues = []
checks_ok = 0
checks_warn = 0

def check(label, condition, detail="", is_warn=False):
    global checks_ok, checks_warn
    if condition:
        print(f"    {ok(label)}" + (f" — {detail}" if detail else ""))
        checks_ok += 1
    elif is_warn:
        print(f"    {warn(label)}" + (f" — {detail}" if detail else ""))
        issues.append(f"⚠️  {label}: {detail}")
        checks_warn += 1
    else:
        print(f"    {err(label)}" + (f" — {detail}" if detail else ""))
        issues.append(f"🔴 {label}: {detail}")

def req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-check/1.0"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    if sede:  hdrs["X-Sede-Id"] = sede
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, {}

def section(title):
    print(f"\n{BOLD}{'─'*60}{W}")
    print(f"{BOLD}  {title}{W}")
    print(f"{BOLD}{'─'*60}{W}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  CHECK FINALE — GIROGIROTONDO WEB APP{W}")
print(f"{BOLD}  {datetime.now().strftime('%d/%m/%Y %H:%M')}{W}")
print(f"{BOLD}{'═'*60}{W}")

# ── 1. AUTENTICAZIONE ───────────────────────────────────
section("1. AUTENTICAZIONE")

token = None
for c in CREDS:
    s, r = req("POST", "/auth/login", body=c)
    token = r.get("token") or r.get("access_token")
    if token:
        check("Login SuperAdmin", True, c["email"])
        break
check("Token JWT ricevuto", bool(token), "necessario per tutti gli altri check")
if not token: sys.exit(1)

# Token GGT e MM
s, r = req("POST", "/auth/login", body={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"})
check("SuperAdmin Mariagrazia", s == 200 and bool(r.get("token") or r.get("access_token")))
s, r = req("POST", "/auth/login", body={"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"})
check("SuperAdmin Teresa", s == 200 and bool(r.get("token") or r.get("access_token")))

# ── 2. DATABASE & DATI ──────────────────────────────────
section("2. DATABASE — STRUTTURA DATI")

_, classes  = req("GET", "/classes",  token)
_, users    = req("GET", "/users",    token)
_, students = req("GET", "/students", token)

_, classes_ggt = req("GET", "/classes",  token, sede="girogirotondo")
_, students_ggt= req("GET", "/students", token, sede="girogirotondo")
_, users_ggt   = req("GET", "/users",    token, sede="girogirotondo")

_, classes_mm  = req("GET", "/classes",  token, sede="il-magico-mondo")
_, students_mm = req("GET", "/students", token, sede="il-magico-mondo")
_, users_mm    = req("GET", "/users",    token, sede="il-magico-mondo")

teachers_ggt = [u for u in users_ggt if u.get("role") == "teacher"]
teachers_mm  = [u for u in users_mm  if u.get("role") == "teacher"]
parents_ggt  = [u for u in users_ggt if u.get("role") == "parent"]
parents_mm   = [u for u in users_mm  if u.get("role") == "parent"]

check("Classi Girogirotondo",   len(classes_ggt) > 0,  f"{len(classes_ggt)} classi")
check("Classi Il Magico Mondo", len(classes_mm)  > 0,  f"{len(classes_mm)} classi")
check("Studenti Girogirotondo", len(students_ggt) > 0, f"{len(students_ggt)} studenti")
check("Studenti Il Magico Mondo",len(students_mm) > 0, f"{len(students_mm)} studenti")
check("Maestre Girogirotondo",  len(teachers_ggt) > 0, f"{len(teachers_ggt)} maestre")
check("Maestre Il Magico Mondo",len(teachers_mm)  > 0, f"{len(teachers_mm)} maestre")
check("Genitori Girogirotondo", len(parents_ggt)  > 0, f"{len(parents_ggt)} genitori")
check("Genitori Il Magico Mondo",len(parents_mm)  > 0, f"{len(parents_mm)} genitori")

# ── 3. MAESTRE — ISOLAMENTO CLASSI ─────────────────────
section("3. MAESTRE — ISOLAMENTO STUDENTI")

all_classes = classes_ggt + classes_mm
class_by_id = {c["id"]: c for c in all_classes}
all_students= students_ggt + students_mm

for t in teachers_ggt + teachers_mm:
    cids    = t.get("class_ids") or []
    visible = [s for s in all_students if s.get("class_id") in cids]
    correct_class = next((c for c in all_classes if c.get("teacher_id") == t["id"]), None)
    sede_label = "GGT" if t in teachers_ggt else "MM"

    if not cids:
        check(f"{t.get('name')} [{sede_label}]", False,
              "nessun class_ids — vede 0 studenti", is_warn=True)
    elif correct_class and set(cids) != {correct_class["id"]}:
        check(f"{t.get('name')} [{sede_label}]", False,
              f"ha {len(cids)} classi invece di 1 — vede {len(visible)} studenti (ERRATO)")
    else:
        cls_name = class_by_id.get(cids[0], {}).get("name", "?") if cids else "?"
        check(f"{t.get('name')} [{sede_label}]", True,
              f"{cls_name} → {len(visible)} studenti")

# ── 4. GENITORI — CHILD_IDS ─────────────────────────────
section("4. GENITORI — CHILD_IDS VALIDI")

all_student_ids = {s["id"] for s in all_students}
broken = 0
for p in parents_ggt + parents_mm:
    cids = list(p.get("child_ids") or [])
    if p.get("child_id") and p["child_id"] not in cids:
        cids.append(p["child_id"])
    if not cids:
        broken += 1
    else:
        invalid = [c for c in cids if c not in all_student_ids]
        if invalid:
            broken += 1

total_parents = len(parents_ggt) + len(parents_mm)
check("Genitori con child_ids validi",
      broken == 0,
      f"{total_parents - broken}/{total_parents} OK" + (f" — {broken} con ID fantasma" if broken else ""),
      is_warn=(broken > 0))

# ── 5. CLASSI SENZA MAESTRA ─────────────────────────────
section("5. CLASSI — MAESTRE ASSEGNATE")

for c in classes_ggt:
    has_teacher = bool(c.get("teacher_id")) or any(
        c["id"] in (t.get("class_ids") or []) for t in teachers_ggt
    )
    n = sum(1 for s in students_ggt if s.get("class_id") == c["id"])
    check(f"GGT — {c.get('name')}", has_teacher,
          f"{n} alunni", is_warn=not has_teacher)

for c in classes_mm:
    has_teacher = bool(c.get("teacher_id")) or any(
        c["id"] in (t.get("class_ids") or []) for t in teachers_mm
    )
    n = sum(1 for s in students_mm if s.get("class_id") == c["id"])
    check(f"MM  — {c.get('name')}", has_teacher,
          f"{n} alunni", is_warn=not has_teacher)

# ── 6. API PRINCIPALI ───────────────────────────────────
section("6. ENDPOINT API")

today = datetime.now().strftime("%Y-%m-%d")
endpoints = [
    ("GET", "/classes",     None, "Classi"),
    ("GET", "/students",    None, "Studenti"),
    ("GET", "/users",       None, "Utenti"),
    ("GET", "/griglia",     None, "Griglia"),
    ("GET", "/diary",       None, "Diario"),
    ("GET", "/gallery",     None, "Gallery"),
    ("GET", "/documents",   None, "Documenti"),
    ("GET", "/presenze",    None, "Presenze"),
    ("GET", "/appointments",None, "Appuntamenti"),
    ("GET", "/avvisi",      None, "Avvisi"),
    ("GET", "/sedi",        None, "Sedi"),
]
for method, path, body, label in endpoints:
    s, r = req(method, path, token, body)
    check(f"[{method}] {path}", s in (200, 201), f"HTTP {s}")

# ── 7. EMAIL (RESEND) ───────────────────────────────────
section("7. SISTEMA EMAIL — RESEND")

s, r = req("POST", "/auth/test-email", token, {"to": "test@girogirotondo.it"})
if s in (200, 201):
    api_key_set = r.get("resend_api_key_set", False)
    resend_status = r.get("resend_status")
    check("RESEND_API_KEY configurata",   api_key_set,
          r.get("resend_api_key_prefix","NOT SET"))
    check("FROM email configurata", bool(r.get("from_email")),
          r.get("from_email","?"))
    check("Invio email funzionante", resend_status in (200, 201),
          f"HTTP {resend_status}" if resend_status else "non testato")
else:
    check("Endpoint test-email", False, f"HTTP {s}")

# ── 8. STUDENTI PER CLASSE ──────────────────────────────
section("8. DISTRIBUZIONE STUDENTI PER CLASSE")

for c in sorted(classes_ggt, key=lambda x: x.get("name","")):
    n = sum(1 for s in students_ggt if s.get("class_id") == c["id"])
    t = next((u for u in teachers_ggt if c["id"] in (u.get("class_ids") or [])), None)
    print(f"    {B}GGT{W} {c.get('name'):<22} {n:>3} alunni  —  {t.get('name','(nessuna maestra)') if t else Y+'(nessuna maestra)'+W}")

for c in sorted(classes_mm, key=lambda x: x.get("name","")):
    n = sum(1 for s in students_mm if s.get("class_id") == c["id"])
    t = next((u for u in teachers_mm if c["id"] in (u.get("class_ids") or [])), None)
    print(f"    {G}MM {W} {c.get('name'):<22} {n:>3} alunni  —  {t.get('name','(nessuna maestra)') if t else Y+'(nessuna maestra)'+W}")

# ── RIEPILOGO FINALE ────────────────────────────────────
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  RIEPILOGO FINALE{W}")
print(f"{BOLD}{'═'*60}{W}")
print(f"\n  {G}✅ Check superati: {checks_ok}{W}")
print(f"  {Y}⚠️  Warning:        {checks_warn}{W}")
print(f"  {R}🔴 Errori:          {len([i for i in issues if i.startswith('🔴')])}{W}")

print(f"\n  Totale utenti:   {len(users_ggt)+len(users_mm)} ({len(users_ggt)} GGT + {len(users_mm)} MM)")
print(f"  Totale studenti: {len(students_ggt)+len(students_mm)} ({len(students_ggt)} GGT + {len(students_mm)} MM)")
print(f"  Totale classi:   {len(classes_ggt)+len(classes_mm)} ({len(classes_ggt)} GGT + {len(classes_mm)} MM)")

if issues:
    print(f"\n{BOLD}  PROBLEMI DA RISOLVERE:{W}")
    for i in issues:
        print(f"  {i}")
else:
    print(f"\n  {G}{BOLD}🎉 Tutto ok! La web app è pronta.{W}")
print()
