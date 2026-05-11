#!/usr/bin/env python3
"""
test_email.py — Diagnostica completa sistema email
Esegui: python3 test_email.py tua@email.it
"""
import urllib.request, urllib.error, json, sys

if len(sys.argv) < 2:
    print("Uso: python3 test_email.py tua@email.it")
    sys.exit(1)

DEST   = sys.argv[1]
BASE   = "https://girogirotondo-app-production.up.railway.app/api"
CREDS  = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; W="\033[0m"; B="\033[94m"; BOLD="\033[1m"

def req(method, path, token=None, body=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-diag/1.0"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:500]
        if not silent: print(f"  {R}HTTP {e.code}: {msg}{W}")
        return {"__error__": True, "detail": msg, "status": e.code}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  DIAGNOSTICA EMAIL — GIROGIROTONDO{W}")
print(f"{BOLD}{'═'*60}{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login OK: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── TEST EMAIL tramite endpoint dedicato ─────────────────────────────────────
print(f"\n{BOLD}TEST EMAIL → {DEST}{W}")
print("─" * 60)

res = req("POST", "/auth/test-email", token, {"to": DEST})

if res.get("__error__"):
    print(f"{R}🔴 Endpoint test-email non raggiungibile{W}")
    sys.exit(1)

# Stampa diagnosi completa
print(f"\n  {BOLD}Configurazione Resend su Railway:{W}")
api_key_set = res.get("resend_api_key_set", False)
api_key_prefix = res.get("resend_api_key_prefix", "NOT SET")
from_email = res.get("from_email", "?")
to_email = res.get("to_email", "?")

if api_key_set:
    print(f"  {G}✅ RESEND_API_KEY trovata: {api_key_prefix}{W}")
else:
    print(f"  {R}🔴 RESEND_API_KEY NON TROVATA in Railway Variables!{W}")
    print(f"  {Y}   → Vai su Railway → Il tuo progetto → Variables{W}")
    print(f"  {Y}   → Aggiungi: RESEND_API_KEY = re_xxxxxxxx (dalla dashboard Resend){W}")

print(f"  {B}ℹ️  FROM email: {from_email}{W}")
print(f"  {B}ℹ️  TO email:   {to_email}{W}")

# Risultato invio
status = res.get("resend_status")
resp_body = res.get("resend_response", {})
error_msg = res.get("error", "")

print(f"\n  {BOLD}Risultato invio:{W}")
if error_msg:
    print(f"  {R}🔴 Errore: {error_msg}{W}")
elif status in (200, 201):
    email_id = resp_body.get("id", "?") if isinstance(resp_body, dict) else "?"
    print(f"  {G}✅ Email INVIATA con successo! ID: {email_id}{W}")
    print(f"  {G}   Controlla la casella: {DEST}{W}")
elif status == 403:
    print(f"  {R}🔴 HTTP 403 — dominio FROM non verificato su Resend{W}")
    print(f"  {Y}   FROM attuale: {from_email}{W}")
    print(f"  {Y}   → Su Resend Dashboard verifica che il dominio di '{from_email}' sia verificato{W}")
    print(f"  {Y}   → Oppure su Railway aggiungi: RESEND_FROM_EMAIL = onboarding@resend.dev{W}")
    print(f"  {Y}     (indirizzo di test gratuito Resend — funziona sempre){W}")
elif status == 422:
    print(f"  {R}🔴 HTTP 422 — payload non valido{W}")
    print(f"  {Y}   Dettaglio: {resp_body}{W}")
elif status == 401:
    print(f"  {R}🔴 HTTP 401 — API Key non valida o scaduta{W}")
    print(f"  {Y}   → Rigenera una nuova API Key su resend.com e aggiornala su Railway{W}")
else:
    print(f"  {Y}⚠️  Status: {status}{W}")
    print(f"  {Y}   Risposta: {resp_body}{W}")

# ── SOLUZIONE RAPIDA ──────────────────────────────────────────────────────────
print(f"\n{BOLD}{'─'*60}{W}")
print(f"{BOLD}  CHECKLIST RAPIDA{W}")
print(f"{'─'*60}")
print(f"""
  1. Railway → Il tuo progetto → Variables → verifica:
     {G}RESEND_API_KEY{W}     = re_xxxxxxxxxx  (da resend.com/api-keys)
     {G}RESEND_FROM_EMAIL{W}  = noreply@girogirotondowebapp.it
                           (oppure onboarding@resend.dev per test)

  2. Resend Dashboard → Domains → girogirotondowebapp.it:
     - Status deve essere {G}Verified{W}
     - Se non verificato: aggiungi i record DNS indicati da Resend

  3. Se usi il dominio personalizzato, assicurati che il FROM
     sia esattamente nella forma: Nome <email@tuodominio.it>
     Es: {G}RESEND_FROM_EMAIL=Girogirotondo <noreply@girogirotondowebapp.it>{W}
""")
