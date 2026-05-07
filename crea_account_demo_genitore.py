#!/usr/bin/env python3
"""
Crea un account demo per le dirigenti — genitore con DUE figli
per mostrare la funzione di selezione bambino.

Credenziali create:
  Email: demo.famiglia@gmail.com
  Password: Demo2026!

Bambini:
  - Sofia Demo → classe Pesciolini
  - Marco Demo → classe Tigrotti (stesso genitore → sibling mode)
"""
import requests, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE = "girogirotondo"

print("🔐 Login...")
r = requests.post(f"{BASE}/auth/login",
    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
    headers={"X-Sede-Id": SEDE})
TOKEN = r.json().get("token") or r.json().get("access_token")
if not TOKEN: print("❌ Login fallito:", r.json()); sys.exit(1)
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}

# Trova classi Pesciolini e Tigrotti
classes = requests.get(f"{BASE}/classes", headers=H).json()
def find(name):
    return next((c for c in classes if name.lower() in c["name"].lower()), None)

pesciolini = find("Pesciolini")
tigrotti   = find("Tigrotti")

if not pesciolini or not tigrotti:
    print("⚠️  Classi non trovate. Classi disponibili:")
    for c in classes: print(f"   - {c['name']} (ID: {c['id']})")
    sys.exit(1)

print(f"✅ Pesciolini: {pesciolini['id']}")
print(f"✅ Tigrotti:   {tigrotti['id']}\n")

# Crea primo figlio (crea anche il genitore)
print("👶 Creo Sofia Demo (Pesciolini)...")
r1 = requests.post(f"{BASE}/users/iscrizione", headers=H, json={
    "bambino_nome": "Sofia",
    "bambino_cognome": "Demo",
    "class_id": pesciolini["id"],
    "sede_id": SEDE,
    "genitore_email": "demo.famiglia@gmail.com",
    "genitore_nome": "Famiglia Demo",
    "genitore_password": "Demo2026!",
})
if r1.status_code == 201:
    print(f"  ✅ Sofia registrata — genitore creato")
else:
    print(f"  ❌ {r1.status_code} {r1.json()}")
    sys.exit(1)

# Crea secondo figlio (stessa email → sibling mode)
print("👶 Creo Marco Demo (Tigrotti) — stesso genitore...")
r2 = requests.post(f"{BASE}/users/iscrizione", headers=H, json={
    "bambino_nome": "Marco",
    "bambino_cognome": "Demo",
    "class_id": tigrotti["id"],
    "sede_id": SEDE,
    "genitore_email": "demo.famiglia@gmail.com",  # stessa email → fratello/sorella
    "genitore_nome": "Famiglia Demo",
})
if r2.status_code == 201:
    data = r2.json()
    print(f"  ✅ Marco registrato — {'fratello aggiunto' if data.get('sibling_added') else 'OK'}")
else:
    print(f"  ❌ {r2.status_code} {r2.json()}")
    sys.exit(1)

print(f"""
{'='*50}
🎉 ACCOUNT DEMO CREATO!

📱 Entra su: https://www.girogirotondowebapp.it
📧 Email:    demo.famiglia@gmail.com
🔑 Password: Demo2026!

In alto nell'app appare il nome del figlio attivo.
Cliccaci sopra per passare dall'uno all'altro.
  → Sofia Demo (Pesciolini)
  → Marco Demo (Tigrotti)
{'='*50}
""")
