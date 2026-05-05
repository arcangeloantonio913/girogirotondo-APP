#!/usr/bin/env python3
"""
Script automatico — Iscrizione bambini Colorandia e Pulcini
Sede: Girogirotondo
Uso: python3 iscrivi_colorandia_pulcini.py
"""
import requests, time, sys

BASE   = "https://girogirotondo-app-production.up.railway.app/api"
SEDE   = "girogirotondo"

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

def crea_classe(nome):
    r = requests.post(f"{BASE}/classes", json={"name": nome}, headers=H)
    if r.status_code == 201:
        c = r.json(); print(f"✅ Classe '{nome}' — ID: {c['id']}"); return c["id"]
    print(f"⚠️  {nome}: {r.status_code} {r.text[:80]}"); return None

print("📚 Creazione classi...")
ID_COLORANDIA = crea_classe("Colorandia")
ID_PULCINI    = crea_classe("Pulcini")
print()

# ── COLORANDIA (22 bambini) ───────────────────────────────────────────────────
# (nome, cognome, email_genitore, nome_genitore)
COLORANDIA = [
    ("Leonardo",      "Scalisi",      "lorencoscalisi@yahoo.it",          "Cristina Cannamela"),
    ("Gabriele",      "Fontana",      "marco989mf@gmail.com",             "Elisabetta Favaloro"),
    ("Andrea",        "Taormina",     "chiara.988@hotmail.it",            "Chiara Puccio"),
    ("Soraya",        "Mendola",      "denisebaglione8@gmail.com",        "Denise Baglione"),
    ("Andres",        "Terrana",      "fonsy85@hotmail.it",               "Priscilla Parra"),
    ("Jasmine",       "Bellia",       "criejasmine@gmail.com",            "Miriam Rita Biondo"),
    ("Alessio",       "Messina",      "andyrons867@gmail.com",            "Paola Sciglio"),
    ("Livia",         "Sabella",      "consueloguarneri@gmail.com",       "Consuelo Guarneri"),
    ("Maria Chiara",  "Di Maggio",    "miticfrancy@live.it",              "Maria Angela Romeo"),
    ("Asia",          "Mannino",      "manninoluca1993@gmail.com",        "Gambino Maria Chiara"),
    ("Celeste",       "Gippetto",     "davide.gippetto@virgilio.it",      "Arianna Concetta Vassallo"),
    ("Francesco",     "Mannino",      "angeladrago1996@gmail.com",        "Angela Drago"),
    ("Sofia",         "Purpura",      "gambinogabriella@libero.it",       "Gambino Gabriella"),
    ("Mattia",        "Mendola",      "antonella.pecoraino132@gmail.com", "Pecoraino Antonina"),
    ("Gabriele",      "Piromalli",    "bruno1291@live.it",                "Panzera Alessia"),
    ("Nicole",        "Romeo",        "ale_1124@live.it",                 "Sergi Roberta"),
    ("Samuele",       "Amato",        "amatodomenico1987@icloud.com",     "Piromalli Fabiola"),
    # Diego Mannino — email mancante, da inserire manualmente
    ("Leonardo",      "Corso",        "scorso096@gmail.com",              "D'Antoni Martina"),
    ("Antonio",       "Maenza",       "mariomaeza@hotmail.com",           "Vassallo Giorgia"),
    ("Leonardo",      "Tanase",       "ancatanase85@gmail.com",           "Tanase Anca"),
    ("Riccardo",      "Lo Vasco",     "peppe.12.89@gmail.com",            "Florio Aurora"),
    ("Marco",         "Billeci",      "darioisola@hotmail.it",            "Spinò Valentina"),
]

# ── PULCINI (16 bambini) ──────────────────────────────────────────────────────
PULCINI = [
    ("Nicolò",        "Cirenga",      "mirella.89@hotmail.it",            "Occhipinti Maria"),
    ("Marco",         "Alessi",       "angeladmaio@gmail.com",            "Di Maio Angela"),
    ("Clara Silvia",  "Vassallo",     "maurizio.vassallo84@gmail.com",    "Todeshi Wana"),
    ("Anna",          "Messina",      "fedymiky21@gmail.com",             "Drago Federica"),
    ("Filippo Thiago","Pilato",       "rosariapilato91@hotmail.it",       "Pilato Rosaria"),
    ("Elisa",         "Guercio",      "serenity16f@hotmail.it",           "Nevoloso Antonina"),
    ("Kevin",         "Sola",         "bellone.200@gmail.com",            "Bellone Maria Concetta"),
    ("Giulio Antonino","D'Ambra",     "francesco.dambra88@gmail.com",     "Vassallo Giovanna"),
    ("Sofia",         "Rappa",        "salvuccio10@hotmail.it",           "Cuttitta Silvia"),
    ("Giulia",        "Caravello",    "gaetano.caravello@gmail.com",      "Bonanno Miriam"),
    ("Erica",         "Croce",        "zitapupella@gmail.com",            "Pupella Rita"),
    ("Ludovica",      "Anello",       "federicarappa1990@gmail.com",      "Rappa Federica"),
    ("Enea",          "Pannone",      "mattia-pannone@libero.it",         "Pannozzo Giorgia"),
    ("Nathan",        "Muratore",     "alessandromuratore49@gmail.com",   "Ragusa Jessica"),
    ("Geremia",       "Bertolino",    "difrancoalessandra2@gmail.com",    "Di Franco Alessandra"),
    ("Samuel",        "Chiaramonte",  "puccidenza1986@gmail.com",         "Puccio Providenza"),
]

def iscrivi(bambini, class_id, nome_classe):
    print(f"👶 Iscrizione {nome_classe} ({len(bambini)} bambini)...")
    ok = fail = 0
    for nome, cognome, email, genitore in bambini:
        r = requests.post(f"{BASE}/users/iscrizione", headers=H, json={
            "bambino_nome": nome, "bambino_cognome": cognome,
            "class_id": class_id, "sede_id": SEDE,
            "genitore_email": email, "genitore_nome": genitore,
        })
        if r.status_code == 201:
            print(f"  ✅ {nome} {cognome}")
            ok += 1
        else:
            err = r.json().get("detail", r.text[:60])
            print(f"  ❌ {nome} {cognome} — {err}")
            fail += 1
        time.sleep(0.3)
    print(f"  ✔ {nome_classe}: {ok} ok, {fail} falliti\n")
    return ok, fail

tok = tfail = 0
if ID_COLORANDIA:
    o, f = iscrivi(COLORANDIA, ID_COLORANDIA, "Colorandia"); tok+=o; tfail+=f
if ID_PULCINI:
    o, f = iscrivi(PULCINI, ID_PULCINI, "Pulcini"); tok+=o; tfail+=f

print("="*50)
print(f"🏁 Totale: ✅ {tok} iscritti  ❌ {tfail} falliti")
print("ℹ️  Da inserire manualmente: Diego Mannino (Colorandia) — email mancante")
print("="*50)
