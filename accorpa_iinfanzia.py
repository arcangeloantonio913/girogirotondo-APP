#!/usr/bin/env python3
"""
Script — Accorpa le due classi "I Infanzia" duplicate in una sola.
Sposta tutti gli alunni nella classe con più alunni, elimina quella vuota.
"""
import requests, sys

BASE = "https://girogirotondo-app-production.up.railway.app/api"
SEDE = "girogirotondo"

print("🔐 Login...")
r = requests.post(f"{BASE}/auth/login",
    json={"email": "mariucciasc@gmail.com", "password": "Mariagrazia2026!"},
    headers={"X-Sede-Id": SEDE})
TOKEN = r.json().get("token") or r.json().get("access_token")
if not TOKEN:
    print("❌ Login fallito:", r.json()); sys.exit(1)
print("✅ Login OK\n")

H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Sede-Id": SEDE}

# ── Trova le due classi I Infanzia ────────────────────────────────────────────
classes  = requests.get(f"{BASE}/classes", headers=H).json()
iinfanzie = [c for c in classes if "infanzia" in c.get("name","").lower()]

if len(iinfanzie) < 2:
    print(f"⚠️  Trovata solo {len(iinfanzie)} classe 'I Infanzia' — niente da accorpare")
    sys.exit(0)

print(f"📚 Trovate {len(iinfanzie)} classi 'I Infanzia':")
for c in iinfanzie:
    print(f"   ID: {c['id']}  — Nome: {c['name']}")

# ── Trova gli studenti di ciascuna ────────────────────────────────────────────
students_all = requests.get(f"{BASE}/students", headers=H).json()

def get_students(class_id):
    return [s for s in students_all if s.get("class_id") == class_id]

counts = [(c, len(get_students(c["id"]))) for c in iinfanzie]
counts.sort(key=lambda x: x[1], reverse=True)  # ordina per numero alunni desc

target   = counts[0][0]   # classe più grande → diventa quella definitiva
to_merge = counts[1][0]   # classe più piccola → da svuotare ed eliminare

print(f"\n🎯 Classe target (più grande): '{target['name']}' — {counts[0][1]} alunni — ID: {target['id']}")
print(f"🔀 Classe da accorpare:        '{to_merge['name']}' — {counts[1][1]} alunni — ID: {to_merge['id']}")

students_to_move = get_students(to_merge["id"])
print(f"\n👶 Sposto {len(students_to_move)} alunni nella classe target...")

ok = fail = 0
for s in students_to_move:
    r = requests.put(f"{BASE}/students/{s['id']}", headers=H,
                     json={"class_id": target["id"]})
    if r.status_code == 200:
        print(f"  ✅ {s['name']} {s.get('cognome','')}")
        ok += 1
    else:
        print(f"  ❌ {s['name']} — {r.status_code} {r.text[:60]}")
        fail += 1

print(f"\n✔ Spostati: {ok}  ❌ Falliti: {fail}")

# ── Elimina la classe vuota ────────────────────────────────────────────────────
if fail == 0:
    r = requests.delete(f"{BASE}/classes/{to_merge['id']}", headers=H)
    if r.status_code == 200:
        print(f"\n🗑️  Classe vuota '{to_merge['name']}' ({to_merge['id']}) eliminata ✅")
    else:
        print(f"\n⚠️  Errore eliminazione classe: {r.status_code} {r.text[:80]}")
else:
    print(f"\n⚠️  Classe '{to_merge['name']}' NON eliminata (ci sono {fail} alunni non spostati)")

print(f"\n🏁 Fatto! Ora esiste una sola 'I Infanzia' con {counts[0][1] + ok} alunni.")
