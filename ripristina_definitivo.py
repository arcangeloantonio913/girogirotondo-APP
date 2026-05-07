#!/usr/bin/env python3
"""
RIPRISTINO DEFINITIVO — Riassegna ogni maestra alla sua classe.

Girogirotondo: mappatura certa (dai nostri script di creazione maestre).
Il Magico Mondo: mostrate le classi e maestre per il redo dall'UI.

Uso: python3 ripristina_definitivo.py
"""
import requests, sys, time

BASE = "https://girogirotondo-app-production.up.railway.app/api"

def login():
    r = requests.post(f"{BASE}/auth/login",
        json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
        headers={"X-Sede-Id": "girogirotondo"})
    t = r.json().get("token") or r.json().get("access_token")
    if not t: print("❌ Login fallito:", r.json()); sys.exit(1)
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json", "X-Sede-Id": "girogirotondo"}

H = login()

# ── Carica tutto ───────────────────────────────────────────────────────────────
all_classes = []
all_teachers = []
for sede in ["girogirotondo", "il-magico-mondo"]:
    hh = dict(H); hh["X-Sede-Id"] = sede
    cls = requests.get(f"{BASE}/classes",  headers=hh).json()
    usr = requests.get(f"{BASE}/users",    headers=hh).json()
    all_classes.extend(cls)
    existing = {u["id"] for u in all_teachers}
    all_teachers.extend([u for u in usr if u.get("role")=="teacher" and u["id"] not in existing])
all_students = []
for sede in ["girogirotondo", "il-magico-mondo"]:
    hh = dict(H); hh["X-Sede-Id"] = sede
    sts = requests.get(f"{BASE}/students", headers=hh).json()
    existing = {s["id"] for s in all_students}
    all_students.extend([s for s in sts if s["id"] not in existing])

def find_class(name):
    n = name.lower()
    return next((c for c in all_classes if n in c["name"].lower()), None)

def find_teacher_by_email(email):
    return next((t for t in all_teachers if t["email"] == email), None)

# ── FASE 1: Pulisci TUTTI i class_ids di TUTTE le maestre ─────────────────────
print("="*65)
print("🧹 FASE 1 — Pulizia class_ids su tutte le maestre")
print("="*65)
for t in all_teachers:
    if t.get("class_ids") or t.get("class_id"):
        sede = t.get("sede_id", "girogirotondo")
        hh = dict(H); hh["X-Sede-Id"] = sede
        r = requests.put(f"{BASE}/users/{t['id']}", headers=hh,
                         json={"class_ids": [], "class_id": None})
        if r.status_code == 200:
            print(f"  🧹 {t['name']}: class_ids azzerati")

# Rimuovi teacher_id da TUTTE le classi
for cls in all_classes:
    if cls.get("teacher_id"):
        sede = cls.get("sede_id", "girogirotondo")
        hh = dict(H); hh["X-Sede-Id"] = sede
        requests.patch(f"{BASE}/classes/{cls['id']}", headers=hh,
                       json={"teacher_id": ""})

print("✅ Pulizia completata\n")

# ── FASE 2: Riassegna Girogirotondo (mappatura certa) ─────────────────────────
print("="*65)
print("🔧 FASE 2 — Riassegnazione Girogirotondo (mappatura certa)")
print("="*65)

# Mappa email_maestra → nome_classe (dai nostri script di creazione)
GGT_MAPPING = [
    ("giorgia.greco1495@gmail.com",   "Pesciolini"),
    ("zachele.impastato@gmail.com",   "Colorandia"),
    ("chiaralionetti.98@gmail.com",   "Pulcini"),
    ("graziamarukarusso@gmail.com",   "Tigrotti"),
    ("saitta.es@libero.it",           "I Infanzia"),
    ("marziabarone34@gmail.com",      "II Infanzia"),
]

ggt_ok = ggt_fail = 0
for email, classe_nome in GGT_MAPPING:
    teacher = find_teacher_by_email(email)
    cls     = find_class(classe_nome)
    if not teacher:
        print(f"  ⚠️  Maestra non trovata: {email}")
        ggt_fail += 1
        continue
    if not cls:
        print(f"  ⚠️  Classe non trovata: {classe_nome}")
        ggt_fail += 1
        continue

    hh = dict(H); hh["X-Sede-Id"] = "girogirotondo"
    r = requests.patch(f"{BASE}/classes/{cls['id']}", headers=hh,
                       json={"teacher_id": teacher["id"]})
    if r.status_code == 200:
        alunni = [s for s in all_students if s.get("class_id") == cls["id"]]
        print(f"  ✅ {teacher['name']:<28} → {classe_nome} ({len(alunni)} alunni)")
        ggt_ok += 1
    else:
        print(f"  ❌ {teacher['name']}: {r.status_code} {r.text[:60]}")
        ggt_fail += 1
    time.sleep(0.2)

print(f"\n✔ Girogirotondo: {ggt_ok} assegnate  ❌ {ggt_fail} fallite")

# ── FASE 3: Verifica Girogirotondo ────────────────────────────────────────────
print("\n📊 VERIFICA Girogirotondo:")
hh = dict(H); hh["X-Sede-Id"] = "girogirotondo"
ggt_classes  = requests.get(f"{BASE}/classes",  headers=hh).json()
ggt_teachers_fresh = [u for u in requests.get(f"{BASE}/users", headers=hh).json() if u.get("role")=="teacher"]
for cls in ggt_classes:
    t_name = next((t["name"] for t in ggt_teachers_fresh if t["id"] == cls.get("teacher_id")), "❌ NESSUNA MAESTRA")
    alunni = [s for s in all_students if s.get("class_id") == cls["id"]]
    print(f"  {cls['name']:<22} → {t_name:<28} ({len(alunni)} alunni)")

# ── Il Magico Mondo — lista per redo manuale ───────────────────────────────────
print(f"\n{'='*65}")
print("⚠️  IL MAGICO MONDO — Richiede assegnazione manuale dall'UI")
print("="*65)
hh = dict(H); hh["X-Sede-Id"] = "il-magico-mondo"
mm_classes  = requests.get(f"{BASE}/classes",  headers=hh).json()
mm_teachers = [u for u in requests.get(f"{BASE}/users", headers=hh).json() if u.get("role")=="teacher"]
mm_students = requests.get(f"{BASE}/students", headers=hh).json()

print("\nCLASSI:")
for cls in mm_classes:
    alunni = [s for s in mm_students if s.get("class_id") == cls["id"]]
    print(f"  • {cls['name']:<28} ({len(alunni)} alunni)")

print("\nMAESTRE:")
for t in mm_teachers:
    print(f"  • {t['name']:<28} ({t['email']})")

print(f"\n{'='*65}")
print("ISTRUZIONI per Il Magico Mondo:")
print("  1. Admin → seleziona sede 'Il Magico Mondo'")
print("  2. Gestione Classi → 'Gestisci' su ogni classe")
print("  3. 'Assegna maestra' → scegli la maestra corretta")
print("  4. Ripeti per ogni classe (5 classi, ~2 min)")
print("="*65)
