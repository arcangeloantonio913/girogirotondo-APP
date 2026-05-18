#!/usr/bin/env python3
"""
fix_resend_suppression.py
──────────────────────────
Rimuove dalla lista di soppressione Resend tutti gli indirizzi email
dei genitori presenti nel DB.

Resend NON espone un endpoint GET per elencare i soppressi.
Questo script aggira il problema tentando la DELETE per ogni email
del sistema: quelle soppresse vengono sbloccate, le altre restituiscono
404 (ignorato silenziosamente).

Uso:
  export RESEND_API_KEY=re_xxxxxxxxxx

  python3 fix_resend_suppression.py            → rimuove tutti i genitori
  python3 fix_resend_suppression.py --dry-run  → mostra senza modificare
  python3 fix_resend_suppression.py email@xx.it → rimuove uno specifico
"""
import urllib.request, urllib.error, urllib.parse
import json, sys, os, time

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
BASE_API  = "https://api.resend.com"
BASE_GGT  = "https://girogirotondo-app-production.up.railway.app/api"
DRY_RUN   = "--dry-run" in sys.argv

CREDS_GGT = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; W="\033[0m"; BOLD="\033[1m"

if not RESEND_API_KEY:
    print(f"""
{R}❌ RESEND_API_KEY non trovata.{W}

Esporta la chiave prima di eseguire:
  export RESEND_API_KEY=re_xxxxxxxxxx
  python3 fix_resend_suppression.py

Trovi la chiave su Railway → Il tuo progetto → Variables → RESEND_API_KEY
""")
    sys.exit(1)

# ── Helpers ───────────────────────────────────────────────────────────────────
def resend_req(method, path, data=None):
    url  = BASE_API + path
    body = json.dumps(data).encode() if data else None
    hdrs = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type":  "application/json",
        "User-Agent":    "ggt-fix/1.0",
    }
    r = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        return e.code, {}

def ggt_req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE_GGT + path
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-fix/1.0"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    if sede:  hdrs["X-Sede-Id"] = sede
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if not silent: print(f"  {R}HTTP {e.code}{W}")
        return {"__error__": True}

def remove_suppression(email):
    """Restituisce True se rimossa, False se non era soppressa (404), None se errore."""
    encoded = urllib.parse.quote(email, safe='')
    status, _ = resend_req("DELETE", f"/suppressions/{encoded}")
    if status in (200, 201, 204):
        return True    # era soppressa, ora rimossa
    if status == 404:
        return False   # non era soppressa, tutto ok
    return None        # errore inatteso

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  RESEND — RIMOZIONE SOPPRESSI{' [DRY-RUN]' if DRY_RUN else ''}{W}")
print(f"{BOLD}{'═'*60}{W}\n")

# ── Caso 1: email singola passata come argomento ──────────────────────────────
target = next((a for a in sys.argv[1:] if a != "--dry-run"), None)
if target:
    print(f"  Rimozione di '{target}' dalla lista soppressi Resend...")
    if DRY_RUN:
        print(f"  {Y}[DRY-RUN] Avrebbe tentato la rimozione di {target}{W}")
    else:
        result = remove_suppression(target)
        if result is True:
            print(f"  {G}✅ '{target}' era soppressa → ora sbloccata!{W}")
            print(f"  Puoi riprovare l'invio dal pannello admin.")
        elif result is False:
            print(f"  {G}✅ '{target}' non era nella lista soppressa — ok!{W}")
        else:
            print(f"  {R}🔴 Errore inatteso per '{target}'{W}")
    sys.exit(0)

# ── Caso 2: rimuove TUTTI i genitori del DB ───────────────────────────────────
print("🔐 Login backend...", end=" ", flush=True)
token = None
for c in CREDS_GGT:
    res = ggt_req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}OK ({c['email']}){W}"); break
if not token:
    print(f"{R}fallito{W}")
    sys.exit(1)

# Fetch email di tutti i genitori da entrambe le sedi
print("📡 Fetch email genitori...", end=" ", flush=True)
u_ggt = ggt_req("GET", "/users", token, sede="girogirotondo")
u_mm  = ggt_req("GET", "/users", token, sede="il-magico-mondo")

if not isinstance(u_ggt, list): u_ggt = []
if not isinstance(u_mm, list):  u_mm  = []

parents = [u for u in u_ggt + u_mm if u.get("role") == "parent" and u.get("email")]
emails  = sorted({u["email"].lower() for u in parents})
print(f"{G}OK — {len(emails)} email uniche{W}\n")

print(f"  {'Email':<45} Stato")
print(f"  {'─'*45} {'─'*20}")

removed = already_ok = errors = 0

for email in emails:
    if DRY_RUN:
        print(f"  {Y}{email:<45}{W} [dry-run]")
        continue

    result = remove_suppression(email)
    time.sleep(0.15)   # evita rate-limit Resend (7 req/s)

    if result is True:
        print(f"  {G}🔓 {email:<43}{W} rimossa dalla lista")
        removed += 1
    elif result is False:
        already_ok += 1  # silenzia i "non soppressi" — troppo rumore
    else:
        print(f"  {R}⚠️  {email:<43}{W} errore")
        errors += 1

print(f"\n{'─'*60}")
print(f"  {G}Sbloccate:{W} {removed}  |  Ok (non soppress): {already_ok}  |  {R}Errori:{W} {errors}")
if removed > 0:
    print(f"\n  {G}✅ {removed} indirizzi sbloccati!{W}")
    print(f"  Le email future verranno consegnate normalmente.")
    print(f"  {Y}⚠️  Se alcune rimbalzano di nuovo, l'indirizzo potrebbe essere sbagliato.{W}")
elif not DRY_RUN:
    print(f"\n  {G}✅ Nessun indirizzo era soppresso — tutto ok!{W}")

print()
