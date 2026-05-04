#!/usr/bin/env python3
"""
Script automatico — Iscrizione bambini Pesciolini e Tigrotti
Sede: Girogirotondo

Uso: python3 iscrivi_bambini.py
Requisiti: pip install requests
"""

import requests
import json
import time

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE_ID = "girogirotondo"

# ── Login ─────────────────────────────────────────────────────────────────────
print("🔐 Login come Mariagrazia...")
r = requests.post(f"{BASE}/auth/login",
    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
    headers={"X-Sede-Id": SEDE_ID})
data = r.json()
TOKEN = data.get("token") or data.get("access_token")
if not TOKEN:
    print("❌ ERRORE login:", data)
    exit(1)
print(f"✅ Login OK\n")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "X-Sede-Id": SEDE_ID,
}

# ── Crea classi ───────────────────────────────────────────────────────────────
def crea_classe(nome):
    r = requests.post(f"{BASE}/classes", json={"name": nome}, headers=HEADERS)
    if r.status_code == 201:
        cls = r.json()
        print(f"✅ Classe '{nome}' creata — ID: {cls['id']}")
        return cls["id"]
    else:
        print(f"⚠️  Classe '{nome}': {r.status_code} {r.text[:100]}")
        return None

print("📚 Creazione classi...")
ID_PESCIOLINI = crea_classe("Pesciolini")
ID_TIGROTTI   = crea_classe("Tigrotti")
print()

# ── Dati bambini ──────────────────────────────────────────────────────────────

PESCIOLINI = [
    # (nome, cognome, email_genitore, nome_genitore)
    ("Nathan",   "Trupia",    "vitalef82@tiscali.it",              "Francesca Vitale"),
    ("Mattia",   "Parisi",    "ilenia.consolo@gmail.com",           "Ilenia Consolo"),
    ("Amelia",   "Tranchina", "cracolicdalila@gmail.com",           "Dalila Maria Craccoli"),
    ("Matilde",  "Milani",    "giovanni.milani384@gmail.com",       "Valeria La Vardera"),
    ("Gabriele", "Taortina",  "rosyriccobono90@libero.it",          "Rosi Riccobono"),
    ("Bianca",   "Macaluso",  "paolomacaluso@gmail.com",            "Francesca Vichi"),
    ("Agnese",   "Artetta",   "emanuele.artetta@studioaltamo.com",  "Stefania Frisco"),
    ("Rosalia",  "Bondì",     "mari.ing.89@hotmail.it",             "Marina Ingrassia"),
    ("Alice",    "Viterbo",   "alessiac8870@hotmail.it",            "Alessia Cordaro"),
    ("Leonardo", "Castagna",  "luisa.martorana@libero.it",          "Luisa Martorana"),
    # Aurora Di Maggio — da inserire manualmente quando disponibile l'email
]

TIGROTTI = [
    ("Alessandro", "Puzzi Taortina", "maria.cristina.taortina@gmail.com",  "Maria Cristina Taortina"),
    ("Giovanni",   "Ragusa",          "gessicazito@hotmail.it",             "Gessica Zito"),
    ("Sofia",      "Rubino",          "carmelorubino24@gmail.com",          "Maria Elena Russo"),
    ("Mya Beatrice","Uscé",           "yasminlongo31@gmail.com",            "Maria Yasmin Longo"),
    ("Riccardo",   "Siino",           "peppe.g89@hotmail.com",              "Elisabetta Cilio"),
    ("Andrea",     "Varrica",         "margheritalobello@gmail.com",        "Margherita Lo Bello"),
    ("Tommaso",    "Cannarata",        "dalilalo.cascio@yahoo.it",           "Dalila Lo Cascio"),
    ("Giulia",     "Di Fiore",        "antoadridifiore@tim.it",             "Adriana Di Blasi"),
    ("Riccardo",   "Danì",            "esteraiello7@gmail.com",             "Ester Aiello"),
    ("Sofia",      "Gattuso",         "cristinabellaero@gmail.com",         "Maria Cristina Bellaera"),
    ("Mattia",     "Di Gaudio",       "digaudioalessandro91@gmail.com",     "Gessica Inserillo"),
    ("Matilde",    "Corrao",          "corraoalessandromarco@gmail.com",    "Marzia Benigno"),
]

# ── Iscrivi bambini ───────────────────────────────────────────────────────────

def iscrivi(bambini, class_id, nome_classe):
    print(f"👶 Iscrizione bambini classe {nome_classe} ({len(bambini)} bambini)...")
    ok, fail = 0, 0
    for nome, cognome, email, genitore in bambini:
        payload = {
            "bambino_nome":     nome,
            "bambino_cognome":  cognome,
            "class_id":         class_id,
            "sede_id":          SEDE_ID,
            "genitore_email":   email,
            "genitore_nome":    genitore,
        }
        r = requests.post(f"{BASE}/users/iscrizione", json=payload, headers=HEADERS)
        if r.status_code == 201:
            data = r.json()
            print(f"  ✅ {nome} {cognome} → genitore: {genitore} ({email})")
            ok += 1
        else:
            err = r.json().get("detail", r.text[:80])
            print(f"  ❌ {nome} {cognome} — ERRORE: {err}")
            fail += 1
        time.sleep(0.3)  # piccola pausa per non sovraccaricare
    print(f"  Completata {nome_classe}: {ok} ✅  {fail} ❌\n")
    return ok, fail

total_ok, total_fail = 0, 0

if ID_PESCIOLINI:
    ok, fail = iscrivi(PESCIOLINI, ID_PESCIOLINI, "Pesciolini")
    total_ok += ok; total_fail += fail
else:
    print("⚠️  Salto Pesciolini (classe non creata)")

if ID_TIGROTTI:
    ok, fail = iscrivi(TIGROTTI, ID_TIGROTTI, "Tigrotti")
    total_ok += ok; total_fail += fail
else:
    print("⚠️  Salto Tigrotti (classe non creata)")

print("=" * 50)
print(f"🏁 RIEPILOGO FINALE")
print(f"   ✅ Iscritti: {total_ok}")
print(f"   ❌ Falliti:  {total_fail}")
print(f"   ℹ️  Aurora Di Maggio (Pesciolini) — da inserire manualmente")
print("=" * 50)
