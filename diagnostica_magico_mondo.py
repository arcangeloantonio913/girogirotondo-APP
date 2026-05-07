#!/usr/bin/env python3
"""
DIAGNOSTICA — Solo Il Magico Mondo.
Mostra classi, maestre e studenti senza modificare nulla.
"""
import requests, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE = "il-magico-mondo"

r = requests.post(f"{BASE}/auth/login",
    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
    headers={"X-Sede-Id": SEDE})
TOKEN = r.json().get("token") or r.json().get("access_token")
if not TOKEN: print("❌ Login fallito:", r.json()); sys.exit(1)
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}

classes  = requests.get(f"{BASE}/classes",  headers=H).json()
users    = requests.get(f"{BASE}/users",    headers=H).json()
students = requests.get(f"{BASE}/students", headers=H).json()
teachers = [u for u in users if u.get("role") == "teacher"]

print("="*65)
print("🌈 IL MAGICO MONDO — Stato attuale (sola lettura)")
print("="*65)
print(f"\n📚 CLASSI ({len(classes)}):")
for cls in classes:
    t = next((t for t in teachers if t["id"] == cls.get("teacher_id")), None)
    stu = [s for s in students if s.get("class_id") == cls["id"]]
    t_label = f"✅ {t['name']}" if t else "❌ nessuna maestra"
    print(f"  • {cls['name']:<28} {t_label:<30} ({len(stu)} alunni)")

print(f"\n👩‍🏫 MAESTRE ({len(teachers)}):")
for t in teachers:
    cids = list(t.get("class_ids") or [])
    visible = [s for s in students if s.get("class_id") in cids]
    cls_nomi = [c["name"] for c in classes if c["id"] in cids]
    status = f"✅ vede {len(visible)} alunni ({', '.join(cls_nomi)})" if cids else "❌ nessuna classe — vede 0 alunni"
    print(f"  • {t['name']:<28} {status}")

print(f"\n📊 TOTALE: {len(students)} alunni in {len(classes)} classi")
print("="*65)
print("\n🔧 PER ASSEGNARE LE MAESTRE:")
print("  1. Apri l'app come Mariagrazia o Teresa")
print("  2. Seleziona sede 'Il Magico Mondo'")
print("  3. Gestione Classi → 'Gestisci' su ogni classe")
print("  4. 'Assegna maestra' → scegli la maestra corretta")
print("  5. Ripeti per ogni classe (~2 min totali)")
print("="*65)
