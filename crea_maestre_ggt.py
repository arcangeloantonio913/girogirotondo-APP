#!/usr/bin/env python3
"""
Crea le 6 maestre di Girogirotondo e le assegna ESATTAMENTE alla loro classe.
Usa $set (non $addToSet) per evitare accumulo di class_ids errati.
Se la maestra esiste già, aggiorna solo l'assegnazione di classe.
"""
import requests, sys, time, random, string

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE = "girogirotondo"

def gen_pwd():
    chars = string.ascii_letters + string.digits + "!@#$"
    return ''.join(random.choices(chars, k=10))

print("🔐 Login...")
r = requests.post(f"{BASE}/auth/login",
    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
    headers={"X-Sede-Id": SEDE})
TOKEN = r.json().get("token") or r.json().get("access_token")
if not TOKEN: print("❌ Login fallito:", r.json()); sys.exit(1)
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}
print("✅ Login OK\n")

# Carica dati esistenti
classes  = requests.get(f"{BASE}/classes",  headers=H).json()
users    = requests.get(f"{BASE}/users",    headers=H).json()
students = requests.get(f"{BASE}/students", headers=H).json()

def find_class(name):
    return next((c for c in classes if c["name"].lower() == name.lower()), None)

def find_teacher(email):
    return next((u for u in users if u["email"] == email), None)

# ── Mappatura maestre → classi (dalle foto) ───────────────────────────────────
MAESTRE = [
    ("Giorgia",    "Greco",      "giorgia.greco1495@gmail.com",    "Pesciolini"),
    ("Rachele",    "Impastato",  "zachele.impastato@gmail.com",    "Colorandia"),
    ("Chiara",     "Lionetti",   "chiaralionetti.98@gmail.com",    "Pulcini"),
    ("Marika",     "Russo",      "graziamarukarusso@gmail.com",    "Tigrotti"),
    ("Elisabetta", "Saitta",     "saitta.es@libero.it",            "I Infanzia"),
    ("Marzia",     "Barone",     "marziabarone34@gmail.com",       "II Infanzia"),
]

print("="*60)
print("👩‍🏫 CREAZIONE + ASSEGNAZIONE MAESTRE GIROGIROTONDO")
print("="*60)

results = []
for nome, cognome, email, classe_nome in MAESTRE:
    cls = find_class(classe_nome)
    if not cls:
        print(f"  ❌ {nome} {cognome}: classe '{classe_nome}' non trovata!")
        results.append((nome, cognome, "CLASSE NON TROVATA", 0))
        continue

    alunni = [s for s in students if s.get("class_id") == cls["id"]]
    teacher = find_teacher(email)
    pwd = gen_pwd()

    if teacher:
        teacher_id = teacher["id"]
        print(f"  ℹ️  {nome} {cognome}: account già esistente → aggiorno assegnazione")
    else:
        # Crea account maestra
        r = requests.post(f"{BASE}/users", headers=H, json={
            "name": nome, "cognome": cognome,
            "email": email, "password": pwd,
            "role": "teacher", "sede_id": SEDE,
            "class_ids": [cls["id"]], "class_id": cls["id"],
        })
        if r.status_code != 201:
            print(f"  ❌ {nome} {cognome}: creazione fallita {r.status_code} {r.json().get('detail','')}")
            results.append((nome, cognome, "ERRORE CREAZIONE", 0))
            continue
        teacher_id = r.json()["id"]
        print(f"  ✅ {nome} {cognome} creata — pwd: {pwd}")

    # Imposta class_ids = ESATTAMENTE [cls["id"]] via PUT (non $addToSet!)
    r2 = requests.put(f"{BASE}/users/{teacher_id}", headers=H, json={
        "class_ids": [cls["id"]],
        "class_id":  cls["id"],
    })

    # Imposta teacher_id sulla classe
    r3 = requests.patch(f"{BASE}/classes/{cls['id']}", headers=H,
                        json={"teacher_id": teacher_id})

    if r2.status_code == 200 and r3.status_code == 200:
        print(f"  ✅ {nome} {cognome} → {classe_nome} ({len(alunni)} alunni) ✓")
        results.append((nome, cognome, classe_nome, len(alunni)))
    else:
        print(f"  ⚠️  {nome} {cognome}: assegnazione parziale (PUT:{r2.status_code} PATCH:{r3.status_code})")
        results.append((nome, cognome, f"{classe_nome} ⚠️", len(alunni)))

    time.sleep(0.3)

print(f"\n{'='*60}")
print("📊 VERIFICA FINALE")
print("="*60)
# Ricarica per verifica
classes2  = requests.get(f"{BASE}/classes",  headers=H).json()
users2    = requests.get(f"{BASE}/users",    headers=H).json()
students2 = requests.get(f"{BASE}/students", headers=H).json()
teachers2 = [u for u in users2 if u.get("role") == "teacher"]

for t in teachers2:
    cids = list(t.get("class_ids") or [])
    visible = [s for s in students2 if s.get("class_id") in cids]
    cls_nomi = [c["name"] for c in classes2 if c["id"] in cids]
    status = f"✅ {', '.join(cls_nomi)} ({len(visible)} alunni)" if cids else "❌ nessuna classe"
    print(f"  👩‍🏫 {t['name']:<28} → {status}")

print("="*60)
