#!/usr/bin/env python3
"""
fix_resend_suppression.py
──────────────────────────
Gestisce la lista di soppressione di Resend.

"Suppressed" = Resend rifiuta l'email perché l'address ha avuto un
bounce in passato o è stato marcato come spam. Va rimosso manualmente.

Uso:
  export RESEND_API_KEY=re_xxxxxxxxxx

  python3 fix_resend_suppression.py           → lista tutti i soppressi
  python3 fix_resend_suppression.py --remove-all  → rimuove TUTTI
  python3 fix_resend_suppression.py email@esempio.it  → rimuove uno specifico
"""
import urllib.request, urllib.error, json, sys, os, time

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
BASE = "https://api.resend.com"

G="\033[92m"; R="\033[91m"; Y="\033[93m"; W="\033[0m"; BOLD="\033[1m"

if not RESEND_API_KEY:
    print(f"""
{R}❌ RESEND_API_KEY non trovata.{W}

Esporta la chiave prima di eseguire lo script:
  export RESEND_API_KEY=re_xxxxxxxxxx

La chiave si trova su:
  Railway → Il tuo progetto → Variables → RESEND_API_KEY
""")
    sys.exit(1)

def req(method, path, data=None):
    url  = BASE + path
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
        body_err = e.read().decode()[:300]
        try:
            return e.code, json.loads(body_err)
        except Exception:
            return e.code, {"detail": body_err}

# ── Fetch lista soppressi ─────────────────────────────────────────────────────
def get_suppressions():
    status, body = req("GET", "/suppressions")
    if status != 200:
        print(f"{R}Errore {status}: {body}{W}")
        return []
    # La risposta può essere una lista diretta o {data: [...]}
    if isinstance(body, list):
        return body
    return body.get("data", [])

# ── Rimuove una singola email ─────────────────────────────────────────────────
def remove_suppression(email):
    import urllib.parse
    email_encoded = urllib.parse.quote(email, safe='')
    status, body = req("DELETE", f"/suppressions/{email_encoded}")
    return status in (200, 201, 204)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  RESEND — GESTIONE SOPPRESSI{W}")
print(f"{BOLD}{'═'*60}{W}\n")

items = get_suppressions()

if not items:
    print(f"{G}✅ Nessuna email soppressa — lista vuota!{W}\n")
    sys.exit(0)

print(f"  Email nella lista di soppressione: {R}{BOLD}{len(items)}{W}\n")
print(f"  {'Email':<45} {'Motivo':<20} {'Data'}")
print(f"  {'─'*45} {'─'*20} {'─'*20}")

for item in items:
    if isinstance(item, dict):
        email  = item.get("email", "?")
        reason = item.get("reason", item.get("type", "—"))
        ts     = item.get("created_at", item.get("suppressed_at", "—"))[:10] if item.get("created_at") or item.get("suppressed_at") else "—"
    else:
        email  = str(item)
        reason = "—"
        ts     = "—"
    print(f"  {R}{email:<45}{W} {Y}{reason:<20}{W} {ts}")

print()

# ── Azione ────────────────────────────────────────────────────────────────────
arg = sys.argv[1] if len(sys.argv) > 1 else None

if arg == "--remove-all":
    print(f"{BOLD}  RIMOZIONE di tutti i {len(items)} soppressi...{W}\n")
    ok_count = fail_count = 0
    for item in items:
        email = item.get("email", item) if isinstance(item, dict) else str(item)
        if remove_suppression(email):
            print(f"  {G}✅ Rimossa: {email}{W}")
            ok_count += 1
        else:
            print(f"  {R}🔴 Fallita: {email}{W}")
            fail_count += 1
        time.sleep(0.2)   # evita rate limit Resend

    print(f"\n  {G}Rimosse: {ok_count}{W}  |  {R}Fallite: {fail_count}{W}")
    print(f"\n  {Y}⚠️  Le email con bounce reale potrebbero essere re-soppresse{W}")
    print(f"  {Y}   al prossimo tentativo di invio se l'indirizzo è invalido.{W}")
    print(f"  {Y}   Verifica con i genitori che l'email sia corretta.{W}\n")

elif arg and arg != "--remove-all":
    # Rimozione di un singolo indirizzo
    email = arg.strip()
    print(f"  Rimozione di '{email}'...", end=" ")
    if remove_suppression(email):
        print(f"{G}✅ Rimossa!{W}")
        print(f"  Ora puoi riprovare l'invio tramite il pannello admin.\n")
    else:
        print(f"{R}🔴 Fallita{W} — potrebbe non essere nella lista.\n")

else:
    # Solo lista — nessuna modifica
    print(f"""
  Per rimuovere tutte le email soppress:
    {G}python3 fix_resend_suppression.py --remove-all{W}

  Per rimuovere una email specifica:
    {G}python3 fix_resend_suppression.py email@esempio.it{W}

  {Y}⚠️  Causa frequente:{W}
  - "bounce" = indirizzo email sbagliato → chiedere al genitore di correggere
  - "complaint" = genitore ha cliccato "spam" → inviargli nota manualmente
  - "other" = blocco temporaneo → rimuovere e riprovare
""")
