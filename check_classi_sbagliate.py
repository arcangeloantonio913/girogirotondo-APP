#!/usr/bin/env python3
"""
check_classi_sbagliate.py
──────────────────────────
Trova bambini di Girogirotondo finiti per errore in classi di Il Magico Mondo
e li trasferisce nella classe GGT corretta.

Esegui:  python3 check_classi_sbagliate.py --dry-run   (solo mostra)
         python3 check_classi_sbagliate.py              (applica fix)
"""
import urllib.request, urllib.error, json, sys

DRY_RUN = "--dry-run" in sys.argv
BASE    = "https://girogirotondo-app-production.up.railway.app/api"
CREDS   = [
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
        msg = e.read().decode()[:300]
        if not silent: print(f"  {R}HTTP {e.code}: {msg}{W}")
        return {"__error__": True, "detail": msg}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}{'═'*65}{W}")
print(f"{BOLD}  CHECK BAMBINI IN CLASSI SBAGLIATE{' [DRY-RUN]' if DRY_RUN else ''}{W}")
print(f"{BOLD}{'═'*65}{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── Fetch dati da entrambe le sedi ────────────────────────────────────────────
print("📡 Fetch dati...", end=" ", flush=True)
classes_ggt = req("GET", "/classes",  token, sede="girogirotondo")
classes_mm  = req("GET", "/classes",  token, sede="il-magico-mondo")
students_ggt= req("GET", "/students", token, sede="girogirotondo")
students_mm = req("GET", "/students", token, sede="il-magico-mondo")

class_ids_ggt = {c["id"] for c in classes_ggt}
class_ids_mm  = {c["id"] for c in classes_mm}
class_by_id   = {c["id"]: c for c in classes_ggt + classes_mm}

print(f"{G}OK{W}")
print(f"  GGT: {len(classes_ggt)} classi, {len(students_ggt)} studenti")
print(f"  MM:  {len(classes_mm)} classi, {len(students_mm)} studenti\n")

# ── Trova anomalie ────────────────────────────────────────────────────────────
# Caso 1: studente con sede_id=girogirotondo ma class_id in MM
# Caso 2: studente con sede_id=il-magico-mondo ma class_id in GGT
anomalie = []

for s in students_ggt:
    cid = s.get("class_id","")
    if cid in class_ids_mm:
        cls = class_by_id.get(cid, {})
        anomalie.append({
            "student": s,
            "problema": f"sede GGT ma classe MM: {cls.get('name','?')}",
            "student_sede": "girogirotondo",
            "class_sede": "il-magico-mondo",
        })

for s in students_mm:
    cid = s.get("class_id","")
    if cid in class_ids_ggt:
        cls = class_by_id.get(cid, {})
        anomalie.append({
            "student": s,
            "problema": f"sede MM ma classe GGT: {cls.get('name','?')}",
            "student_sede": "il-magico-mondo",
            "class_sede": "girogirotondo",
        })

if not anomalie:
    print(f"{G}✅ Nessun bambino trovato in classi sbagliate.{W}\n")
    sys.exit(0)

print(f"{Y}⚠️  Trovati {len(anomalie)} bambini in classi sbagliate:{W}\n")
print(f"  {'Nome':<25} {'Problema':<45} {'Azione'}")
print(f"  {'─'*25} {'─'*45} {'─'*30}")

for a in anomalie:
    s = a["student"]
    print(f"  {Y}{s.get('name','')} {s.get('cognome',''):<23}{W} {a['problema']:<45}")

# ── Chiedi la classe di destinazione ─────────────────────────────────────────
if not DRY_RUN:
    print(f"\n{BOLD}Classi disponibili in Girogirotondo:{W}")
    for i, c in enumerate(sorted(classes_ggt, key=lambda x: x.get("name",""))):
        print(f"  {i+1}. {c.get('name')} (id: {c['id']})")

    print(f"\n{BOLD}Classi disponibili in Il Magico Mondo:{W}")
    for i, c in enumerate(sorted(classes_mm, key=lambda x: x.get("name",""))):
        n = len(classes_ggt) + i + 1
        print(f"  {n}. {c.get('name')} (id: {c['id']})")

    all_classes = sorted(classes_ggt, key=lambda x: x.get("name","")) + sorted(classes_mm, key=lambda x: x.get("name",""))

    print(f"\nPer ogni bambino inserisci il numero della classe corretta (o premi INVIO per saltare):\n")

    fixed = 0
    for a in anomalie:
        s = a["student"]
        nome = f"{s.get('name','')} {s.get('cognome','')}".strip()
        print(f"  👶 {nome} → attualmente in: {a['problema']}")
        scelta = input(f"     Classe corretta (1-{len(all_classes)}) o INVIO per saltare: ").strip()

        if not scelta:
            print(f"     {Y}Saltato{W}")
            continue

        try:
            idx = int(scelta) - 1
            target_class = all_classes[idx]
            target_sede  = "girogirotondo" if target_class["id"] in class_ids_ggt else "il-magico-mondo"

            res = req("PUT", f"/students/{s['id']}", token, {
                "class_id": target_class["id"],
                "sede_id":  target_sede,
            })
            if res.get("__error__"):
                print(f"     {R}Errore: {res.get('detail')}{W}")
            else:
                print(f"     {G}✅ Trasferito in {target_class.get('name')} ({target_sede}){W}")
                fixed += 1
        except (ValueError, IndexError):
            print(f"     {R}Numero non valido, saltato{W}")

    print(f"\n  Trasferiti: {G}{fixed}/{len(anomalie)}{W}\n")
else:
    print(f"\n{Y}[DRY-RUN] Esegui senza --dry-run per correggere interattivamente.{W}\n")
