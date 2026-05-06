#!/usr/bin/env python3
"""
Script diagnostico — mostra quali classi non hanno maestre
e quali maestre non sono assegnate a nessuna classe.
Aiuta a capire perché le maestre non vedono gli studenti.

Uso: python3 assegna_maestre.py
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
print("✅ Login OK\n")

H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}

classes  = requests.get(f"{BASE}/classes", headers=H).json()
users    = requests.get(f"{BASE}/users",   headers=H).json()
students = requests.get(f"{BASE}/students",headers=H).json()

teachers = [u for u in users if u.get("role") == "teacher"]

print("="*60)
print("📚 CLASSI E MAESTRE ASSEGNATE")
print("="*60)
for cls in classes:
    teacher = next((t for t in teachers if t["id"] == cls.get("teacher_id")), None)
    class_students = [s for s in students if s.get("class_id") == cls["id"]]
    status = f"✅ {teacher['name']}" if teacher else "❌ NESSUNA MAESTRA"
    print(f"  {cls['name']:<20} {status:<30} ({len(class_students)} alunni)")

print()
print("="*60)
print("👩‍🏫 MAESTRE E CLASSI ASSEGNATE")
print("="*60)
for t in teachers:
    class_ids = t.get("class_ids") or ([t["class_id"]] if t.get("class_id") else [])
    assigned  = [c["name"] for c in classes if c["id"] in class_ids]
    visible_students = [s for s in students if s.get("class_id") in class_ids]
    status = f"→ {', '.join(assigned)}" if assigned else "❌ NESSUNA CLASSE ASSEGNATA — non vede nessun bambino!"
    print(f"  {t['name']:<25} {status}")
    print(f"  {'':<25} Bambini visibili: {len(visible_students)}")
    print()

print("="*60)
print("ℹ️  Per assegnare una maestra a una classe:")
print("    Admin → Gestione Classi → Gestisci → Assegna maestra")
print("="*60)
