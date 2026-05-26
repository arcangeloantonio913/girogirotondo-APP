#!/usr/bin/env python3
"""
RIPRISTINO IL MAGICO MONDO — senza invio email
===============================================
Ripristina:
  1. Maestre Il Magico Mondo (con password originali)
  2. Classi Il Magico Mondo
  3. Bambini + genitori (senza inviare email — skip_email=True)

Uso:
    cd girogirotondo-APP
    pip3 install requests
    python3 iscrivi_magico_mondo.py
"""

import requests, time, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE = "il-magico-mondo"

# ── Login ─────────────────────────────────────────────────────────────────────
print("🔐 Login come Mariagrazia...")
r = requests.post(f"{BASE}/auth/login",
    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
    headers={"X-Sede-Id": SEDE})
data  = r.json()
TOKEN = data.get("token") or data.get("access_token")
if not TOKEN:
    print("❌ Login fallito:", data); sys.exit(1)
print("✅ Login OK\n")

H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; W = "\033[0m"; BOLD = "\033[1m"
total_ok = total_fail = 0

# ── Helper: crea o trova classe ────────────────────────────────────────────────
def get_or_create_class(nome, sede_id=SEDE):
    r = requests.post(f"{BASE}/classes",
        json={"name": nome, "sede_id": sede_id}, headers=H)
    if r.status_code == 201:
        cid = r.json()["id"]
        print(f"  {G}✅ Classe '{nome}' creata — {cid[:8]}...{W}")
        return cid
    # Già esiste — cerca tra le classi
    classes = requests.get(f"{BASE}/classes", headers=H).json()
    found = next((c for c in classes if c["name"].lower() == nome.lower()), None)
    if found:
        print(f"  {Y}ℹ️  '{nome}' già esistente{W}")
        return found["id"]
    print(f"  {R}❌ Impossibile creare/trovare '{nome}': {r.text[:60]}{W}")
    return None

# ── Helper: crea maestra ───────────────────────────────────────────────────────
def crea_maestra(nome, cognome, email, password, class_id=None):
    payload = {
        "name": nome, "cognome": cognome, "email": email,
        "password": password, "role": "teacher",
        "sede_id": SEDE,
    }
    if class_id:
        payload["class_id"] = class_id
        payload["class_ids"] = [class_id]
    r = requests.post(f"{BASE}/users", json=payload, headers=H)
    if r.status_code == 201:
        print(f"  {G}✅ Maestra {nome} {cognome} — {email}{W}")
        return r.json().get("id")
    err = r.json().get("detail", r.text[:60])
    if "già in uso" in err.lower() or "already" in err.lower():
        print(f"  {Y}ℹ️  {nome} {cognome} già presente{W}")
        users = requests.get(f"{BASE}/users", headers=H).json()
        found = next((u for u in users if u["email"].lower() == email.lower()), None)
        return found["id"] if found else None
    print(f"  {R}❌ {nome} {cognome}: {err}{W}")
    return None

# ── Helper: assegna maestra a classe ──────────────────────────────────────────
def assegna_maestra(class_id, teacher_id):
    if not class_id or not teacher_id:
        return
    r = requests.patch(f"{BASE}/classes/{class_id}",
        json={"teacher_id": teacher_id}, headers=H)
    if r.status_code != 200:
        print(f"  {Y}⚠️  Assegnazione fallita: {r.text[:60]}{W}")

# ── Helper: iscrivi bambino SENZA email ────────────────────────────────────────
def iscrivi_senza_email(nome, cognome, email, genitore, class_id, cognome_genitore=""):
    global total_ok, total_fail
    if not email:
        print(f"  {Y}⏭️  {nome} {cognome} — email mancante, saltato{W}")
        return
    r = requests.post(f"{BASE}/users/iscrizione", headers=H, json={
        "bambino_nome": nome,
        "bambino_cognome": cognome,
        "class_id": class_id,
        "sede_id": SEDE,
        "genitore_email": email,
        "genitore_nome": genitore,
        "skip_email": True,          # ← NO email di benvenuto
    })
    if r.status_code == 201:
        data = r.json()
        extra = " [fratello/sorella]" if data.get("sibling_added") else ""
        print(f"  {G}✅ {nome} {cognome}{extra}{W}")
        total_ok += 1
    else:
        err = r.json().get("detail", r.text[:60])
        if "già" in err.lower() or "already" in err.lower() or "esiste" in err.lower():
            print(f"  {Y}ℹ️  {nome} {cognome} già presente{W}")
            total_ok += 1
        else:
            print(f"  {R}❌ {nome} {cognome}: {err}{W}")
            total_fail += 1
    time.sleep(0.3)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — CLASSI IL MAGICO MONDO
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  STEP 1 — Classi Il Magico Mondo{W}")
print(f"{BOLD}{'═'*60}{W}\n")

print("📚 Creazione classi...")
ID_NIDO        = get_or_create_class("Nido Il Magico Mondo")
ID_GIARDINO    = get_or_create_class("Primavera Giardino delle Meraviglie")
ID_OCEANO      = get_or_create_class("Primavera Oceano Incantato")
ID_I_INF       = get_or_create_class("I Infanzia Il Magico Mondo")
ID_II_INF      = get_or_create_class("II Infanzia Il Magico Mondo")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — MAESTRE IL MAGICO MONDO
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  STEP 2 — Maestre Il Magico Mondo{W}")
print(f"{BOLD}{'═'*60}{W}\n")

print("👩‍🏫 Creazione account maestre...")
# Password da credenziali_staff.txt (seed_staff_reali.py)
ID_GABRIELLA = crea_maestra("Gabriella", "Franco",    "gabri.franco@hotmail.it",          "kxkRvMUChH", ID_NIDO)
ID_CLAUDIA   = crea_maestra("Claudia",   "Pizzo",     "claudiapizzo29@outlook.it",         "bobb9ErWmu", ID_GIARDINO)
ID_TATIANA   = crea_maestra("Tatiana",   "Cardinale", "tatianacardinale@icloud.com",        "pmwYcV0eR2", ID_OCEANO)

print("\n🔗 Assegnazione maestre alle classi...")
if ID_GABRIELLA: assegna_maestra(ID_NIDO,     ID_GABRIELLA); print(f"  {G}✅ Gabriella Franco → Nido{W}")
if ID_CLAUDIA:   assegna_maestra(ID_GIARDINO, ID_CLAUDIA);   print(f"  {G}✅ Claudia Pizzo → Giardino delle Meraviglie{W}")
if ID_TATIANA:   assegna_maestra(ID_OCEANO,   ID_TATIANA);   print(f"  {G}✅ Tatiana Cardinale → Oceano Incantato{W}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — BAMBINI IL MAGICO MONDO  (skip_email=True)
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────
# NIDO IL MAGICO MONDO
# (nome, cognome, email_genitore, nome_genitore)
# ─────────────────────────────────────────────────────────────────────────────
NIDO = [
    # Inserisci qui i bambini del Nido — formato:
    # ("Nome", "Cognome", "email@genitore.it", "Nome Genitore"),
]

# ─────────────────────────────────────────────────────────────────────────────
# PRIMAVERA GIARDINO DELLE MERAVIGLIE
# ─────────────────────────────────────────────────────────────────────────────
GIARDINO = [
    # Inserisci qui i bambini del Giardino
]

# ─────────────────────────────────────────────────────────────────────────────
# PRIMAVERA OCEANO INCANTATO
# ─────────────────────────────────────────────────────────────────────────────
OCEANO = [
    # Inserisci qui i bambini dell'Oceano
]

# ─────────────────────────────────────────────────────────────────────────────
# I INFANZIA IL MAGICO MONDO
# ─────────────────────────────────────────────────────────────────────────────
I_INFANZIA_MM = [
    # Inserisci qui i bambini della I Infanzia
]

# ─────────────────────────────────────────────────────────────────────────────
# II INFANZIA IL MAGICO MONDO
# ─────────────────────────────────────────────────────────────────────────────
II_INFANZIA_MM = [
    # Inserisci qui i bambini della II Infanzia
]

# ── Iscrizione bambini ─────────────────────────────────────────────────────────
sezioni = [
    (NIDO,          ID_NIDO,        "Nido Il Magico Mondo"),
    (GIARDINO,      ID_GIARDINO,    "Primavera Giardino delle Meraviglie"),
    (OCEANO,        ID_OCEANO,      "Primavera Oceano Incantato"),
    (I_INFANZIA_MM, ID_I_INF,       "I Infanzia Il Magico Mondo"),
    (II_INFANZIA_MM,ID_II_INF,      "II Infanzia Il Magico Mondo"),
]

bambini_totali = sum(len(s[0]) for s in sezioni)

if bambini_totali == 0:
    print(f"\n{Y}{'═'*60}{W}")
    print(f"{Y}  ⚠️  NESSUN BAMBINO INSERITO NELLO SCRIPT{W}")
    print(f"{Y}{'═'*60}{W}")
    print(f"\n  Apri il file  iscrivi_magico_mondo.py  e aggiungi i")
    print(f"  bambini nelle sezioni NIDO, GIARDINO, OCEANO, ecc.")
    print(f"\n  Formato di ogni bambino:")
    print(f'  ("Nome", "Cognome", "email@genitore.it", "Nome Genitore"),')
    print(f"\n  Poi riesegui: python3 iscrivi_magico_mondo.py")
else:
    print(f"\n{BOLD}{'═'*60}{W}")
    print(f"{BOLD}  STEP 3 — Bambini Il Magico Mondo (senza email){W}")
    print(f"{BOLD}{'═'*60}{W}\n")

    for bambini, class_id, nome_sezione in sezioni:
        if not bambini:
            continue
        if not class_id:
            print(f"  {R}❌ Salto {nome_sezione}: classe non trovata{W}")
            continue
        print(f"\n👶 {nome_sezione} ({len(bambini)} bambini)...")
        for nome, cognome, email, genitore in bambini:
            iscrivi_senza_email(nome, cognome, email, genitore, class_id)

# ── RIEPILOGO ──────────────────────────────────────────────────────────────────
print(f"\n{BOLD}{'═'*60}{W}")
print(f"{BOLD}  RIEPILOGO{W}")
print(f"{BOLD}{'═'*60}{W}")
print(f"\n  {G}✅ Classi create/trovate: 5{W}")
print(f"  {G}✅ Maestre create/trovate: 3{W}")
if bambini_totali > 0:
    print(f"  {G}✅ Bambini iscritti: {total_ok}{W}")
    if total_fail:
        print(f"  {Y}⚠️  Falliti: {total_fail}{W}")
    print(f"  {G}📵 Email NON inviate (skip_email=True){W}")
else:
    print(f"  {Y}⚠️  Bambini: 0 (aggiungi i dati nello script){W}")

print(f"""
{BOLD}Maestre Il Magico Mondo:{W}
  Gabriella Franco    → Nido          (gabri.franco@hotmail.it / kxkRvMUChH)
  Claudia Pizzo       → Giardino      (claudiapizzo29@outlook.it / bobb9ErWmu)
  Tatiana Cardinale   → Oceano        (tatianacardinale@icloud.com / pmwYcV0eR2)

{BOLD}Per aggiungere bambini:{W}
  Apri iscrivi_magico_mondo.py e compila le liste NIDO, GIARDINO, OCEANO,
  I_INFANZIA_MM, II_INFANZIA_MM con i dati reali, poi riesegui lo script.
""")
