#!/usr/bin/env python3
"""
RIPRISTINO COMPLETO DATABASE GIROGIROTONDO
==========================================
Ripristina nell'ordine corretto:
  1. Staff (maestre + admin) con password reali
  2. Classi Girogirotondo
  3. Bambini + genitori (tutte le sezioni)
  4. Maestre assegnate alle classi
  5. Staff Il Magico Mondo

Uso:
    cd girogirotondo-APP
    python3 ripristina_tutto.py
"""

import subprocess, sys, time, os

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_SCRIPTS = os.path.join(SCRIPTS_DIR, "backend", "scripts")

# ── Colori terminale ───────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; B = "\033[94m"
BOLD = "\033[1m"; W = "\033[0m"

def sep(title):
    print(f"\n{BOLD}{B}{'═'*60}{W}")
    print(f"{BOLD}{B}  {title}{W}")
    print(f"{BOLD}{B}{'═'*60}{W}\n")

def run_script(path, desc):
    sep(desc)
    if not os.path.exists(path):
        print(f"{R}❌ Script non trovato: {path}{W}")
        return False
    try:
        result = subprocess.run(
            [sys.executable, path],
            cwd=SCRIPTS_DIR,
            timeout=300,
        )
        if result.returncode == 0:
            print(f"\n{G}✅ {desc} — COMPLETATO{W}")
            return True
        else:
            print(f"\n{Y}⚠️  {desc} — terminato con errori (continua comunque){W}")
            return False
    except subprocess.TimeoutExpired:
        print(f"\n{Y}⚠️  {desc} — timeout (continua comunque){W}")
        return False
    except Exception as e:
        print(f"\n{R}❌ {desc} — errore: {e}{W}")
        return False

def check_backend():
    """Verifica che il backend sia raggiungibile."""
    import urllib.request, json
    try:
        with urllib.request.urlopen(f"{BASE}/", timeout=10) as r:
            data = json.loads(r.read())
            print(f"{G}✅ Backend online: {data.get('message','OK')}{W}")
            return True
    except Exception as e:
        print(f"{R}❌ Backend non raggiungibile: {e}{W}")
        print(f"{Y}   Controlla che Railway sia online e riprova.{W}")
        return False

# ─────────────────────────────────────────────────────────────────────────────

print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  RIPRISTINO COMPLETO GIROGIROTONDO{W}")
print(f"{BOLD}{'═'*60}{W}\n")

# Controllo backend
sep("0. Verifica backend")
if not check_backend():
    sys.exit(1)

print(f"\n{Y}  Questo script ripristinerà:{W}")
print(f"  • Staff (3 admin + 14 maestre) con password originali")
print(f"  • Classi: Pesciolini, Tigrotti, Pulcini, Colorandia, I e II Infanzia")
print(f"  • ~100+ bambini con account genitori")
print(f"  • Classi Il Magico Mondo")
print(f"\n{Y}  Durata stimata: 5-10 minuti{W}\n")

answer = input(f"{BOLD}Vuoi procedere? (sì/no): {W}").strip().lower()
if answer not in ("sì", "si", "s", "yes", "y"):
    print("Annullato."); sys.exit(0)

results = {}

# ── STEP 1: Staff con password reali ──────────────────────────────────────────
results["staff"] = run_script(
    os.path.join(BACKEND_SCRIPTS, "seed_staff_reali.py"),
    "1. Staff (maestre e admin) con password originali"
)
time.sleep(2)

# ── STEP 2: Bambini Girogirotondo ──────────────────────────────────────────────
results["bambini_pesciolini_tigrotti"] = run_script(
    os.path.join(SCRIPTS_DIR, "iscrivi_bambini.py"),
    "2. Bambini Pesciolini e Tigrotti"
)
time.sleep(2)

results["bambini_colorandia_pulcini"] = run_script(
    os.path.join(SCRIPTS_DIR, "iscrivi_colorandia_pulcini.py"),
    "3. Bambini Colorandia e Pulcini"
)
time.sleep(2)

results["maestre_iiinfanzia"] = run_script(
    os.path.join(SCRIPTS_DIR, "iscrivi_maestre_e_iiinfanzia.py"),
    "4. Maestre assegnate + bambini II Infanzia"
)
time.sleep(2)

results["bambini_iinfanzia"] = run_script(
    os.path.join(SCRIPTS_DIR, "iscrivi_iinfanzia.py"),
    "5. Bambini I Infanzia (23 alunni)"
)
time.sleep(2)

results["bambini_colorandia_cont"] = run_script(
    os.path.join(SCRIPTS_DIR, "iscrivi_colorandia_cont_iinfanzia.py"),
    "6. Bambini Colorandia (continuazione) + I Infanzia aggiuntivi"
)
time.sleep(2)

results["prima_infanzia"] = run_script(
    os.path.join(SCRIPTS_DIR, "import_studenti_prima_infanzia.py"),
    "7. Sezione II Infanzia (importazione completa)"
)
time.sleep(2)

# ── STEP 3: Riassegna maestre alle classi ──────────────────────────────────────
results["riassegna"] = run_script(
    os.path.join(SCRIPTS_DIR, "ripristina_definitivo.py"),
    "8. Riassegnazione maestre alle classi"
)

# ── RIEPILOGO ──────────────────────────────────────────────────────────────────
sep("RIEPILOGO FINALE")
ok    = sum(1 for v in results.values() if v)
total = len(results)

for step, success in results.items():
    icon = f"{G}✅{W}" if success else f"{Y}⚠️ {W}"
    print(f"  {icon} {step}")

print(f"\n{BOLD}{G if ok==total else Y}  {ok}/{total} script completati con successo{W}")

print(f"""
{BOLD}Credenziali admin disponibili:{W}
  Teresa Coordinatrice:  melignanoteresa@gmail.com  /  Teresa2026!
  Mariagrazia Direttrice: mariucciasc@gmail.com    /  Mariagrazia2026!

{Y}Note:{W}
  • Alcuni bambini senza email genitore vanno inseriti manualmente dalla webapp
  • Vittoria Aiello, Emma Tona, Natan Ricchiari, Rebecca Gennaro: email mancante
  • I Bambini Il Magico Mondo vanno inseriti manualmente dall'admin UI

{B}Accedi alla webapp:{W} https://girogirotondowebapp.it
""")
