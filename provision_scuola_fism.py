#!/usr/bin/env python3
"""
PROVISIONING SCUOLA FISM — crea un nuovo tenant completo + modulo Rette popolato
================================================================================
Crea, via API HTTP (come gli altri script del repo), un'intera scuola pronta per la
DEMO o per il rollout:

    org (scuola)  →  sede brandizzata  →  admin  →  maestre  →  sezioni
                  →  bambini + genitori  →  piano retta  →  assegnazioni  →  addebiti del mese

È IDEMPOTENTE dove possibile: rilanciandolo non duplica (salta ciò che esiste già).

Prerequisiti
------------
- Credenziali di un **SuperAdmin GLOBALE** (senza org_id): può creare org e sedi in
  qualsiasi org. Passale via variabili d'ambiente (NON si scrivono nel file):

    export FISM_BASE="https://girogirotondo-app-production.up.railway.app/api"
    export FISM_SUPERADMIN_EMAIL="tua-email-superadmin"
    export FISM_SUPERADMIN_PASSWORD="tua-password"

- Richiede il backend con i router nuovi (/api/orgs, /api/rette) già in produzione
  (branch feat/fism-provisioning).

Uso
---
    cd girogirotondo-APP
    pip3 install requests
    python3 provision_scuola_fism.py

Per una scuola diversa: modifica il dict SCUOLA qui sotto (o duplica il file).
NB: il modello FISM = "ogni scuola è una sua app" → qui ogni scuola = una sua ORG isolata.
"""
import os
import sys
import requests

# ───────────────────────────── Config scuola (DEMO) ─────────────────────────────
# Dati demo realistici (scuola pilota nota). Sostituiscili con quelli reali che la
# scuola invia col "Modulo Raccolta Dati".
SCUOLA = {
    "org_slug": "scuola-santa-teresa",
    "org_name": "Scuola dell'Infanzia Santa Teresa",
    "sede_slug": "santa-teresa",
    "sede_name": "Santa Teresa",
    "color": "#7A5CFF",                         # colore brand della scuola (header app/email)
    "indirizzo": "Palermo",

    "admin": {
        "nome": "Direzione", "cognome": "Santa Teresa",
        "email": "direzione@santateresa.example.com",
        "password": "CambiaMi2026!",            # da cambiare al primo accesso
    },

    "maestre": [
        {"nome": "Maria", "cognome": "Rossi",  "email": "maria.rossi@santateresa.example.com",  "password": "Maestra2026!", "sezione": "Piccoli"},
        {"nome": "Anna",  "cognome": "Bianchi", "email": "anna.bianchi@santateresa.example.com", "password": "Maestra2026!", "sezione": "Grandi"},
    ],

    "sezioni": ["Piccoli", "Mezzani", "Grandi"],

    "bambini": [
        # (nome, cognome, sezione, genitore_nome, genitore_email)
        ("Sofia",  "Esposito", "Piccoli", "Giulia Esposito", "giulia.esposito@example.com"),
        ("Marco",  "Greco",    "Piccoli", "Luca Greco",      "luca.greco@example.com"),
        ("Giorgia","Russo",    "Mezzani", "Elena Russo",     "elena.russo@example.com"),
        ("Matteo", "Conti",    "Mezzani", "Paolo Conti",     "paolo.conti@example.com"),
        ("Aurora", "Ferrari",  "Grandi",  "Sara Ferrari",    "sara.ferrari@example.com"),
        ("Leonardo","Romano",  "Grandi",  "Marco Romano",    "marco.romano@example.com"),
    ],

    "piano_retta": {
        "name": "Tempo pieno",
        "components": [
            {"key": "iscrizione", "label": "Quota di iscrizione", "amount": 150, "kind": "una_tantum"},
            {"key": "retta",      "label": "Retta mensile",       "amount": 300, "kind": "mensile"},
            {"key": "mensa",      "label": "Mensa",               "amount": 80,  "kind": "mensile", "optional": True},
        ],
    },
    "genera_mese": "2026-10",     # genera gli addebiti mensili per questo periodo (YYYY-MM)
    "due_day": 10,
}

# ───────────────────────────── Setup / login ─────────────────────────────
BASE = os.environ.get("FISM_BASE", "https://girogirotondo-app-production.up.railway.app/api")
EMAIL = os.environ.get("FISM_SUPERADMIN_EMAIL", "")
PASSWORD = os.environ.get("FISM_SUPERADMIN_PASSWORD", "")

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; B = "\033[96m"; W = "\033[0m"; BOLD = "\033[1m"


def die(msg):
    print(f"{R}❌ {msg}{W}"); sys.exit(1)


if not EMAIL or not PASSWORD:
    die("Imposta FISM_SUPERADMIN_EMAIL e FISM_SUPERADMIN_PASSWORD (SuperAdmin globale).")

print(f"{BOLD}🏫 Provisioning scuola FISM — {SCUOLA['sede_name']}{W}")
print(f"   backend: {BASE}\n")

print("🔐 Login SuperAdmin…")
r = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
tok = (r.json() or {}).get("token") or (r.json() or {}).get("access_token")
if not tok:
    die(f"Login fallito: {r.text[:200]}")
me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {tok}"}).json()
if not me.get("is_superadmin"):
    die("L'utente non è SuperAdmin: non può creare org/sedi.")
if me.get("org_id"):
    print(f"{Y}⚠️  Il SuperAdmin ha org_id={me['org_id']}: può operare solo nella sua org. "
          f"Per creare una NUOVA org serve un SuperAdmin GLOBALE (senza org_id).{W}")
print(f"{G}✅ Login OK — {me.get('email')}{W}\n")

SEDE = SCUOLA["sede_slug"]
# Header base; X-Sede-Id punta alla nuova sede (il superadmin può operarci sopra).
H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
HS = {**H, "X-Sede-Id": SEDE}


def _ok(resp, label, dup_hints=("già", "already", "esiste", "exist")):
    if resp.status_code in (200, 201):
        print(f"  {G}✅ {label}{W}"); return resp.json()
    detail = ""
    try:
        detail = (resp.json() or {}).get("detail", "")
    except Exception:
        detail = resp.text[:120]
    if any(h in str(detail).lower() for h in dup_hints):
        print(f"  {Y}ℹ️  {label} — già presente{W}"); return None
    print(f"  {R}✗ {label} — {resp.status_code}: {detail}{W}"); return None


# ───────────────────────────── 1. Org ─────────────────────────────
print(f"{B}1) Organizzazione (scuola){W}")
_ok(requests.post(f"{BASE}/orgs", headers=H,
                  json={"id": SCUOLA["org_slug"], "name": SCUOLA["org_name"]}),
    f"Org {SCUOLA['org_name']}")

# ───────────────────────────── 2. Sede brandizzata ─────────────────────────────
print(f"{B}2) Sede brandizzata{W}")
_ok(requests.post(f"{BASE}/sedi", headers=H, json={
        "id": SEDE, "name": SCUOLA["sede_name"], "color": SCUOLA["color"],
        "indirizzo": SCUOLA.get("indirizzo"), "org_id": SCUOLA["org_slug"], "active": True,
    }), f"Sede {SCUOLA['sede_name']} ({SEDE})")

# ───────────────────────────── 3. Admin ─────────────────────────────
print(f"{B}3) Account direzione{W}")
a = SCUOLA["admin"]
_ok(requests.post(f"{BASE}/users", headers=HS, json={
        "name": a["nome"], "cognome": a["cognome"], "email": a["email"],
        "password": a["password"], "role": "admin", "sede_id": SEDE,
    }), f"Admin {a['email']}")

# ───────────────────────────── 4. Sezioni ─────────────────────────────
print(f"{B}4) Sezioni{W}")
sez_ids = {}
existing_classes = requests.get(f"{BASE}/classes", headers=HS).json() or []
by_name = {c["name"].lower(): c["id"] for c in existing_classes if isinstance(c, dict) and c.get("name")}
for nome in SCUOLA["sezioni"]:
    if nome.lower() in by_name:
        sez_ids[nome] = by_name[nome.lower()]
        print(f"  {Y}ℹ️  Sezione {nome} — già presente{W}")
        continue
    res = _ok(requests.post(f"{BASE}/classes", headers=HS, json={"name": nome, "sede_id": SEDE}),
              f"Sezione {nome}")
    if res and res.get("id"):
        sez_ids[nome] = res["id"]

# ───────────────────────────── 5. Maestre ─────────────────────────────
print(f"{B}5) Maestre{W}")
for m in SCUOLA["maestre"]:
    cid = sez_ids.get(m.get("sezione"))
    payload = {"name": m["nome"], "cognome": m["cognome"], "email": m["email"],
               "password": m["password"], "role": "teacher", "sede_id": SEDE}
    if cid:
        payload["class_id"] = cid
        payload["class_ids"] = [cid]
    _ok(requests.post(f"{BASE}/users", headers=HS, json=payload),
        f"Maestra {m['nome']} {m['cognome']}" + (f" → {m['sezione']}" if cid else ""))

# ───────────────────────────── 6. Bambini + genitori ─────────────────────────────
print(f"{B}6) Bambini + genitori{W}")
for (nome, cognome, sezione, gen_nome, gen_email) in SCUOLA["bambini"]:
    cid = sez_ids.get(sezione)
    if not cid:
        print(f"  {R}✗ {nome} {cognome} — sezione '{sezione}' assente{W}"); continue
    _ok(requests.post(f"{BASE}/users/iscrizione", headers=HS, json={
            "bambino_nome": nome, "bambino_cognome": cognome,
            "class_id": cid, "sede_id": SEDE,
            "genitore_email": gen_email, "genitore_nome": gen_nome,
            "skip_email": True,
        }), f"{nome} {cognome} ({sezione}) + genitore {gen_nome}")

# ───────────────────────────── 7. Piano retta ─────────────────────────────
print(f"{B}7) Piano retta{W}")
plan_id = None
existing_plans = requests.get(f"{BASE}/rette/piani", headers=HS).json() or []
for p in existing_plans if isinstance(existing_plans, list) else []:
    if p.get("name") == SCUOLA["piano_retta"]["name"]:
        plan_id = p["id"]
if plan_id:
    print(f"  {Y}ℹ️  Piano '{SCUOLA['piano_retta']['name']}' — già presente{W}")
else:
    res = _ok(requests.post(f"{BASE}/rette/piani", headers=HS, json=SCUOLA["piano_retta"]),
              f"Piano '{SCUOLA['piano_retta']['name']}'")
    plan_id = res.get("id") if res else None

# ───────────────────────────── 8. Assegnazioni ─────────────────────────────
print(f"{B}8) Assegnazione piano ai bambini{W}")
if not plan_id:
    print(f"  {R}✗ Nessun piano: salto assegnazioni e addebiti{W}")
else:
    students = requests.get(f"{BASE}/students", headers=HS).json() or []
    # Sconto fratelli: 20% dal 2° figlio con lo stesso cognome
    seen_cognomi = {}
    assegnati = 0
    for st in students if isinstance(students, list) else []:
        sid = st.get("id")
        cognome = (st.get("cognome") or "").strip().lower()
        n = seen_cognomi.get(cognome, 0)
        seen_cognomi[cognome] = n + 1
        disc = 20 if (cognome and n >= 1) else 0
        body = {"student_id": sid, "plan_id": plan_id}
        if disc:
            body["discount_pct"] = disc
            body["discount_reason"] = "Sconto fratelli"
        res = _ok(requests.post(f"{BASE}/rette/assegnazioni", headers=HS, json=body),
                  f"Retta → {st.get('name')} {st.get('cognome') or ''}"
                  + (f" (−{disc}%)" if disc else ""))
        if res:
            assegnati += 1
    print(f"  {assegnati} assegnazioni create")

    # ───────────────────────────── 9. Addebiti del mese ─────────────────────────────
    print(f"{B}9) Addebiti del mese {SCUOLA['genera_mese']}{W}")
    res = requests.post(f"{BASE}/rette/genera-addebiti", headers=HS,
                        json={"period": SCUOLA["genera_mese"], "due_day": SCUOLA["due_day"]})
    out = _ok(res, f"Generazione addebiti {SCUOLA['genera_mese']}")
    if out:
        print(f"     creati={out.get('creati')} saltati={out.get('saltati')} "
              f"totale=€{out.get('totale_euro')}")
    rip = requests.get(f"{BASE}/rette/riepilogo", headers=HS).json()
    if isinstance(rip, dict):
        print(f"{BOLD}📊 Cassa sede: dovuto €{rip.get('totale_dovuto')} · "
              f"incassato €{rip.get('totale_incassato')} · "
              f"scaduto €{rip.get('totale_scaduto')}{W}")

print(f"\n{G}{BOLD}✅ Provisioning completato per {SCUOLA['sede_name']}.{W}")
print(f"   Admin: {a['email']} — password iniziale: {a['password']} (da cambiare).")
print(f"   Switcher sede / X-Sede-Id: {SEDE}")
