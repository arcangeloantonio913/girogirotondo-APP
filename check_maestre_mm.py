#!/usr/bin/env python3
"""
check_maestre_mm.py — Diagnostica completa Girogirotondo + Il Magico Mondo
Esegui:  python3 check_maestre_mm.py
"""
import urllib.request, urllib.error, json, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"

CREDS_LIST = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
    {"email": "admin@girogirotondo.it",   "password": "Tegime2026"},
    {"email": "admin@girogirotondo.it",   "password": "admin123"},
]

W = "\033[0m"; R = "\033[91m"; G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; BOLD = "\033[1m"

def ok(s):  return f"{G}✅ {s}{W}"
def err(s): return f"{R}🔴 {s}{W}"
def warn(s):return f"{Y}⚠️  {s}{W}"
def info(s):return f"{B}ℹ️  {s}{W}"
def hdr(s): return f"\n{BOLD}{s}{W}"

def req(method, path, token=None, body=None, silent=False):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "User-Agent": "ggt-check/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if not silent:
            print(err(f"HTTP {e.code} su {path}: {msg}"))
            sys.exit(1)
        return {"detail": f"HTTP {e.code}: {msg}"}

# ══════════════════════════════════════════════════════════════════════════════
# 1. LOGIN
# ══════════════════════════════════════════════════════════════════════════════
print(hdr("═" * 70))
print(hdr("  DIAGNOSTICA COMPLETA — GIROGIROTONDO + IL MAGICO MONDO"))
print(hdr("═" * 70))

token = None
for creds in CREDS_LIST:
    print(f"🔐 Login con {creds['email']}...", end=" ", flush=True)
    res = req("POST", "/auth/login", body=creds, silent=True)
    token = res.get("token") or res.get("access_token")
    if token:
        print(ok(f"OK"))
        break
    print(warn(res.get("detail", "no token")))

if not token:
    print(err("Nessuna credenziale funziona. Aggiungi la password corretta in CREDS_LIST."))
    sys.exit(1)

# ══════════════════════════════════════════════════════════════════════════════
# 2. FETCH DATI
# ══════════════════════════════════════════════════════════════════════════════
print("\n📡 Fetch dati dal DB...", end=" ", flush=True)
classes  = req("GET", "/classes",  token)
users    = req("GET", "/users",    token)
students = req("GET", "/students", token)
print(ok(f"{len(classes)} classi · {len(users)} utenti · {len(students)} studenti"))

# Indici rapidi
class_by_id   = {c["id"]: c for c in classes}
student_by_id = {s["id"]: s for s in students}
user_by_id    = {u["id"]: u for u in users}

teachers = [u for u in users if u.get("role") == "teacher"]
parents  = [u for u in users if u.get("role") == "parent"]
admins   = [u for u in users if u.get("role") == "admin"]

# Raggruppa per sede
def sede_label(x):
    raw = (x.get("sede") or x.get("sede_id") or "").lower()
    if "magico" in raw: return "Il Magico Mondo"
    if "giro"  in raw: return "Girogirotondo"
    return raw or "(nessuna)"

sedi = sorted({sede_label(c) for c in classes})

# ══════════════════════════════════════════════════════════════════════════════
# 3. PANORAMICA PER SEDE
# ══════════════════════════════════════════════════════════════════════════════
print(hdr("─" * 70))
print(hdr("  PANORAMICA PER SEDE"))
print(hdr("─" * 70))

issues = []

for sede in sedi:
    sede_classes  = [c for c in classes  if sede_label(c) == sede]
    sede_students = [s for s in students if s.get("class_id") in {c["id"] for c in sede_classes}]
    sede_teachers = [t for t in teachers if any(
        cid in {c["id"] for c in sede_classes} for cid in (t.get("class_ids") or [])
    )]

    print(f"\n{BOLD}📍 {sede}{W}")
    print(f"   Classi: {len(sede_classes)}  |  Maestre: {len(sede_teachers)}  |  Alunni: {len(sede_students)}")

    for c in sorted(sede_classes, key=lambda x: x.get("name","")):
        cid   = c["id"]
        name  = c.get("name", "?")
        tid   = c.get("teacher_id")
        enrolled = [s for s in students if s.get("class_id") == cid]

        # Trova maestra tramite teacher_id sulla classe
        teacher_via_class = user_by_id.get(tid) if tid else None
        # Trova maestra tramite class_ids sull'utente
        teacher_via_user  = next(
            (t for t in teachers if cid in (t.get("class_ids") or [])), None
        )

        status_parts = []

        # — Alunni
        if enrolled:
            status_parts.append(ok(f"{len(enrolled)} alunni"))
        else:
            status_parts.append(warn("0 alunni"))
            issues.append(f"[{sede}] Classe '{name}' ha 0 alunni iscritti")

        # — Maestra
        if not tid and not teacher_via_user:
            status_parts.append(err("nessuna maestra assegnata"))
            issues.append(f"[{sede}] Classe '{name}' non ha maestra assegnata")
        elif teacher_via_class and teacher_via_user and teacher_via_class["id"] == teacher_via_user["id"]:
            status_parts.append(ok(f"maestra: {teacher_via_class.get('name')}"))
        elif teacher_via_class and not teacher_via_user:
            status_parts.append(warn(f"teacher_id={teacher_via_class.get('name')} ma class_ids non aggiornato"))
            issues.append(f"[{sede}] '{name}': teacher_id presente ma maestra non ha class_ids aggiornato")
        elif teacher_via_user and not teacher_via_class:
            status_parts.append(warn(f"{teacher_via_user.get('name')} in class_ids ma teacher_id mancante sulla classe"))
            issues.append(f"[{sede}] '{name}': maestra ha class_ids ma class.teacher_id è vuoto")
        elif teacher_via_class and teacher_via_user and teacher_via_class["id"] != teacher_via_user["id"]:
            status_parts.append(err(f"CONFLITTO: teacher_id→{teacher_via_class.get('name')} ≠ class_ids→{teacher_via_user.get('name')}"))
            issues.append(f"[{sede}] '{name}': CONFLITTO teacher_id vs class_ids")

        print(f"   {'•'} {name:<22} {' | '.join(status_parts)}")
        for s in sorted(enrolled, key=lambda x: x.get("name","")):
            print(f"       └ {s.get('name','?')}")

# ══════════════════════════════════════════════════════════════════════════════
# 4. DETTAGLIO MAESTRE — quanti alunni vede ognuna
# ══════════════════════════════════════════════════════════════════════════════
print(hdr("─" * 70))
print(hdr("  DETTAGLIO MAESTRE — ALUNNI VISIBILI"))
print(hdr("─" * 70))

for sede in sedi:
    sede_class_ids = {c["id"] for c in classes if sede_label(c) == sede}
    sede_teachers  = [t for t in teachers if any(
        cid in sede_class_ids for cid in (t.get("class_ids") or [])
    )]
    orphan_teachers = [t for t in teachers if not any(
        cid in sede_class_ids for cid in (t.get("class_ids") or [])
    ) and sede_label(t) == sede]

    print(f"\n{BOLD}📍 {sede}{W}")
    print(f"   {'Maestra':<28} {'Classe':<22} {'Alunni visibili':>16}")
    print(f"   {'─'*28} {'─'*22} {'─'*16}")

    for t in sorted(sede_teachers, key=lambda x: x.get("name","")):
        t_cids   = [cid for cid in (t.get("class_ids") or []) if cid in sede_class_ids]
        visible  = [s for s in students if s.get("class_id") in t_cids]
        cls_name = ", ".join(class_by_id[cid]["name"] for cid in t_cids if cid in class_by_id)
        line = f"   {t.get('name','?'):<28} {cls_name:<22} {len(visible):>5}"
        if visible:
            print(ok(line))
        else:
            print(err(line + "  ← 0 alunni!"))
            issues.append(f"[{sede}] Maestra '{t.get('name')}' vede 0 alunni")

    if not sede_teachers:
        print(warn(f"   Nessuna maestra associata a classi di questa sede!"))

# Maestre senza nessuna classe
truly_orphan = [t for t in teachers if not t.get("class_ids")]
if truly_orphan:
    print(hdr("\n  ⚠️  MAESTRE SENZA class_ids (vedono 0 studenti)"))
    for t in truly_orphan:
        print(warn(f"   {t.get('name')} <{t.get('email')}> — class_ids: {t.get('class_ids')}"))
        issues.append(f"Maestra '{t.get('name')}' non ha class_ids — vede 0 alunni")

# ══════════════════════════════════════════════════════════════════════════════
# 5. GENITORI — bambino collegato?
# ══════════════════════════════════════════════════════════════════════════════
print(hdr("─" * 70))
print(hdr("  GENITORI — BAMBINI COLLEGATI"))
print(hdr("─" * 70))

broken_parents = 0
for p in sorted(parents, key=lambda x: x.get("name","")):
    child_ids = list(p.get("child_ids") or [])
    if p.get("child_id") and p["child_id"] not in child_ids:
        child_ids.append(p["child_id"])

    if not child_ids:
        print(warn(f"   {p.get('name','?')} <{p.get('email')}> — nessun bambino collegato"))
        issues.append(f"Genitore '{p.get('name')}' senza bambini collegati")
        broken_parents += 1
        continue

    ok_children = []
    bad_children = []
    for cid in child_ids:
        s = student_by_id.get(cid)
        if s:
            ok_children.append(s.get("name","?"))
        else:
            bad_children.append(cid)
            issues.append(f"Genitore '{p.get('name')}': child_id={cid} non esiste nel DB")

    nomi = ", ".join(ok_children)
    if bad_children:
        print(err(f"   {p.get('name','?')} → bambini OK: [{nomi}] | ID FANTASMA: {bad_children}"))
        broken_parents += 1
    else:
        print(ok(f"   {p.get('name','?')} → {nomi}"))

# ══════════════════════════════════════════════════════════════════════════════
# 6. STUDENTI ORFANI (class_id non valido o mancante)
# ══════════════════════════════════════════════════════════════════════════════
print(hdr("─" * 70))
print(hdr("  STUDENTI — PROBLEMI"))
print(hdr("─" * 70))

orphan_students = 0
for s in sorted(students, key=lambda x: x.get("name","")):
    cid = s.get("class_id")
    if not cid:
        print(err(f"   {s.get('name','?')} — nessun class_id!"))
        issues.append(f"Studente '{s.get('name')}' senza class_id")
        orphan_students += 1
    elif cid not in class_by_id:
        print(err(f"   {s.get('name','?')} — class_id={cid} NON ESISTE nel DB"))
        issues.append(f"Studente '{s.get('name')}' ha class_id inesistente: {cid}")
        orphan_students += 1

if orphan_students == 0:
    print(ok("   Tutti gli studenti hanno un class_id valido"))

# ══════════════════════════════════════════════════════════════════════════════
# 7. RIEPILOGO FINALE
# ══════════════════════════════════════════════════════════════════════════════
print(hdr("═" * 70))
print(hdr("  RIEPILOGO FINALE"))
print(hdr("═" * 70))
print(f"\n   Classi totali:    {len(classes)}")
print(f"   Maestre totali:   {len(teachers)}")
print(f"   Genitori totali:  {len(parents)}")
print(f"   Alunni totali:    {len(students)}")
print(f"   Admin totali:     {len(admins)}")

if issues:
    print(f"\n{R}{BOLD}   PROBLEMI TROVATI: {len(issues)}{W}")
    for i, issue in enumerate(issues, 1):
        print(f"   {i:>2}. {issue}")
else:
    print(f"\n{G}{BOLD}   ✅ Nessun problema trovato — tutto ok!{W}")

print()
