#!/usr/bin/env python3
"""
Script — Iscrizione studenti aggiuntivi:
  - Colorandia (continuazione pagina 3)
  - Sezione I Infanzia (nuova classe)
Sede: Girogirotondo

Note:
  - Vittoria Aiello (Colorandia): email mancante → da inserire manualmente
  - Emma Tona (I Infanzia): email mancante → da inserire manualmente
  - Adele Armetta: stessa genitore di Agnese Artetta → modalità fratelli/sorelle attiva
  - Antonio Cannarata: possibile fratello di Tommaso Cannarata (Tigrotti), email simile

Uso: python3 iscrivi_colorandia_cont_iinfanzia.py
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

# ── Recupera le classi esistenti per trovare Colorandia ──────────────────────
print("📚 Recupero classi esistenti...")
classes_res = requests.get(f"{BASE}/classes", headers=H).json()
colorandia_id = next((c["id"] for c in classes_res if c["name"].lower() == "colorandia"), None)

if not colorandia_id:
    print("⚠️  Classe Colorandia non trovata — la creo adesso")
    r = requests.post(f"{BASE}/classes", json={"name": "Colorandia"}, headers=H)
    colorandia_id = r.json().get("id")
    print(f"✅ Colorandia creata — ID: {colorandia_id}")
else:
    print(f"✅ Colorandia trovata — ID: {colorandia_id}")

# Crea I Infanzia
r = requests.post(f"{BASE}/classes", json={"name": "I Infanzia"}, headers=H)
if r.status_code == 201:
    iinfanzia_id = r.json()["id"]
    print(f"✅ Classe 'I Infanzia' creata — ID: {iinfanzia_id}")
else:
    print(f"⚠️  I Infanzia: {r.status_code} {r.text[:60]}")
    iinfanzia_id = None

print()

# ── Dati ────────────────────────────────────────────────────────────────────

# Continuazione Colorandia (pagina 3 — 11 bambini, skip Vittoria Aiello email mancante)
COLORANDIA_CONT = [
    # (nome, cognome, email_genitore, nome_genitore)
    # NOTA: Adele Armetta + Agnese Artetta hanno stessa genitore → sibling mode automatico
    ("Adele",    "Armetta",    "emanuele.cormetta@studioaltanore.com",  "Frisco Stefania"),
    ("Paolo",    "Capogiri",   "capirex1998@hotmail.it",                "Lo Pinto Ilenia"),
    ("Francesco","Carollo",    "kikinamikasalvo91@hotmail.com",         "Di Rosi Francesca"),
    ("Sofia",    "Gruppuso",   "irene.porrovecchio@yahoo.it",           "Porrovecchio Irene"),
    ("Edoardo",  "Cuneo",      "maurizio.cuneo85@gmail.com",            "Drago Beatrice"),
    ("Gabriele", "Cuneo",      "monicalocicero88@gmail.com",            "Lo Cicero Monica"),
    # Vittoria Aiello — email mancante, da inserire manualmente
    ("Rita",     "Terenzio",   "costanzo.francy@virgilio.it",           "Costanzo Francesca"),
    ("Santiago", "Gambino",    "eligius_94@live.it",                    "Giambona Veronica"),
    ("Mia",      "Drago",      "noemivella19@gmail.com",                "Vella Noemi"),
    ("Ambra",    "Davì",       "ivix89@hotmail.it",                     "Carnese Ivana"),
]

# Sezione I Infanzia (12 bambini, skip Emma Tona email mancante)
I_INFANZIA = [
    ("Carlo",       "Allegrini", "antonio.allegrini@rai.it",          "Ingraffia Maria Antonia"),
    ("Leonardo",    "Arnone",    "maria.rita_taormina@hotmail.it",     "Taormina Maria Rita"),
    ("Sofia",       "Bologna",   "rafaellabertucci@hotmail.it",        "Bertucci Raffaella"),
    ("Alessia",     "Cusimano",  "twinsalvo2015@gmail.com",            "Sollano Carmelia"),
    ("Marco",       "Lo Iacono", "vanessa3083@icloud.com",             "Valenza Vanessa"),
    ("Anna",        "Messina",   "valiv_1987@hotmail.it",              "Di Maio Valentina"),
    ("Alison",      "Pilato",    "rosario_pilato91@hotmail.it",        "Pilato Rosaria"),
    # Antonio Cannarata — possibile fratello di Tommaso (Tigrotti) con email simile
    ("Antonio",     "Cannarata", "dalia.locascio@yahoo.it",            "Lo Cascio Dalia"),
    ("Leonardo",    "Ponisch",   "giu_li91@hotmail.it",                "Tutone Giulia"),
    ("Edoardo",     "Balsano",   "zittaroselia90@gmail.com",           "Rizzo Rosalia"),
    ("Matilde",     "Ia Fata",   "lafatasalvo@hotmail.it",             "La Venia Gilda"),
    # Emma Tona — email mancante, da inserire manualmente
]

def iscrivi(bambini, class_id, nome_classe):
    if not class_id:
        print(f"⚠️  Salto {nome_classe}: classe non trovata"); return 0, 0
    print(f"👶 Iscrizione {nome_classe} ({len(bambini)} bambini)...")
    ok = fail = 0
    for nome, cognome, email, genitore in bambini:
        r = requests.post(f"{BASE}/users/iscrizione", headers=H, json={
            "bambino_nome": nome, "bambino_cognome": cognome,
            "class_id": class_id, "sede_id": SEDE,
            "genitore_email": email, "genitore_nome": genitore,
        })
        if r.status_code == 201:
            data = r.json()
            extra = " [fratello/sorella aggiunto]" if data.get("sibling_added") else ""
            print(f"  ✅ {nome} {cognome}{extra}")
            ok += 1
        else:
            err = r.json().get("detail", r.text[:60])
            print(f"  ❌ {nome} {cognome} — {err}")
            fail += 1
        time.sleep(0.3)
    print(f"  ✔ {nome_classe}: {ok} ok, {fail} falliti\n")
    return ok, fail

tok = tfail = 0
o, f = iscrivi(COLORANDIA_CONT, colorandia_id, "Colorandia (continuazione)"); tok+=o; tfail+=f
o, f = iscrivi(I_INFANZIA,       iinfanzia_id,  "I Infanzia");                 tok+=o; tfail+=f

print("="*55)
print(f"🏁 Totale: ✅ {tok} iscritti  ❌ {tfail} falliti")
print("ℹ️  Da inserire manualmente:")
print("     • Vittoria Aiello (Colorandia) — email Billeci Francesca mancante")
print("     • Emma Tona (I Infanzia) — email Mazzotta Valeria mancante")
print("="*55)
