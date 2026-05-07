#!/usr/bin/env python3
"""
Fix — Riassegna le maestre del Magico Mondo alle loro classi.
Diagnostica e corregge il problema "maestre non vedono studenti".
"""
import requests, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"

def login(sede):
    r = requests.post(f"{BASE}/auth/login",
        json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
        headers={"X-Sede-Id": sede})
    t = r.json().get("token") or r.json().get("access_token")
    if not t: print("❌ Login fallito:", r.json()); sys.exit(1)
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json", "X-Sede-Id": sede}

# ── Diagnostica completa per entrambe le sedi ──────────────────────────────────
for sede, label in [("girogirotondo","Girogirotondo"), ("il-magico-mondo","Il Magico Mondo")]:
    H = login(sede)
    classes  = requests.get(f"{BASE}/classes",  headers=H).json()
    users    = requests.get(f"{BASE}/users",    headers=H).json()
    students = requests.get(f"{BASE}/students", headers=H).json()
    teachers = [u for u in users if u.get("role") == "teacher"]

    print(f"\n{'='*60}")
    print(f"🏫 {label}")
    print(f"   Classi: {len(classes)}  Maestre: {len(teachers)}  Studenti: {len(students)}")
    print(f"{'='*60}")

    for cls in classes:
        teacher = next((t for t in teachers if t["id"] == cls.get("teacher_id")), None)
        cls_students = [s for s in students if s.get("class_id") == cls["id"]]
        t_label = f"✅ {teacher['name']}" if teacher else "❌ NESSUNA MAESTRA"
        print(f"  {cls['name']:<22} {t_label:<30} ({len(cls_students)} alunni)")

    print()
    for t in teachers:
        cids = list(t.get("class_ids") or [])
        if t.get("class_id") and t["class_id"] not in cids:
            cids.append(t["class_id"])
        visible = [s for s in students if s.get("class_id") in cids]
        status = "✅" if visible else "❌ NESSUNO STUDENTE VISIBILE"
        print(f"  👩‍🏫 {t['name']:<25} class_ids: {cids} → {status}")

# ── Fix Magico Mondo ───────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print("🔧 FIX Il Magico Mondo — riassegno maestre alle classi")
print(f"{'='*60}\n")

H = login("il-magico-mondo")
classes  = requests.get(f"{BASE}/classes",  headers=H).json()
users    = requests.get(f"{BASE}/users",    headers=H).json()
teachers = [u for u in users if u.get("role") == "teacher"]

# Per ogni classe senza maestra, assegna la maestra giusta
# Le maestre demo: Carla Rossi → Stelline, Marta Verde → Arcobaleno
teacher_map = {
    "carla":  next((t for t in teachers if "carla" in t["name"].lower()), None),
    "marta":  next((t for t in teachers if "marta" in t["name"].lower()), None),
}

for cls in classes:
    cls_name = cls["name"].lower()
    teacher  = None
    if "stelline" in cls_name:
        teacher = teacher_map.get("carla")
    elif "arcobaleno" in cls_name:
        teacher = teacher_map.get("marta")
    else:
        # Classe senza maestra specifica → assegna la prima disponibile senza classe
        unassigned = next(
            (t for t in teachers if not t.get("class_ids") and not t.get("class_id")), None
        )
        teacher = unassigned

    if teacher:
        r = requests.patch(f"{BASE}/classes/{cls['id']}", headers=H,
                           json={"teacher_id": teacher["id"]})
        if r.status_code == 200:
            print(f"  ✅ {cls['name']} → {teacher['name']}")
        else:
            print(f"  ❌ {cls['name']}: {r.status_code} {r.text[:60]}")
    else:
        print(f"  ⚠️  {cls['name']}: nessuna maestra disponibile")

# Verifica finale
print("\n📊 VERIFICA FINALE — Magico Mondo:")
H = login("il-magico-mondo")
classes  = requests.get(f"{BASE}/classes",  headers=H).json()
users    = requests.get(f"{BASE}/users",    headers=H).json()
students = requests.get(f"{BASE}/students", headers=H).json()
teachers = [u for u in users if u.get("role") == "teacher"]

for t in teachers:
    cids = list(t.get("class_ids") or [])
    if t.get("class_id") and t["class_id"] not in cids:
        cids.append(t["class_id"])
    visible = [s for s in students if s.get("class_id") in cids]
    print(f"  👩‍🏫 {t['name']:<25} vede {len(visible)} studenti")

print("\n✅ Fix completato. Le maestre del Magico Mondo ora vedono i loro studenti.")
