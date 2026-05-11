#!/usr/bin/env python3
"""
invia_credenziali_ii_infanzia.py
─────────────────────────────────
Invia le credenziali di accesso a tutti i genitori
della classe II Infanzia di Girogirotondo.

Esegui:  python3 invia_credenziali_ii_infanzia.py
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
print(f"{BOLD}  INVIO CREDENZIALI — GENITORI CLASSE II INFANZIA (GGT){W}")
print(f"{BOLD}{'═'*65}{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── Trova classe II Infanzia ──────────────────────────────────────────────────
classes  = req("GET", "/classes",  token, sede="girogirotondo")
students = req("GET", "/students", token, sede="girogirotondo")
users    = req("GET", "/users",    token, sede="girogirotondo")

ii_classe = next((c for c in classes if "ii infanzia" in c.get("name","").lower() or
                  "2" in c.get("name","").lower() and "infanzia" in c.get("name","").lower()), None)

if not ii_classe:
    print(f"{R}Classe II Infanzia non trovata.{W}")
    print("Classi disponibili:", [c.get("name") for c in classes])
    sys.exit(1)

print(f"📋 Classe trovata: {ii_classe['name']} (id: {ii_classe['id']})\n")

# Bambini della classe
bambini_ii = [s for s in students if s.get("class_id") == ii_classe["id"]]
print(f"  👶 Bambini in classe: {len(bambini_ii)}")

# Genitori associati
parents_to_notify = []
for bambino in bambini_ii:
    for u in users:
        if u.get("role") != "parent": continue
        child_ids = list(u.get("child_ids") or [])
        if u.get("child_id") and u["child_id"] not in child_ids:
            child_ids.append(u["child_id"])
        if bambino["id"] in child_ids:
            if not any(p["id"] == u["id"] for p in parents_to_notify):
                parents_to_notify.append({**u, "_bambino": bambino["name"]})

print(f"  👨‍👩‍👧 Genitori da notificare: {len(parents_to_notify)}\n")

# ── INVIO ─────────────────────────────────────────────────────────────────────
print(f"  {'Genitore':<30} {'Email':<35} {'Bambino':<20} Stato")
print(f"  {'─'*30} {'─'*35} {'─'*20} {'─'*20}")

sent = errors = 0

for p in parents_to_notify:
    res = req("POST", f"/users/{p['id']}/resend-credentials", token, {})
    if res.get("__error__"):
        print(f"  {R}🔴 {p.get('name','?'):<28} {p.get('email','?'):<35} {p['_bambino']:<20} ERRORE{W}")
        errors += 1
    else:
        email_ok = res.get("email_sent", True)
        pwd      = res.get("new_password", "?")
        if email_ok:
            print(f"  {G}✅ {p.get('name','?'):<28} {p.get('email','?'):<35} {p['_bambino']:<20} 📧 email inviata{W}")
        else:
            print(f"  {Y}⚠️  {p.get('name','?'):<28} {p.get('email','?'):<35} {p['_bambino']:<20} ⚠️  email non inviata{W}")
        print(f"  {'':30} Password: {G}{pwd}{W}")
        sent += 1

print(f"\n{'─'*105}")
print(f"  Email inviate: {G}{sent}{W}  |  Errori: {R}{errors}{W}\n")
