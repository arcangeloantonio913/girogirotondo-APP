#!/usr/bin/env python3
"""
fix_maestre_mm.py
─────────────────
Controlla e corregge i class_ids delle maestre di Il Magico Mondo.
Ogni maestra deve avere ESATTAMENTE la sua classe e NON quelle altrui.

Esegui:  python3 fix_maestre_mm.py
         python3 fix_maestre_mm.py --dry-run   (solo mostra, non modifica)
"""
import urllib.request, urllib.error, json, sys

DRY_RUN  = "--dry-run" in sys.argv
BASE     = "https://girogirotondo-app-production.up.railway.app/api"
SEDE_MM  = "il-magico-mondo"
CREDS    = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

W="\033[0m"; R="\033[91m"; G="\033[92m"; Y="\033[93m"; B="\033[94m"; BOLD="\033[1m"
ok   = lambda s: print(f"  {G}✅ {s}{W}")
err  = lambda s: print(f"  {R}🔴 {s}{W}")
warn = lambda s: print(f"  {Y}⚠️  {s}{W}")
info = lambda s: print(f"  {B}ℹ️  {s}{W}")
hdr  = lambda s: print(f"\n{BOLD}{s}{W}")

def req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-fix/1.0"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    if sede:  hdrs["X-Sede-Id"] = sede          # ← chiave per vedere i dati MM
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if not silent: print(f"  {R}HTTP {e.code}: {msg}{W}")
        return {"__error__": True, "detail": msg}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
hdr("═"*65)
hdr("  CHECK & FIX MAESTRE — IL MAGICO MONDO" + (" [DRY-RUN]" if DRY_RUN else ""))
hdr("═"*65)

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token:
        print(f"\n{G}✅ Login: {c['email']}{W}")
        break
if not token:
    err("Login fallito"); sys.exit(1)

# ── FETCH con X-Sede-Id: il-magico-mondo ─────────────────────────────────────
print(f"📡 Fetch dati sede '{SEDE_MM}'...", end=" ", flush=True)
mm_classes  = req("GET", "/classes",  token, sede=SEDE_MM)
mm_users    = req("GET", "/users",    token, sede=SEDE_MM)
mm_students = req("GET", "/students", token, sede=SEDE_MM)

if isinstance(mm_classes, dict) and mm_classes.get("__error__"):
    err("Impossibile recuperare le classi MM"); sys.exit(1)

print(f"{G}OK — {len(mm_classes)} classi · {len(mm_users)} utenti · {len(mm_students)} studenti{W}")

class_by_id   = {c["id"]: c for c in mm_classes}
teachers      = [u for u in mm_users if u.get("role") == "teacher"]
mm_class_ids  = {c["id"] for c in mm_classes}

# ── PANORAMICA CLASSI MM ──────────────────────────────────────────────────────
hdr(f"─ Classi Il Magico Mondo ({len(mm_classes)})")
for c in sorted(mm_classes, key=lambda x: x.get("name","")):
    tid     = c.get("teacher_id")
    teacher = next((t for t in teachers if t["id"] == tid), None) if tid else None
    n_stu   = sum(1 for s in mm_students if s.get("class_id") == c["id"])
    t_name  = teacher.get("name") if teacher else f"{R}NESSUNA MAESTRA{W}"
    print(f"  • {c.get('name'):<22} teacher_id→ {t_name:<30} {n_stu} alunni")

# ── ANALISI MAESTRE ───────────────────────────────────────────────────────────
hdr("─"*65)
hdr("  ANALISI MAESTRE — class_ids")
hdr("─"*65)

fixes_needed = []

print(f"\n  {'Maestra':<28} {'class_ids attuali':<40} {'Corretta':<22} Alunni ora → Corretti")
print("  " + "─"*110)

for t in sorted(teachers, key=lambda x: x.get("name","")):
    tid          = t["id"]
    name         = t.get("name","?")
    current_cids = t.get("class_ids") or []

    # Classe "corretta" = quella il cui teacher_id punta a questa maestra
    correct_cls  = next((c for c in mm_classes if c.get("teacher_id") == tid), None)

    current_names = [class_by_id[cid]["name"] if cid in class_by_id else cid[:8]+"…" for cid in current_cids]
    correct_name  = correct_cls["name"] if correct_cls else f"{R}(non trovata){W}"
    correct_cid   = correct_cls["id"]   if correct_cls else None

    students_now     = [s for s in mm_students if s.get("class_id") in current_cids]
    students_correct = [s for s in mm_students if s.get("class_id") == correct_cid] if correct_cid else []

    needs_fix = correct_cid and (set(current_cids) != {correct_cid})
    status    = f"{R}🔴 ERRATO{W}" if needs_fix else f"{G}✅ OK{W}"

    print(f"  {name:<28} {str(current_names):<40} {correct_name:<22} {len(students_now)} → {len(students_correct)}  {status}")

    if needs_fix:
        fixes_needed.append((t, correct_cid, correct_name, students_correct))

# ── DETTAGLIO PROBLEMI ────────────────────────────────────────────────────────
if fixes_needed:
    hdr("─"*65)
    hdr("  PROBLEMI RILEVATI")
    hdr("─"*65)
    for t, correct_cid, correct_name, correct_students in fixes_needed:
        warn(f"{t.get('name')}: ha class_ids={t.get('class_ids')} → deve avere [{correct_cid}] ({correct_name})")
        warn(f"  Vede {len(t.get('class_ids') or [])} classi, dovrebbe vederne 1 ({len(correct_students)} alunni)")

# ── APPLICA FIX ───────────────────────────────────────────────────────────────
hdr("─"*65)
hdr("  FIX" + (" [DRY-RUN — nessuna modifica]" if DRY_RUN else ""))
hdr("─"*65)

fixed = 0
for t, correct_cid, correct_name, correct_students in fixes_needed:
    print(f"\n  👩‍🏫 {t.get('name')}: class_ids → [{correct_name}]")
    if not DRY_RUN:
        res = req("PUT", f"/users/{t['id']}", token, {"class_ids": [correct_cid]})
        if res.get("__error__"):
            err(f"Fix fallito: {res.get('detail')}")
        else:
            ok(f"Aggiornata: class_ids = [{correct_name}]")
            fixed += 1
    else:
        info(f"[DRY-RUN] Avrebbe impostato class_ids=[{correct_cid}]")
        fixed += 1

if not fixes_needed:
    ok("Nessun problema trovato — tutte le maestre hanno i class_ids corretti")

# ── VERIFICA FINALE ───────────────────────────────────────────────────────────
if not DRY_RUN and fixed > 0:
    print("\n📡 Ricarico dati aggiornati...", end=" ", flush=True)
    mm_users  = req("GET", "/users", token, sede=SEDE_MM)
    teachers  = [u for u in mm_users if u.get("role") == "teacher"]
    print(f"{G}OK{W}")

hdr("─"*65)
hdr("  VERIFICA FINALE — ALUNNI VISIBILI PER MAESTRA")
hdr("─"*65)

all_ok = True
for t in sorted(teachers, key=lambda x: x.get("name","")):
    final_cids = t.get("class_ids") or []
    visible    = [s for s in mm_students if s.get("class_id") in final_cids]
    names_list = [class_by_id[cid]["name"] for cid in final_cids if cid in class_by_id]
    cls_str    = ", ".join(names_list) or f"{R}(nessuna classe){W}"
    status     = f"{G}✅{W}" if len(final_cids) == 1 else (f"{R}🔴 {len(final_cids)} classi!{W}" if len(final_cids) > 1 else f"{Y}⚠️  0 classi{W}")
    print(f"\n  {status} {t.get('name')} → {cls_str} — {len(visible)} alunni")
    for s in sorted(visible, key=lambda x: x.get("name","")):
        print(f"       └ {s.get('name')}")
    if len(final_cids) != 1:
        all_ok = False

hdr("═"*65)
print(f"\n  Correzioni applicate: {G if fixed else Y}{fixed}{W}")
if fixes_needed and all_ok and not DRY_RUN:
    print(f"  {G}{BOLD}✅ Tutto corretto — ogni maestra vede solo la propria classe{W}")
elif fixes_needed and DRY_RUN:
    print(f"  {Y}[DRY-RUN] Esegui senza --dry-run per applicare le correzioni{W}")
print()
