#!/usr/bin/env python3
"""
fix_resend_suppression.py
──────────────────────────
Rimuove un'email dalla lista di soppressione di Resend.
"Suppressed" = Resend rifiuta l'email perché l'address aveva
avuto un bounce o era stato marcato come spam in passato.

Uso:
  python3 fix_resend_suppression.py aurorazerilo062@gmail.com
  python3 fix_resend_suppression.py                            ← rimuove tutte
"""
import urllib.request, urllib.error, json, sys, os

# API key Resend (legge da Railway env o hardcoded temporaneamente)
RESEND_API_KEY = "re_Y1eKV..."   # ← sostituisci con la tua chiave completa da Railway
BASE = "https://api.resend.com"

def req(method, path, data=None):
    url  = BASE + path
    body = json.dumps(data).encode() if data else None
    hdrs = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "ggt-fix/1.0",
    }
    r = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode()[:500])

# ── Leggi la chiave dalla env di Railway se disponibile ──────────────────────
env_key = os.environ.get("RESEND_API_KEY","").strip()
if env_key:
    RESEND_API_KEY = env_key
elif RESEND_API_KEY.endswith("..."):
    print("⚠️  Inserisci la RESEND_API_KEY completa nello script oppure esportala:")
    print("   export RESEND_API_KEY=re_xxxxxxxxxx")
    print("   python3 fix_resend_suppression.py aurorazerilo062@gmail.com")
    sys.exit(1)

target = sys.argv[1] if len(sys.argv) > 1 else None

if target:
    # Rimuove singola email
    print(f"🗑  Rimozione '{target}' dalla lista di soppressione Resend...")
    status, body = req("DELETE", f"/suppressions/{target}")
    if status in (200, 204):
        print(f"✅ '{target}' rimossa — ora le email arriveranno normalmente.")
    else:
        print(f"⚠️  Status {status}: {body}")
        if status == 404:
            print("   L'email non era in lista di soppressione (già ok).")
else:
    # Mostra tutte le email soppresse
    print("📋 Lista email soppresse:")
    status, body = req("GET", "/suppressions")
    if status == 200:
        items = body.get("data", body) if isinstance(body, dict) else body
        if not items:
            print("  ✅ Nessuna email soppressa!")
        else:
            for item in items:
                email  = item.get("email", item) if isinstance(item, dict) else item
                reason = item.get("reason", "") if isinstance(item, dict) else ""
                print(f"  🔴 {email}  {reason}")
            print(f"\nPer rimuoverne una:")
            print(f"  python3 fix_resend_suppression.py EMAIL")
    else:
        print(f"Errore {status}: {body}")
