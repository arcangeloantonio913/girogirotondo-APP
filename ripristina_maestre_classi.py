#!/usr/bin/env python3
"""
RIPRISTINO — Sincronizza le class_ids di ogni maestra con le classi
in cui è effettivamente assegnata come insegnante (class.teacher_id).

Usa la classe come "fonte di verità":
  se class.teacher_id = TEACHER_ID → teacher.class_ids deve contenere class.id

Non tocca le classi, modifica solo i profili delle maestre.

Uso: python3 ripristina_maestre_classi.py
"""
import requests, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"

def login():
    r = requests.post(f"{BASE}/auth/login",
        json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
        headers={"X-Sede-Id": "girogirotondo"})
    t = r.json().get("token") or r.json().get("access_token")
    if not t: print("❌ Login fallito:", r.json()); sys.exit(1)
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json", "X-Sede-Id": "girogirotondo"}

H = login()

# Carica tutte le classi e tutti gli utenti (tutte le sedi)
all_classes = []
all_users   = []

for sede in ["girogirotondo", "il-magico-mondo"]:
    hh = dict(H); hh["X-Sede-Id"] = sede
    cls = requests.get(f"{BASE}/classes", headers=hh).json()
    usr = requests.get(f"{BASE}/users",   headers=hh).json()
    all_classes.extend(cls)
    # Evita duplicati utenti
    existing_ids = {u["id"] for u in all_users}
    all_users.extend(u for u in usr if u["id"] not in existing_ids)

teachers = [u for u in all_users if u.get("role") == "teacher"]
students = []
for sede in ["girogirotondo", "il-magico-mondo"]:
    hh = dict(H); hh["X-Sede-Id"] = sede
    sts = requests.get(f"{BASE}/students", headers=hh).json()
    existing_ids = {s["id"] for s in students}
    students.extend(s for s in sts if s["id"] not in existing_ids)

# Costruisce mappa teacher_id → [class_ids] dalla fonte di verità (classi)
teacher_to_classes = {}
for cls in all_classes:
    tid = cls.get("teacher_id")
    if tid:
        teacher_to_classes.setdefault(tid, []).append(cls["id"])

print("="*65)
print("📊 STATO ATTUALE")
print("="*65)
for t in teachers:
    current_cids = list(t.get("class_ids") or [])
    correct_cids  = teacher_to_classes.get(t["id"], [])
    class_names   = [c["name"] for c in all_classes if c["id"] in correct_cids]
    visible_now   = [s for s in students if s.get("class_id") in current_cids]
    visible_after = [s for s in students if s.get("class_id") in correct_cids]

    status = "✅ OK" if sorted(current_cids) == sorted(correct_cids) else "⚠️  DA CORREGGERE"
    print(f"\n  👩‍🏫 {t['name']:<25} {status}")
    print(f"     class_ids attuali:   {current_cids}")
    print(f"     class_ids corrette:  {correct_cids} ({', '.join(class_names) or 'nessuna'})")
    print(f"     Studenti ora:        {len(visible_now)}")
    print(f"     Studenti dopo fix:   {len(visible_after)}")

print(f"\n{'='*65}")
print("🔧 APPLICAZIONE FIX")
print("="*65)

fixed = skipped = errors = 0
for t in teachers:
    current_cids = list(t.get("class_ids") or [])
    correct_cids  = teacher_to_classes.get(t["id"], [])

    if sorted(current_cids) == sorted(correct_cids):
        print(f"  ✅ {t['name']}: già corretta — nessuna modifica")
        skipped += 1
        continue

    # Determina la sede della maestra per l'header
    sede = t.get("sede_id", "girogirotondo")
    hh = dict(H); hh["X-Sede-Id"] = sede

    # Aggiorna direttamente il campo class_ids via endpoint credentials
    # (usa PUT /users/{id} per aggiornare i campi)
    r = requests.put(f"{BASE}/users/{t['id']}", headers=hh, json={
        "class_ids": correct_cids,
        "class_id":  correct_cids[0] if correct_cids else None,
    })
    if r.status_code == 200:
        class_names = [c["name"] for c in all_classes if c["id"] in correct_cids]
        print(f"  ✅ {t['name']}: class_ids aggiornate → {class_names or ['nessuna']}")
        fixed += 1
    else:
        print(f"  ❌ {t['name']}: {r.status_code} {r.text[:80]}")
        errors += 1

print(f"\n{'='*65}")
print(f"🏁 RIEPILOGO: ✅ {fixed} fixate  ⏭ {skipped} già OK  ❌ {errors} errori")

# Verifica finale
print(f"\n📊 VERIFICA FINALE — ogni maestra vede:")
all_users_fresh = []
for sede in ["girogirotondo", "il-magico-mondo"]:
    hh = dict(H); hh["X-Sede-Id"] = sede
    usr = requests.get(f"{BASE}/users", headers=hh).json()
    existing = {u["id"] for u in all_users_fresh}
    all_users_fresh.extend(u for u in usr if u["id"] not in existing)
teachers_fresh = [u for u in all_users_fresh if u.get("role") == "teacher"]
for t in teachers_fresh:
    cids = list(t.get("class_ids") or [])
    visible = [s for s in students if s.get("class_id") in cids]
    cls_names = [c["name"] for c in all_classes if c["id"] in cids]
    print(f"  👩‍🏫 {t['name']:<28} → {', '.join(cls_names) or 'nessuna classe'} ({len(visible)} studenti)")
print("="*65)
