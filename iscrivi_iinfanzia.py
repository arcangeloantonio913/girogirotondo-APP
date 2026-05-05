#!/usr/bin/env python3
"""
Script — Iscrizione TUTTI i bambini della Sezione I Infanzia (23 alunni)
Sede: Girogirotondo

Note:
  - Vittoria Aiello: email mancante → inserire manualmente
  - Emma Tona: email mancante → inserire manualmente
  - Adele Armetta: stessa genitore di Agnese Artetta (Frisco Stefania) → sibling mode

Uso: python3 iscrivi_iinfanzia.py
"""
import requests, time, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE = "girogirotondo"

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

# ── Crea classe I Infanzia ────────────────────────────────────────────────────
print("📚 Creazione classe I Infanzia...")
r = requests.post(f"{BASE}/classes", json={"name": "I Infanzia"}, headers=H)
if r.status_code == 201:
    CLASS_ID = r.json()["id"]
    print(f"✅ Classe 'I Infanzia' creata — ID: {CLASS_ID}\n")
else:
    # Potrebbe esistere già — cerca tra le classi
    classes = requests.get(f"{BASE}/classes", headers=H).json()
    found = next((c for c in classes if c["name"].lower() == "i infanzia"), None)
    if found:
        CLASS_ID = found["id"]
        print(f"ℹ️  Classe già esistente — ID: {CLASS_ID}\n")
    else:
        print(f"❌ Errore: {r.status_code} {r.text[:80]}"); sys.exit(1)

# ── TUTTI i bambini della Sezione I Infanzia ─────────────────────────────────
# (nome, cognome, email_genitore, nome_genitore)
# Pagina 1 (lista senza intestazione) + Pagina 2 (SEZIONE I INFANZIA)

I_INFANZIA = [
    # ── Pagina 1 ──────────────────────────────────────────────────────────────
    # Adele Armetta → stessa genitore (Frisco Stefania) di Agnese Artetta in Colorandia
    ("Adele",          "Armetta",      "emanuele.cormetta@studioaltanore.com",  "Frisco Stefania"),
    ("Paolo",          "Capogiri",     "capirex1998@hotmail.it",                "Lo Pinto Ilenia"),
    ("Francesco",      "Carollo",      "kikinamikasalvo91@hotmail.com",         "Di Rosi Francesca"),
    ("Sofia",          "Gruppuso",     "irene.porrovecchio@yahoo.it",           "Porrovecchio Irene"),
    ("Edoardo",        "Cuneo",        "maurizio.cuneo85@gmail.com",            "Drago Beatrice"),
    ("Gabriele",       "Cuneo",        "monicalocicero88@gmail.com",            "Lo Cicero Monica"),
    # Vittoria Aiello — email mancante: SALTATA
    ("Rita",           "Terenzio",     "costanzo.francy@virgilio.it",           "Costanzo Francesca"),
    ("Santiago",       "Gambino",      "eligius_94@live.it",                    "Giambona Veronica"),
    ("Mia",            "Drago",        "noemivella19@gmail.com",                "Vella Noemi"),
    ("Ambra",          "Davì",         "ivix89@hotmail.it",                     "Carnese Ivana"),

    # ── Pagina 2 (SEZIONE I INFANZIA) ─────────────────────────────────────────
    ("Carlo",          "Allegrini",    "antonio.allegrini@rai.it",              "Ingraffia Maria Antonia"),
    ("Leonardo",       "Arnone",       "maria.rita_taormina@hotmail.it",        "Taormina Maria Rita"),
    ("Sofia",          "Bologna",      "rafaellabertucci@hotmail.it",           "Bertucci Raffaella"),
    ("Alessia",        "Cusimano",     "twinsalvo2015@gmail.com",               "Sollano Carmelia"),
    ("Marco",          "Lo Iacono",    "vanessa3083@icloud.com",                "Valenza Vanessa"),
    ("Anna",           "Messina",      "valiv_1987@hotmail.it",                 "Di Maio Valentina"),
    ("Alison",         "Pilato",       "rosario_pilato91@hotmail.it",           "Pilato Rosaria"),
    ("Antonio",        "Cannarata",    "dalia.locascio@yahoo.it",               "Lo Cascio Dalia"),
    ("Leonardo",       "Ponisch",      "giu_li91@hotmail.it",                   "Tutone Giulia"),
    ("Edoardo",        "Balsano",      "zittaroselia90@gmail.com",              "Rizzo Rosalia"),
    ("Matilde",        "Ia Fata",      "lafatasalvo@hotmail.it",                "La Venia Gilda"),
    # Emma Tona — email mancante: SALTATA
]

print(f"👶 Iscrizione {len(I_INFANZIA)} bambini in I Infanzia...\n")
ok = fail = 0
for nome, cognome, email, genitore in I_INFANZIA:
    r = requests.post(f"{BASE}/users/iscrizione", headers=H, json={
        "bambino_nome":  nome,
        "bambino_cognome": cognome,
        "class_id":      CLASS_ID,
        "sede_id":       SEDE,
        "genitore_email": email,
        "genitore_nome": genitore,
    })
    if r.status_code == 201:
        data   = r.json()
        sibling = " [fratello/sorella aggiunto]" if data.get("sibling_added") else ""
        print(f"  ✅ {nome} {cognome}{sibling}")
        ok += 1
    else:
        err = r.json().get("detail", r.text[:60])
        print(f"  ❌ {nome} {cognome} — {err}")
        fail += 1
    time.sleep(0.3)

print(f"\n{'='*55}")
print(f"🏁 Completato: ✅ {ok} iscritti  ❌ {fail} falliti")
print(f"ℹ️  Da inserire manualmente (email mancante):")
print(f"     • Vittoria Aiello — genitore: Billeci Francesca")
print(f"     • Emma Tona — genitore: Mazzotta Valeria")
print(f"{'='*55}")
