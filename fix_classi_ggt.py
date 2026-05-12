#!/usr/bin/env python3
"""
fix_classi_ggt.py
──────────────────
Fix mirato basato sul dry-run:
1. Sposta 8 bambini da MM → GGT II Infanzia
2. Sposta 7+1 bambini da Colorandia → I Infanzia (classe sbagliata)
3. Invia credenziali a 4 maestre GGT (Chiara va cercata per nome)
4. Invia credenziali ai genitori GGT già nel DB

Esegui: python3 fix_classi_ggt.py --dry-run
         python3 fix_classi_ggt.py
"""
import urllib.request, urllib.error, json, sys

DRY_RUN = "--dry-run" in sys.argv
BASE    = "https://girogirotondo-app-production.up.railway.app/api"
CREDS   = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; B="\033[94m"; W="\033[0m"; BOLD="\033[1m"

def req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-fix/1.0"}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    if sede:  hdrs["X-Sede-Id"] = sede
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if not silent: print(f"  {R}HTTP {e.code}: {msg}{W}")
        return {"__error__": True, "detail": msg}

def find_student(students, nome, cognome):
    """Cerca studente per nome — tolera piccole differenze."""
    nome_l   = nome.lower()
    cognome_l= cognome.lower()
    # Match esatto
    for s in students:
        if s.get("name","").lower() == nome_l and s.get("cognome","").lower() == cognome_l:
            return s
    # Match parziale cognome (gestisce typo: Taortina/Taormina, Cannarata/Cammarata, ecc.)
    for s in students:
        s_cogn = s.get("cognome","").lower()
        s_nome = s.get("name","").lower()
        if s_nome == nome_l and (s_cogn[:5] == cognome_l[:5] or cognome_l[:5] in s_cogn):
            return s
    return None

# ── LOGIN ─────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}{'═'*65}{W}")
print(f"{BOLD}  FIX CLASSI GGT{' [DRY-RUN]' if DRY_RUN else ''}{W}")
print(f"{BOLD}{'═'*65}{W}\n")

token = None
for c in CREDS:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── Fetch ─────────────────────────────────────────────────────────────────────
print("📡 Fetch dati...", end=" ", flush=True)
classes_ggt  = req("GET", "/classes",  token, sede="girogirotondo")
students_ggt = req("GET", "/students", token, sede="girogirotondo")
students_mm  = req("GET", "/students", token, sede="il-magico-mondo")
users_ggt    = req("GET", "/users",    token, sede="girogirotondo")
users_mm     = req("GET", "/users",    token, sede="il-magico-mondo")
print(f"{G}OK{W}")

cls_by_name  = {c.get("name","").strip(): c for c in classes_ggt}
all_users_map= {u["email"].lower(): u for u in users_ggt + users_mm if u.get("email")}

# ══════════════════════════════════════════════════════════
# FIX 1 — Sposta bambini da MM → GGT II Infanzia
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  FIX 1 — Bambini MM → GGT II Infanzia{W}")
print(f"{BOLD}{'─'*65}{W}")

cls_ii = cls_by_name.get("II Infanzia")
if not cls_ii:
    print(f"  {R}Classe 'II Infanzia' non trovata in GGT!{W}")
else:
    DA_SPOSTARE_MM = [
        ("Natalia",  "Gradino"),
        ("Natan",    "Ricchiari"),
        ("Ginevra",  "Fricano"),
        ("Ludovica", "Di Liberto"),
        ("Noemi",    "Macaluso"),
        ("Celeste",  "Cammarata"),
        ("Gioele",   "Macchiarella"),
        ("Isabella", "Pantaleo"),
    ]
    spostati = 0
    for nome, cognome in DA_SPOSTARE_MM:
        s = find_student(students_mm, nome, cognome)
        if not s:
            print(f"  {Y}⚠️  {nome} {cognome} — non trovato in MM{W}")
            continue
        if DRY_RUN:
            print(f"  {B}[DRY] {nome} {cognome} → II Infanzia GGT{W}")
            spostati += 1
            continue
        res = req("PUT", f"/students/{s['id']}", token, {
            "class_id": cls_ii["id"],
            "sede_id":  "girogirotondo",
        })
        if res.get("__error__"):
            print(f"  {R}🔴 {nome} {cognome}: {res.get('detail')}{W}")
        else:
            print(f"  {G}✅ {nome} {cognome} → II Infanzia GGT{W}")
            spostati += 1
    print(f"  Spostati: {G}{spostati}/{len(DA_SPOSTARE_MM)}{W}")

# ══════════════════════════════════════════════════════════
# FIX 2 — Sposta bambini da Colorandia → I Infanzia
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  FIX 2 — Bambini Colorandia → I Infanzia{W}")
print(f"{BOLD}{'─'*65}{W}")

cls_i   = cls_by_name.get("I Infanzia")
cls_col = cls_by_name.get("Colorandia")

if not cls_i or not cls_col:
    print(f"  {R}Classi non trovate!{W}")
else:
    # Questi bambini sono in Colorandia nel DB ma appartengono a I Infanzia
    DA_COLORANDIA_A_I = [
        ("Adele",    "Armetta"),
        ("Paolo",    "Capogiri"),
        ("Edoardo",  "Cuneo"),
        ("Rita",     "Terenzio"),
        ("Santiago", "Gambino"),
        ("Mia",      "Drago"),
        ("Ambra",    "Davì"),
    ]
    # Studenti attualmente in Colorandia
    stud_colorandia = [s for s in students_ggt if s.get("class_id") == cls_col["id"]]

    spostati2 = 0
    for nome, cognome in DA_COLORANDIA_A_I:
        s = find_student(stud_colorandia, nome, cognome)
        if not s:
            # Cerca in tutti i GGT (potrebbe essere in un'altra classe sbagliata)
            s = find_student(students_ggt, nome, cognome)
            if s:
                curr_cls = next((c.get("name") for c in classes_ggt if c["id"] == s.get("class_id")), "?")
                print(f"  {Y}⚠️  {nome} {cognome} — trovato in {curr_cls} (non Colorandia){W}")
            else:
                print(f"  {Y}⚠️  {nome} {cognome} — non trovato in GGT{W}")
                continue
        if DRY_RUN:
            print(f"  {B}[DRY] {nome} {cognome} → I Infanzia{W}")
            spostati2 += 1
            continue
        res = req("PUT", f"/students/{s['id']}", token, {
            "class_id": cls_i["id"],
            "sede_id":  "girogirotondo",
        })
        if res.get("__error__"):
            print(f"  {R}🔴 {nome} {cognome}: {res.get('detail')}{W}")
        else:
            print(f"  {G}✅ {nome} {cognome} → I Infanzia{W}")
            spostati2 += 1
    print(f"  Spostati: {G}{spostati2}/{len(DA_COLORANDIA_A_I)}{W}")

# ══════════════════════════════════════════════════════════
# FIX 3 — Credenziali maestre GGT
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  FIX 3 — Credenziali maestre GGT{W}")
print(f"{BOLD}{'─'*65}{W}")

# Cerca maestre per nome (Chiara potrebbe avere email diversa nel DB)
teachers_ggt = [u for u in users_ggt if u.get("role") == "teacher"]
print(f"  Maestre trovate in GGT: {len(teachers_ggt)}")

for t in sorted(teachers_ggt, key=lambda x: x.get("name","")):
    print(f"  • {t.get('name'):<20} {t.get('email')}")

print()
cred_inviate = 0
for t in teachers_ggt:
    if DRY_RUN:
        print(f"  {B}[DRY] {t.get('name'):<20} → avrebbe ricevuto credenziali{W}")
        cred_inviate += 1
        continue
    res = req("POST", f"/users/{t['id']}/resend-credentials", token, {})
    if res.get("__error__"):
        print(f"  {R}🔴 {t.get('name')}: {res.get('detail')}{W}")
    else:
        ok  = res.get("email_sent", True)
        pwd = res.get("new_password","?")
        flag = f"{G}📧 inviata{W}" if ok else f"{Y}⚠️ non inviata{W}"
        print(f"  {G}✅ {t.get('name'):<20} {t.get('email'):<40} {flag}")
        print(f"       └ pwd: {BOLD}{pwd}{W}")
        cred_inviate += 1

# ══════════════════════════════════════════════════════════
# FIX 4 — Credenziali genitori GGT già nel DB
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  FIX 4 — Credenziali genitori GGT{W}")
print(f"{BOLD}{'─'*65}{W}")

parents_ggt = [u for u in users_ggt if u.get("role") == "parent"]
parents_mm  = [u for u in users_mm  if u.get("role") == "parent"]
# Includi anche genitori con sede_id MM che hanno figli in GGT
all_parents = {u["id"]: u for u in parents_ggt + parents_mm}

print(f"  Genitori da notificare: {len(all_parents)}")
sent = 0
for uid, u in all_parents.items():
    if DRY_RUN:
        print(f"  {B}[DRY] {u.get('email','?')}{W}")
        sent += 1
        continue
    res = req("POST", f"/users/{uid}/resend-credentials", token, {})
    if res.get("__error__"):
        print(f"  {R}🔴 {u.get('email','?')}: {res.get('detail')}{W}")
    else:
        ok  = res.get("email_sent", True)
        pwd = res.get("new_password","?")
        flag = f"{G}📧{W}" if ok else f"{Y}⚠️{W}"
        print(f"  {G}✅ {u.get('name','?'):<25} {u.get('email','?'):<40}{W} {flag}  pwd: {BOLD}{pwd}{W}")
        sent += 1

# ══════════════════════════════════════════════════════════
# RIEPILOGO
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{W}")
print(f"{BOLD}  RIEPILOGO{W}")
print(f"{BOLD}{'═'*65}{W}")
print(f"\n  Bambini MM → GGT:        {G}{spostati if not DRY_RUN else '(dry-run)'}{W}")
print(f"  Bambini Colorandia → I:  {G}{spostati2 if not DRY_RUN else '(dry-run)'}{W}")
print(f"  Credenziali maestre:     {G}{cred_inviate}{W}")
print(f"  Credenziali genitori:    {G}{sent}{W}")

print(f"""
  {Y}⚠️  BAMBINI DA INSERIRE MANUALMENTE (non nel DB):{W}
  Pesciolini:  Gabriele Taormina, Agnese Armetta, Aurora Di Maggio
  Tigrotti:    Alessandro Pozzi Taormina, Tommaso Cammarata, Riccardo Davì, Sofia Gatubino
  Colorandia:  Gabriele Piromalli, Diego Mannino, Leonardo Corso, Leonardo Tanase
  I Infanzia:  Antonio Cammarata, Leonardo Ponisch, Sofia Gruppuso
  II Infanzia: Rebecca Gennaro (no email)

  Inseriscili tramite il pannello admin → Iscrivi Bambino.

  {Y}⚠️  NOMI DA CORREGGERE NEL DB (typo):{W}
  Taortina    → Taormina  (Gabriele, Tigrotti)
  Artetta     → Armetta   (Agnese, Pesciolini)
  Cannarata   → Cammarata (Tommaso/Antonio)
  Ia Fata     → La Fata   (Matilde, I Infanzia)
  Puzzi       → Pozzi     (Alessandro Pozzi Taormina, Tigrotti)

  Correggili dall'admin → clic sul bambino → modifica nome.
""")

if DRY_RUN:
    print(f"  {Y}[DRY-RUN] Esegui senza --dry-run per applicare.{W}\n")
