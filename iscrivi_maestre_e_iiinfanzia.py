#!/usr/bin/env python3
"""
Script — Sede Girogirotondo:
  1. Crea account maestre e le assegna alle classi
  2. Crea classe II Infanzia con maestra Marzia Barone
  3. Registra bambini di II Infanzia

Maestre e classi:
  Giorgia Greco       → Pesciolini
  Rachele Impastato   → Colorandia
  Chiara Lionetti     → Pulcini
  Marika Russo        → Tigrotti
  Elisabetta Saitta   → I Infanzia
  Marzia Barone       → II Infanzia (nuova classe)

Note:
  - Celeste Cannarata: fratella di Tommaso (Tigrotti) e Antonio (I Infanzia) → sibling mode
  - Natan Ricchiari: email genitore mancante → inserire manualmente
  - Rebecca Gennaro: email genitore mancante → inserire manualmente
  - Johan Fusco: barrato nella lista originale → saltato

Uso: python3 iscrivi_maestre_e_iiinfanzia.py
"""
import requests, time, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE = "girogirotondo"

print("🔐 Login...")
r = requests.post(f"{BASE}/auth/login",
    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
    headers={"X-Sede-Id": SEDE})
TOKEN = r.json().get("token") or r.json().get("access_token")
if not TOKEN: print("❌ Login fallito:", r.json()); sys.exit(1)
print("✅ Login OK\n")

H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}

import random, string
def gen_pwd(): return ''.join(random.choices(string.ascii_letters + string.digits + "!@#$", k=10))

# ── Carica classi esistenti ───────────────────────────────────────────────────
print("📚 Carico classi esistenti...")
classes = requests.get(f"{BASE}/classes", headers=H).json()
def find_class(name):
    n = name.lower()
    return next((c for c in classes if c["name"].lower() == n), None)

# ── 1. Crea classe II Infanzia ────────────────────────────────────────────────
print("\n📚 Creo classe II Infanzia...")
r = requests.post(f"{BASE}/classes", json={"name": "II Infanzia"}, headers=H)
if r.status_code == 201:
    II_INFANZIA_ID = r.json()["id"]
    classes.append(r.json())
    print(f"✅ II Infanzia creata — ID: {II_INFANZIA_ID}")
else:
    existing = find_class("II Infanzia")
    if existing:
        II_INFANZIA_ID = existing["id"]
        print(f"ℹ️  Esiste già — ID: {II_INFANZIA_ID}")
    else:
        print(f"❌ Errore: {r.status_code} {r.text[:60]}"); sys.exit(1)

# Ricarica classi
classes = requests.get(f"{BASE}/classes", headers=H).json()

# ── 2. Crea maestre + assegna classi ─────────────────────────────────────────
MAESTRE = [
    # (nome, cognome, email, classe_da_assegnare)
    ("Giorgia",      "Greco",       "giorgia.greco1495@gmail.com",    "Pesciolini"),
    ("Rachele",      "Impastato",   "zachele.impastato@gmail.com",    "Colorandia"),
    ("Chiara",       "Lionetti",    "chiaralionetti.98@gmail.com",    "Pulcini"),
    ("Marika",       "Russo",       "graziamarukarusso@gmail.com",    "Tigrotti"),
    ("Elisabetta",   "Saitta",      "saitta.es@libero.it",            "I Infanzia"),
    ("Marzia",       "Barone",      "marziabarone34@gmail.com",       "II Infanzia"),
]

print(f"\n👩‍🏫 Creazione {len(MAESTRE)} maestre...")
teacher_ok = 0
for nome, cognome, email, classe_nome in MAESTRE:
    pwd = gen_pwd()
    # Cerca classe target
    target_cls = find_class(classe_nome)
    if not target_cls:
        print(f"  ⚠️  {nome} {cognome}: classe '{classe_nome}' non trovata!")
        continue

    # Crea account maestra
    r = requests.post(f"{BASE}/users", headers=H, json={
        "name":      nome,
        "cognome":   cognome,
        "email":     email,
        "password":  pwd,
        "role":      "teacher",
        "sede_id":   SEDE,
        "class_ids": [target_cls["id"]],
        "class_id":  target_cls["id"],
    })
    if r.status_code == 201:
        teacher_id = r.json()["id"]
        print(f"  ✅ {nome} {cognome} ({email}) — pwd: {pwd}")

        # Assegna maestra alla classe via PATCH
        r2 = requests.patch(f"{BASE}/classes/{target_cls['id']}",
            headers=H, json={"teacher_id": teacher_id})
        if r2.status_code == 200:
            print(f"     → Assegnata a '{classe_nome}' ✅")
            teacher_ok += 1
        else:
            print(f"     → Assegnazione fallita: {r2.status_code} {r2.text[:60]}")
    elif "già in uso" in r.text or "already" in r.text.lower():
        print(f"  ℹ️  {nome} {cognome}: account già esistente, assegno solo alla classe")
        users = requests.get(f"{BASE}/users", headers=H).json()
        t = next((u for u in users if u["email"] == email), None)
        if t:
            r2 = requests.patch(f"{BASE}/classes/{target_cls['id']}",
                headers=H, json={"teacher_id": t["id"]})
            print(f"     → {'Assegnata ✅' if r2.status_code == 200 else 'Assegnazione fallita'}")
            teacher_ok += 1
    else:
        print(f"  ❌ {nome} {cognome}: {r.status_code} {r.json().get('detail', r.text[:60])}")
    time.sleep(0.4)

print(f"\n✔ Maestre create/aggiornate: {teacher_ok}/{len(MAESTRE)}")

# ── 3. Bambini II Infanzia ────────────────────────────────────────────────────
II_INFANZIA_BAMBINI = [
    # (nome, cognome, email_genitore, nome_genitore)
    ("Alejandro",  "Corrao",       "alexandra-17@live.it",           "Alexandra Giacalone"),
    ("Natalia",    "Gradino",      "gradinoalessandro@gmail.com",    "Frontini Chiara"),
    # Natan Ricchiari → email mancante: SALTATO
    ("Ambra",      "Costantino",   "giuliapistone52@gmail.com",      "Pistone Giulia"),
    ("Ginevra",    "Fricano",      "gagiorlando@gmail.com",          "Giorlando Gaia"),
    ("Ludovica",   "Di Liberto",   "giambona-francesca@libero.it",   "Giambona Francesca"),
    ("Noemi",      "Macaluso",     "devidbmw.dm@gmail.com",          "Li Mandi Marzia"),
    # Celeste Cannarata → SIBLING: Lo Cascio Dalila ha già Tommaso (Tigrotti) e Antonio (I Infanzia)
    ("Celeste",    "Cannarata",    "dalila.locascio@yahoo.it",       "Lo Cascio Dalila"),
    ("Gioele",     "Macchiarella", "rosaliaings89@libero.it",        "Ingraffia Rosalia"),
    # Rebecca Gennaro → email mancante: SALTATA
    ("Noemi",      "Fecarotta",    "alessandrapisani@outlook.com",   "Pisani Alessandra"),
    ("Isabella",   "Pantaleo",     "roberto@islafood.it",            "Schiopu Mihaela"),
]

print(f"\n👶 Iscrizione {len(II_INFANZIA_BAMBINI)} bambini in II Infanzia...")
ok = fail = 0
for nome, cognome, email, genitore in II_INFANZIA_BAMBINI:
    r = requests.post(f"{BASE}/users/iscrizione", headers=H, json={
        "bambino_nome": nome, "bambino_cognome": cognome,
        "class_id":     II_INFANZIA_ID, "sede_id": SEDE,
        "genitore_email": email, "genitore_nome": genitore,
    })
    if r.status_code == 201:
        data = r.json()
        sibling = " [fratello/sorella]" if data.get("sibling_added") else ""
        print(f"  ✅ {nome} {cognome}{sibling}")
        ok += 1
    else:
        err = r.json().get("detail", r.text[:60])
        print(f"  ❌ {nome} {cognome} — {err}")
        fail += 1
    time.sleep(0.3)

print(f"\n{'='*60}")
print(f"🏁 RIEPILOGO FINALE")
print(f"   👩‍🏫 Maestre create/assegnate: {teacher_ok}/{len(MAESTRE)}")
print(f"   👶 Bambini II Infanzia:       ✅ {ok}  ❌ {fail}")
print(f"\nℹ️  Da inserire manualmente (email mancante):")
print(f"   • Natan Ricchiari (II Infanzia) — genitore: Croce Debora")
print(f"   • Rebecca Gennaro (II Infanzia) — genitore: Di Maggio Roberta")
print(f"{'='*60}")
