#!/usr/bin/env python3
"""
TROVA FAMIGLIE IL MAGICO MONDO — Via Resend API
=================================================
Logica: tutte le email inviate via Resend che NON appartengono
a famiglie/staff Girogirotondo sono famiglie Il Magico Mondo.

Uso:
    python3 trova_famiglie_mm.py RE_xxxxxxxxxxxx
    oppure:
    python3 trova_famiglie_mm.py  (chiede la chiave interattivamente)
"""

import sys, json, time, re, urllib.request, urllib.error
from pathlib import Path

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; B = "\033[94m"
BOLD = "\033[1m"; W = "\033[0m"

# ── Resend API Key ────────────────────────────────────────────────────────────
if len(sys.argv) > 1:
    RESEND_KEY = sys.argv[1]
else:
    print(f"\n{BOLD}Vai su Railway → girogirotondo-APP → Variables → RESEND_API_KEY{W}")
    print(f"Copia il valore (inizia con 're_') e incollalo qui:\n")
    RESEND_KEY = input("RESEND_API_KEY: ").strip()

if not RESEND_KEY or not RESEND_KEY.startswith("re_"):
    print(f"{R}❌ Chiave non valida. Deve iniziare con 're_'{W}")
    sys.exit(1)

print(f"\n{G}✅ Chiave Resend ricevuta{W}")

# ── Email GGT note (da email_ggt_note.txt) ───────────────────────────────────
ggt_file = Path(__file__).parent / "email_ggt_note.txt"
if ggt_file.exists():
    with open(ggt_file) as f:
        KNOWN_GGT = {line.strip().lower() for line in f if line.strip()}
else:
    # Fallback con le email note dagli script
    KNOWN_GGT = {
        "mariucciasc@gmail.com", "melignanoteresa@gmail.com",
        "gabri.franco@hotmail.it", "claudiapizzo29@outlook.it",
        "tatianacardinale@icloud.com", "giovannaMelignano@gmail.com",
        "giorgia.greco1495@gmail.com", "graziamaruikarusso@gmail.com",
        "chiaralionetti98@gmail.com", "rachele.impastato@gmail.com",
        "loredana.pillitteri@hotmail.it", "saitta.es@libero.it",
        "seficar@hotmail.it", "marziabarone34@gmail.com",
    }

print(f"Email GGT note da escludere: {len(KNOWN_GGT)}")

# ── Scarica TUTTE le email da Resend ─────────────────────────────────────────
print(f"\n{BOLD}Scarico tutte le email da Resend...{W}")

all_emails = []
offset = 0
LIMIT = 100

while True:
    url = f"https://api.resend.com/emails?limit={LIMIT}&offset={offset}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {RESEND_KEY}",
            "Content-Type": "application/json",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
            batch = data.get("data", [])
            if not batch:
                break
            all_emails.extend(batch)
            print(f"  Scaricati {len(all_emails)} email totali...", end="\r")
            if len(batch) < LIMIT:
                break
            offset += LIMIT
            time.sleep(0.3)
    except urllib.error.HTTPError as e:
        print(f"\n{R}❌ Errore Resend API {e.code}: {e.read().decode()[:200]}{W}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{R}❌ Errore: {e}{W}")
        break

print(f"\n{G}✅ Totale email scaricate: {len(all_emails)}{W}")

# ── Filtra: tieni solo email di iscrizione/credenziali ───────────────────────
SCHOOL_KEYWORDS = [
    "girogirotondo", "magico mondo", "benvenuto", "credenziali",
    "scuola", "password", "accesso", "iscrizione", "registrazione"
]

school_emails = []
for e in all_emails:
    subject = (e.get("subject") or "").lower()
    frm     = (e.get("from") or "").lower()
    if any(kw in subject or kw in frm for kw in SCHOOL_KEYWORDS):
        school_emails.append(e)

if not school_emails:
    # Se nessun filtro trova nulla, prendi TUTTE le email
    print(f"{Y}⚠️  Nessuna email scuola trovata con i filtri. Uso tutte le {len(all_emails)} email.{W}")
    school_emails = all_emails

print(f"Email scuola trovate: {len(school_emails)}")

# ── Estrai destinatari unici ──────────────────────────────────────────────────
all_recipients = {}  # email → {subject, date}
for e in school_emails:
    to_list = e.get("to", []) or []
    if isinstance(to_list, str):
        to_list = [to_list]
    for addr in to_list:
        addr = addr.lower().strip()
        if addr and "@" in addr:
            if addr not in all_recipients:
                all_recipients[addr] = {
                    "email":   addr,
                    "subject": e.get("subject", ""),
                    "date":    e.get("created_at", "")[:10],
                    "from":    e.get("from", ""),
                }

print(f"Destinatari unici totali: {len(all_recipients)}")

# ── Separa GGT da MM ──────────────────────────────────────────────────────────
mm_candidates = {}
ggt_confirmed = {}

for addr, info in all_recipients.items():
    if addr in KNOWN_GGT or addr.endswith("@girogirotondo.it") or addr.endswith("@magicomondo.it"):
        ggt_confirmed[addr] = info
    else:
        mm_candidates[addr] = info

print(f"\n{BOLD}Risultati:{W}")
print(f"  {G}✅ Email GGT confermate: {len(ggt_confirmed)}{W}")
print(f"  {B}🎯 Candidati Il Magico Mondo: {len(mm_candidates)}{W}")

# ── Stampa candidati MM ───────────────────────────────────────────────────────
print(f"\n{BOLD}{B}{'═'*60}")
print(f"  FAMIGLIE IL MAGICO MONDO — {len(mm_candidates)} trovate")
print(f"{'═'*60}{W}")

mm_list = sorted(mm_candidates.values(), key=lambda x: x["date"])
for i, info in enumerate(mm_list, 1):
    print(f"  {i:>3}. {info['email']:<42} {info['date']}")

# ── Salva risultati ───────────────────────────────────────────────────────────
output = {
    "mm_families":    mm_list,
    "ggt_confirmed":  list(ggt_confirmed.values()),
    "total_emails":   len(all_emails),
    "school_emails":  len(school_emails),
}

out_file = Path(__file__).parent / "famiglie_mm_trovate.json"
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\n{G}✅ Risultati salvati in famiglie_mm_trovate.json{W}")

# ── Genera script iscrizione MM ───────────────────────────────────────────────
if mm_candidates:
    script = '''#!/usr/bin/env python3
"""
ISCRIZIONE FAMIGLIE IL MAGICO MONDO
Generato automaticamente da trova_famiglie_mm.py
COMPLETA i campi COGNOME e CLASSE prima di eseguire!
"""
import requests, time, sys
BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE = "il-magico-mondo"
r = requests.post(f"{BASE}/auth/login",
    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
    headers={"X-Sede-Id": SEDE})
TOKEN = r.json().get("token") or r.json().get("access_token")
if not TOKEN: sys.exit("Login fallito")
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}

# Recupera classi esistenti
classes = requests.get(f"{BASE}/classes", headers=H).json()
print("Classi disponibili:", [c["name"] for c in classes])

# ── FAMIGLIE TROVATE VIA RESEND ──────────────────────────────────────────────
# COMPLETA: "NOME_BAMBINO", "COGNOME", "CLASSE_NAME", "NOME_GENITORE"
# La classe deve corrispondere a una delle classi elencate sopra
FAMIGLIE = [
'''
    for info in mm_list:
        script += f'    # Email: {info["email"]} — ricevuta il {info["date"]}\n'
        script += f'    ("NOME_BAMBINO", "COGNOME", "{info["email"]}", "NOME_GENITORE", "NOME_CLASSE"),\n'

    script += ''']

def find_class(name):
    return next((c["id"] for c in classes if name.lower() in c["name"].lower()), None)

ok = fail = 0
for nome, cognome, email, genitore, classe_name in FAMIGLIE:
    if nome == "NOME_BAMBINO":
        print(f"⏭  {email} — DATI DA COMPLETARE"); continue
    class_id = find_class(classe_name)
    if not class_id:
        print(f"❌ Classe '{classe_name}' non trovata"); fail += 1; continue
    r = requests.post(f"{BASE}/users/iscrizione", headers=H, json={
        "bambino_nome": nome, "bambino_cognome": cognome,
        "class_id": class_id, "sede_id": SEDE,
        "genitore_email": email, "genitore_nome": genitore,
        "skip_email": True,
    })
    if r.status_code == 201:
        print(f"✅ {nome} {cognome}"); ok += 1
    else:
        print(f"❌ {nome} {cognome}: {r.json().get('detail','')}"); fail += 1
    time.sleep(0.3)

print(f"\\n✅ {ok} iscritti  ❌ {fail} falliti")
'''

    script_file = Path(__file__).parent / "iscrivi_mm_da_completare.py"
    with open(script_file, "w") as f:
        f.write(script)
    print(f"{G}✅ Script base generato: iscrivi_mm_da_completare.py{W}")
    print(f"\n{BOLD}PROSSIMI PASSI:{W}")
    print(f"  1. Apri iscrivi_mm_da_completare.py")
    print(f"  2. Per ogni email trovata, inserisci: nome bambino, cognome, nome genitore, classe")
    print(f"  3. Esegui: python3 iscrivi_mm_da_completare.py")
else:
    print(f"\n{Y}Nessun candidato MM trovato. Possibili cause:")
    print(f"  - La RESEND_API_KEY non è quella corretta")
    print(f"  - Le email erano inviate da un account diverso")
    print(f"  - I dati non erano mai stati inseriti{W}")
