#!/usr/bin/env python3
"""
get_credenziali.py — Recupera email e password visibili di tutte le maestre GGT
Esegui:  python3 get_credenziali.py
"""
import urllib.request, urllib.error, json, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"
CREDS_LIST = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

def req(method, path, token=None, body=None, silent=False):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "User-Agent": "ggt-check/1.0"}
    if token: headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if not silent: print(f"HTTP {e.code}: {e.read().decode()[:200]}")
        return {"__error__": True}

# Login
token = None
for creds in CREDS_LIST:
    res = req("POST", "/auth/login", body=creds, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: break

if not token:
    print("Login fallito"); sys.exit(1)

users   = req("GET", "/users",   token)
classes = req("GET", "/classes", token)
class_by_id = {c["id"]: c["name"] for c in classes}

teachers = [u for u in users if u.get("role") == "teacher"]

print(f"\n{'─'*60}")
print(f"  CREDENZIALI MAESTRE — GIROGIROTONDO")
print(f"{'─'*60}\n")
print(f"  {'Nome':<25} {'Email':<35} {'Password':<20} {'Classe'}")
print(f"  {'─'*25} {'─'*35} {'─'*20} {'─'*15}")

for t in sorted(teachers, key=lambda x: x.get("name","")):
    nome    = t.get("name", "?")
    email   = t.get("email", "?")
    pwd     = t.get("admin_password") or "(non visibile — resetta dal pannello admin)"
    cids    = t.get("class_ids") or ([t["class_id"]] if t.get("class_id") else [])
    classe  = ", ".join(class_by_id.get(cid, cid[:8]) for cid in cids) or "—"
    print(f"  {nome:<25} {email:<35} {pwd:<20} {classe}")

print()
