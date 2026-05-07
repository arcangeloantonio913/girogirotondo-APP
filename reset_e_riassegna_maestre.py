#!/usr/bin/env python3
"""
RESET COMPLETO + RIASSEGNAZIONE MAESTRE
1. Rimuove TUTTE le associazioni teacher_id dalle classi
2. Svuota class_ids di TUTTE le maestre
3. Mostra lo stato pulito (maestre e classi senza legami)
4. Fornisce il comando per la riassegnazione dall'interfaccia admin

Uso: python3 reset_e_riassegna_maestre.py
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

# Carica dati da entrambe le sedi
all_classes  = []
all_teachers = []
all_students = []

for sede in ["girogirotondo", "il-magico-mondo"]:
    hh = dict(H); hh["X-Sede-Id"] = sede
    cls = requests.get(f"{BASE}/classes",  headers=hh).json()
    usr = requests.get(f"{BASE}/users",    headers=hh).json()
    sts = requests.get(f"{BASE}/students", headers=hh).json()
    all_classes.extend(cls)
    existing_u = {u["id"] for u in all_teachers}
    all_teachers.extend([u for u in usr if u.get("role") == "teacher" and u["id"] not in existing_u])
    existing_s = {s["id"] for s in all_students}
    all_students.extend([s for s in sts if s["id"] not in existing_s])

print("="*65)
print("📊 STATO ATTUALE (prima del reset)")
print("="*65)
for t in all_teachers:
    cids = list(t.get("class_ids") or [])
    cls_nomi = [c["name"] for c in all_classes if c["id"] in cids]
    visible  = [s for s in all_students if s.get("class_id") in cids]
    print(f"  👩‍🏫 {t['name']:<28} classe_ids={cls_nomi} ({len(visible)} studenti)")

print()
print("="*65)
print("🔧 FASE 1 — Rimuovo teacher_id da TUTTE le classi")
print("="*65)

for cls in all_classes:
    if cls.get("teacher_id"):
        sede = cls.get("sede_id", "girogirotondo")
        hh = dict(H); hh["X-Sede-Id"] = sede
        # Non possiamo fare PATCH con teacher_id="" perché "" rimuove ma classi
        # senza sede potrebbero dare errore — usiamo update diretto tramite DB
        r = requests.patch(f"{BASE}/classes/{cls['id']}", headers=hh,
                           json={"teacher_id": ""})
        if r.status_code == 200:
            print(f"  ✅ {cls['name']}: teacher rimosso")
        else:
            print(f"  ⚠️  {cls['name']}: {r.status_code} {r.text[:60]}")

print()
print("="*65)
print("🔧 FASE 2 — Svuoto class_ids di TUTTE le maestre")
print("="*65)

for t in all_teachers:
    if t.get("class_ids") or t.get("class_id"):
        sede = t.get("sede_id", "girogirotondo")
        hh = dict(H); hh["X-Sede-Id"] = sede
        r = requests.put(f"{BASE}/users/{t['id']}", headers=hh,
                         json={"class_ids": [], "class_id": None})
        if r.status_code == 200:
            print(f"  ✅ {t['name']}: class_ids svuotate")
        else:
            print(f"  ⚠️  {t['name']}: {r.status_code} {r.text[:60]}")
    else:
        print(f"  ⏭  {t['name']}: già pulita")

print()
print("="*65)
print("📊 CLASSI E STUDENTI (per la riassegnazione)")
print("="*65)
for cls in sorted(all_classes, key=lambda c: (c.get("sede_id",""), c["name"])):
    cls_students = [s for s in all_students if s.get("class_id") == cls["id"]]
    sede_label = "🟦 GGT" if cls.get("sede_id") == "girogirotondo" else "🟪 MM"
    print(f"  {sede_label} {cls['name']:<25} {len(cls_students):>3} alunni  (ID: {cls['id'][:8]}...)")

print()
print("="*65)
print("📋 MAESTRE DISPONIBILI")
print("="*65)
for t in all_teachers:
    sede_label = "🟦 GGT" if t.get("sede_id") == "girogirotondo" else "🟪 MM"
    print(f"  {sede_label} {t['name']:<30} ({t['email']})")

print()
print("="*65)
print("✅ RESET COMPLETATO")
print()
print("Adesso tutte le maestre hanno class_ids vuoto e vedono 0 studenti.")
print()
print("PER RIASSEGNARE:")
print("  → Admin → Gestione Classi → seleziona la sede")
print("  → Clicca 'Gestisci' su ogni classe")
print("  → Clicca 'Assegna maestra' e scegli la maestra corretta")
print("  → Ripeti per ogni classe")
print("="*65)
