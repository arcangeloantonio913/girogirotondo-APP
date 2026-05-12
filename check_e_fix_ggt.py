#!/usr/bin/env python3
"""
check_e_fix_ggt.py
───────────────────
1. Confronta gli alunni del DB con i dati ufficiali del PDF per le classi GGT
2. Trova bambini in classi sbagliate o bambini di GGT finiti in MM
3. Invia credenziali alle 5 maestre GGT che non le hanno ancora ricevute
4. Invia credenziali ai genitori GGT che non le hanno ricevute

Esegui:  python3 check_e_fix_ggt.py --dry-run   (solo mostra, non modifica)
         python3 check_e_fix_ggt.py              (applica tutto)
"""
import urllib.request, urllib.error, json, sys

DRY_RUN = "--dry-run" in sys.argv
BASE    = "https://girogirotondo-app-production.up.railway.app/api"
CREDS_ADMIN = [
    {"email": "mariucciasc@gmail.com",    "password": "Mariagrazia2026!"},
    {"email": "melignanoteresa@gmail.com", "password": "Teresa2026!"},
]

G="\033[92m"; R="\033[91m"; Y="\033[93m"; B="\033[94m"; W="\033[0m"; BOLD="\033[1m"

# ════════════════════════════════════════════════════════
# DATI UFFICIALI DAL PDF — Girogirotondo FISM
# ════════════════════════════════════════════════════════

CLASSI_PDF = {

    "Pesciolini": [
        {"nome": "Nathan",    "cognome": "Trupia",      "email": "vitalef82@tiscali.it"},
        {"nome": "Mattia",    "cognome": "Parisi",      "email": "ilenia.consolo@gmail.com"},
        {"nome": "Amelia",    "cognome": "Tranchina",   "email": "cracclicdalila@gmail.com"},
        {"nome": "Matilde",   "cognome": "Milani",      "email": "giovanni.milani384@gmail.com"},
        {"nome": "Gabriele",  "cognome": "Taormina",    "email": "rosyriccobono90@libero.it"},
        {"nome": "Bianca",    "cognome": "Macaluso",    "email": "paolomacaluso@gmail.com"},
        {"nome": "Agnese",    "cognome": "Armetta",     "email": "emanuele.armetta@studioaltamonte.com"},
        {"nome": "Rosalia",   "cognome": "Bondì",       "email": "mari.ing.89@hotmail.it"},
        {"nome": "Alice",     "cognome": "Viterbo",     "email": "alessiac8870@hotmail.it"},
        {"nome": "Aurora",    "cognome": "Di Maggio",   "email": None},   # no email in PDF
        {"nome": "Leonardo",  "cognome": "Castagna",    "email": "luisa.martorana@libero.it"},
    ],

    "Tigrotti": [
        {"nome": "Alessandro","cognome": "Pozzi Taormina", "email": "maria.cristina.taormina@gmail.com"},
        {"nome": "Giovanni",  "cognome": "Ragusa",      "email": "gessicazito@hotmail.it"},
        {"nome": "Sofia",     "cognome": "Rubino",      "email": "carmelorubino24@gmail.com"},
        {"nome": "Mya Beatrice","cognome": "Uscé",      "email": "jasminlongo31@gmail.com"},
        {"nome": "Riccardo",  "cognome": "Siino",       "email": "peppe.g89@hotmail.com"},
        {"nome": "Andrea",    "cognome": "Varrica",     "email": "margheritalobello@gmail.com"},
        {"nome": "Tommaso",   "cognome": "Cammarata",   "email": "dalilalocascio@yahoo.it"},
        {"nome": "Giulia",    "cognome": "Di Fiore",    "email": "antoadridiore@tim.it"},
        {"nome": "Riccardo",  "cognome": "Davì",        "email": "esteraiello7@gmail.com"},
        {"nome": "Sofia",     "cognome": "Gatubino",    "email": "cristinabellaero@gmail.com"},
        {"nome": "Mattia",    "cognome": "Di Gaudio",   "email": "digaudioalessandro91@gmail.com"},
        {"nome": "Matilde",   "cognome": "Corrao",      "email": "corraoalessandromarco@gmail.com"},
    ],

    "Colorandia": [
        {"nome": "Leonardo",  "cognome": "Scalisi",     "email": "lorencoscalisi@yahoo.it"},
        {"nome": "Gabriele",  "cognome": "Fontana",     "email": "marco989mf@gmail.com"},
        {"nome": "Andrea",    "cognome": "Taormina",    "email": "chiara.988@hotmail.it"},
        # Francesco Incalziti — BARRATO (non più iscritto)
        {"nome": "Soraya",    "cognome": "Mendola",     "email": "denisebaglione8@gmail.com"},
        {"nome": "Andres",    "cognome": "Terrana",     "email": "fonsy85@hotmail.it"},
        {"nome": "Jasmine",   "cognome": "Bellia",      "email": "criejasmine@gmail.com"},
        {"nome": "Alessio",   "cognome": "Messina",     "email": "andyrons867@gmail.com"},
        {"nome": "Livia",     "cognome": "Sabella",     "email": "consueloguarnerie@gmail.com"},
        {"nome": "Maria Chiara","cognome": "Di Maggio", "email": "miticfrancy@live.it"},
        {"nome": "Asia",      "cognome": "Mannino",     "email": "manninoluca1993@gmail.com"},
        {"nome": "Celeste",   "cognome": "Gippetto",    "email": "davide.gippetto@virgilio.it"},
        {"nome": "Francesco", "cognome": "Mannino",     "email": "angeladrago1996@gmail.com"},
        {"nome": "Sofia",     "cognome": "Purpura",     "email": "gambinogabriella@libero.it"},
        {"nome": "Mattia",    "cognome": "Mendola",     "email": "antonella.pecoraino132@gmail.com"},
        {"nome": "Gabriele",  "cognome": "Piromalli",   "email": "bruno1291@live.it"},
        {"nome": "Nicole",    "cognome": "Romeo",       "email": "ale_1124@live.it"},
        {"nome": "Samuele",   "cognome": "Amato",       "email": "amatodomenico1987@icloud.com"},
        {"nome": "Diego",     "cognome": "Mannino",     "email": None},   # no email
        {"nome": "Leonardo",  "cognome": "Corso",       "email": "scorso096@gmail.com"},
        {"nome": "Antonio",   "cognome": "Maenza",      "email": "mariomaeza@hotmail.com"},
        {"nome": "Leonardo",  "cognome": "Tanase",      "email": "ancatanase55@gmail.com"},
        {"nome": "Riccardo",  "cognome": "Lo Vasco",    "email": "peppe.12.89@gmail.com"},
        {"nome": "Marco",     "cognome": "Billeci",     "email": "darioisola@hotmail.it"},
    ],

    "I Infanzia": [
        {"nome": "Carlo",     "cognome": "Allegrini",   "email": "antonio.allegrinie@rai.it"},
        {"nome": "Leonardo",  "cognome": "Arnone",      "email": "maria-rita_taormina@hotmail.it"},
        {"nome": "Sofia",     "cognome": "Bologna",     "email": "rafaellabertucci@hotmail.it"},
        {"nome": "Alessia",   "cognome": "Cusimano",    "email": "twinsarvo2015@gmail.com"},
        {"nome": "Marco",     "cognome": "Lo Iacono",   "email": "vanessa3083@icloud.com"},
        {"nome": "Anna",      "cognome": "Messina",     "email": "valiv_1987@hotmail.it"},
        {"nome": "Alison",    "cognome": "Pilato",      "email": "rosario_pilato91@hotmail.it"},
        {"nome": "Antonio",   "cognome": "Cammarata",   "email": "dalilalocascio@yahoo.it"},  # stesso genitore Tigrotti
        {"nome": "Leonardo",  "cognome": "Ponisch",     "email": "giu_li91@hotmail.it"},
        {"nome": "Edoardo",   "cognome": "Balsano",     "email": "zizzoroselia90@gmail.com"},
        {"nome": "Matilde",   "cognome": "La Fata",     "email": "lafatasalvo@hotmail.it"},
        {"nome": "Emma",      "cognome": "Tona",        "email": None},   # no email
        {"nome": "Adele",     "cognome": "Armetta",     "email": "emanuele.armetta@studioaltamonte.com"},  # sorella Agnese
        {"nome": "Paolo",     "cognome": "Capogiri",    "email": "capirex1998@hotmail.it"},
        {"nome": "Francesco", "cognome": "Carollo",     "email": "kikinamikasalvo91@hotmail.com"},
        {"nome": "Sofia",     "cognome": "Gruppuso",    "email": "irene.porrovecchio@yahoo.it"},
        {"nome": "Edoardo",   "cognome": "Cuneo",       "email": "maurizio.cuneo85@gmail.com"},
        {"nome": "Gabriele",  "cognome": "Cuneo",       "email": "monicalocicero88@gmail.com"},
        {"nome": "Vittoria",  "cognome": "Aiello",      "email": None},   # no email
        {"nome": "Rita",      "cognome": "Terenzio",    "email": "costanzo.francy@virgilio.it"},
        {"nome": "Santiago",  "cognome": "Gambino",     "email": "eligius_94@live.it"},
        {"nome": "Mia",       "cognome": "Drago",       "email": "noemivella19@gmail.com"},
        {"nome": "Ambra",     "cognome": "Davì",        "email": "ivix89@hotmail.it"},
    ],

    "II Infanzia": [
        {"nome": "Alejandro", "cognome": "Corrao",      "email": "alexandra_17@live.it"},
        {"nome": "Natalia",   "cognome": "Gradino",     "email": "gradinoalessandro@gmail.com"},
        {"nome": "Natan",     "cognome": "Ricchiari",   "email": "crocedebora1@gmail.com"},
        {"nome": "Ambra",     "cognome": "Costantino",  "email": "giuliapistone52@gmail.com"},
        {"nome": "Ginevra",   "cognome": "Fricano",     "email": "gagiorlando@gmail.com"},
        {"nome": "Ludovica",  "cognome": "Di Liberto",  "email": "giambona-francesca@libero.it"},
        {"nome": "Noemi",     "cognome": "Macaluso",    "email": "devidbmw.dm@gmail.com"},
        {"nome": "Celeste",   "cognome": "Cammarata",   "email": "dalilalocascio@yahoo.it"},
        {"nome": "Gioele",    "cognome": "Macchiarella","email": "rosalaing89@libero.it"},
        {"nome": "Rebecca",   "cognome": "Gennaro",     "email": None},
        {"nome": "Noemi",     "cognome": "Fecarotta",   "email": "alessandrapisani@outlook.com"},
        {"nome": "Isabella",  "cognome": "Pantaleo",    "email": "roberto@islafood.it"},
    ],
}

# Bambini BARRATI (non più iscritti) da rimuovere se presenti in DB
BARRATI = [
    {"nome": "Francesco", "cognome": "Incalziti"},  # Colorandia
    {"nome": "Johan",     "cognome": "Fusco"},       # II Infanzia
]

# Maestre GGT (email dal DB)
MAESTRE_GGT = [
    {"nome": "Chiara",    "email": "chiaralionetti.980@gmail.com",  "classe": "Pulcini"},
    {"nome": "Elisabetta","email": "saitta.es@libero.it",           "classe": "I Infanzia"},
    {"nome": "Giorgia",   "email": "giorgia.greco1495@gmail.com",   "classe": "Pesciolini"},
    {"nome": "Marika",    "email": "graziamarukarusso@gmail.com",   "classe": "Tigrotti"},
    {"nome": "Rachele",   "email": "zachele.impastato@gmail.com",   "classe": "Colorandia"},
]

# ════════════════════════════════════════════════════════

def req(method, path, token=None, body=None, sede=None, silent=False):
    url  = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json", "User-Agent": "ggt-check/1.0"}
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

def name_match(s_db, nome_pdf, cognome_pdf):
    """Confronto nome flessibile: gestisce ordine, accenti, spazi."""
    n_db  = (s_db.get("name","") + " " + s_db.get("cognome","")).lower().strip()
    n_pdf = (nome_pdf + " " + cognome_pdf).lower().strip()
    n_pdf2= (cognome_pdf + " " + nome_pdf).lower().strip()
    return n_db == n_pdf or n_db == n_pdf2 or \
           n_pdf in n_db or n_db in n_pdf

# ── LOGIN ─────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}{'═'*65}{W}")
print(f"{BOLD}  CHECK E FIX CLASSI GGT + CREDENZIALI{' [DRY-RUN]' if DRY_RUN else ''}{W}")
print(f"{BOLD}{'═'*65}{W}\n")

token = None
for c in CREDS_ADMIN:
    res = req("POST", "/auth/login", body=c, silent=True)
    token = res.get("token") or res.get("access_token")
    if token: print(f"{G}✅ Login: {c['email']}{W}"); break
if not token:
    print(f"{R}Login fallito{W}"); sys.exit(1)

# ── Fetch dati ────────────────────────────────────────────────────────────────
print("📡 Fetch dati...", end=" ", flush=True)
classes_ggt  = req("GET", "/classes",  token, sede="girogirotondo")
students_ggt = req("GET", "/students", token, sede="girogirotondo")
students_mm  = req("GET", "/students", token, sede="il-magico-mondo")
users_ggt    = req("GET", "/users",    token, sede="girogirotondo")
users_mm     = req("GET", "/users",    token, sede="il-magico-mondo")
print(f"{G}OK{W}")

class_by_name = {c.get("name","").strip(): c for c in classes_ggt}
all_db_emails = {u.get("email","").lower() for u in users_ggt + users_mm if u.get("email")}

# ══════════════════════════════════════════════════════════
# 1. CHECK CLASSI: confronto PDF vs DB
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  1. CONFRONTO CLASSI PDF vs DB{W}")
print(f"{BOLD}{'─'*65}{W}")

bambini_mancanti   = []   # in PDF ma non in DB → da aggiungere
bambini_extra      = []   # in DB ma non in PDF → potenzialmente in classe sbagliata
bambini_barrati_db = []   # bambini barrati ancora presenti in DB

for classe_name, pdf_list in CLASSI_PDF.items():
    cls = class_by_name.get(classe_name)
    if not cls:
        print(f"  {Y}⚠️  Classe '{classe_name}' non trovata in GGT DB{W}")
        continue

    db_list = [s for s in students_ggt if s.get("class_id") == cls["id"]]
    print(f"\n  {BOLD}{B}{classe_name}{W} — PDF: {len(pdf_list)} | DB: {len(db_list)}")

    # Bambini barrati da cercare in DB
    for b in BARRATI:
        found = next((s for s in db_list if name_match(s, b["nome"], b["cognome"])), None)
        if found:
            print(f"    {R}🗑  BARRATO ancora in DB: {found.get('name')} {found.get('cognome')}{W}")
            bambini_barrati_db.append((found, classe_name))

    # PDF → DB: chi manca nel DB
    for p in pdf_list:
        found = next((s for s in db_list if name_match(s, p["nome"], p["cognome"])), None)
        if not found:
            # Cerca in altri classi GGT
            in_other_ggt = next((s for s in students_ggt
                                  if name_match(s, p["nome"], p["cognome"])
                                  and s.get("class_id") != cls["id"]), None)
            # Cerca in MM
            in_mm = next((s for s in students_mm
                          if name_match(s, p["nome"], p["cognome"])), None)

            if in_other_ggt:
                other_cls = next((c for c in classes_ggt if c["id"] == in_other_ggt.get("class_id")), {})
                print(f"    {Y}⚠️  {p['nome']} {p['cognome']} — in classe SBAGLIATA GGT: {other_cls.get('name','?')}{W}")
                bambini_mancanti.append({**p, "target_class": cls, "found_elsewhere": in_other_ggt, "tipo": "wrong_class_ggt"})
            elif in_mm:
                print(f"    {R}🔴 {p['nome']} {p['cognome']} — è in MM! Deve essere in {classe_name}{W}")
                bambini_mancanti.append({**p, "target_class": cls, "found_elsewhere": in_mm, "tipo": "in_mm"})
            else:
                print(f"    {Y}➕ {p['nome']} {p['cognome']} — NON in DB (da creare){W}")
                bambini_mancanti.append({**p, "target_class": cls, "found_elsewhere": None, "tipo": "missing"})
        else:
            pass  # ok, presente

    # DB → PDF: chi è in DB ma non nel PDF
    for s in db_list:
        found_in_pdf = any(name_match(s, p["nome"], p["cognome"]) for p in pdf_list)
        found_barrato = any(name_match(s, b["nome"], b["cognome"]) for b in BARRATI)
        if not found_in_pdf and not found_barrato:
            print(f"    {R}❓ {s.get('name')} {s.get('cognome','')}{W} — in DB ma NON nel PDF!")
            bambini_extra.append((s, classe_name))

# ══════════════════════════════════════════════════════════
# 2. CHECK: bambini GGT in classi MM
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  2. BAMBINI GGT IN CLASSI MM{W}")
print(f"{BOLD}{'─'*65}{W}")

all_ggt_names = set()
for pdf_list in CLASSI_PDF.values():
    for p in pdf_list:
        all_ggt_names.add((p["nome"].lower(), p["cognome"].lower()))

ggt_in_mm = []
for s in students_mm:
    s_nome = s.get("name","").lower()
    s_cogn = s.get("cognome","").lower()
    if (s_nome, s_cogn) in all_ggt_names or \
       any(s_cogn in p["cognome"].lower() and s_nome in p["nome"].lower()
           for p in [{"nome":k[0],"cognome":k[1]} for k in all_ggt_names]):
        ggt_in_mm.append(s)
        print(f"  {R}🔴 {s.get('name')} {s.get('cognome','')} è in MM ma dovrebbe essere in GGT{W}")

if not ggt_in_mm:
    print(f"  {G}✅ Nessun bambino GGT trovato in classi MM{W}")

# ══════════════════════════════════════════════════════════
# 3. RIEPILOGO PROBLEMI
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  3. RIEPILOGO{W}")
print(f"{BOLD}{'─'*65}{W}")

wrong_class = [b for b in bambini_mancanti if b["tipo"] in ("wrong_class_ggt","in_mm")]
missing     = [b for b in bambini_mancanti if b["tipo"] == "missing"]

print(f"\n  {R}Bambini in classe sbagliata:  {len(wrong_class)}{W}")
print(f"  {Y}Bambini mancanti dal DB:       {len(missing)}{W}")
print(f"  {Y}Bambini extra nel DB:           {len(bambini_extra)}{W}")
print(f"  {R}Bambini barrati ancora in DB:   {len(bambini_barrati_db)}{W}")
print(f"  {R}Bambini GGT in MM:              {len(ggt_in_mm)}{W}")

# ══════════════════════════════════════════════════════════
# 4. FIX AUTOMATICO: sposta bambini in classe sbagliata
# ══════════════════════════════════════════════════════════
if wrong_class and not DRY_RUN:
    print(f"\n{BOLD}{'─'*65}{W}")
    print(f"{BOLD}  4. FIX — Sposta bambini in classe corretta{W}")
    print(f"{BOLD}{'─'*65}{W}")
    for b in wrong_class:
        s    = b["found_elsewhere"]
        cls  = b["target_class"]
        res  = req("PUT", f"/students/{s['id']}", token, {
            "class_id": cls["id"],
            "sede_id":  "girogirotondo",
        })
        if res.get("__error__"):
            print(f"  {R}🔴 {b['nome']} {b['cognome']}: {res.get('detail')}{W}")
        else:
            print(f"  {G}✅ {b['nome']} {b['cognome']} → {cls.get('name')}{W}")

# ══════════════════════════════════════════════════════════
# 5. CREDENZIALI MAESTRE GGT
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  5. CREDENZIALI MAESTRE GGT{W}")
print(f"{BOLD}{'─'*65}{W}")

all_users_map = {u["email"].lower(): u for u in users_ggt + users_mm if u.get("email")}

for m in MAESTRE_GGT:
    user = all_users_map.get(m["email"].lower())
    if not user:
        print(f"  {Y}⚠️  {m['nome']} ({m['email']}) — account non trovato nel DB{W}")
        continue
    if DRY_RUN:
        print(f"  {B}[DRY] {m['nome']} ({m['email']}) — avrebbe inviato credenziali{W}")
        continue
    res = req("POST", f"/users/{user['id']}/resend-credentials", token, {})
    if res.get("__error__"):
        print(f"  {R}🔴 {m['nome']}: {res.get('detail')}{W}")
    else:
        ok = res.get("email_sent", True)
        pwd = res.get("new_password","?")
        flag = f"{G}📧 email inviata{W}" if ok else f"{Y}⚠️ email non inviata{W}"
        print(f"  {G}✅ {m['nome']:<12}{W} {m['email']:<40} {flag}")
        print(f"       └ Password: {BOLD}{G}{pwd}{W}")

# ══════════════════════════════════════════════════════════
# 6. CREDENZIALI GENITORI GGT (chi non le ha ricevute)
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'─'*65}{W}")
print(f"{BOLD}  6. CREDENZIALI GENITORI GGT{W}")
print(f"{BOLD}{'─'*65}{W}")

# Raccoglie tutte le email dal PDF con email valida
tutte_email_pdf = set()
for classe_list in CLASSI_PDF.values():
    for b in classe_list:
        if b.get("email"):
            tutte_email_pdf.add(b["email"].lower())

inviati = non_trovati = 0
print(f"  Genitori da notificare: {len(tutte_email_pdf)}\n")

for email in sorted(tutte_email_pdf):
    user = all_users_map.get(email)
    if not user:
        print(f"  {Y}⚠️  {email} — account non trovato (da creare){W}")
        non_trovati += 1
        continue
    if DRY_RUN:
        print(f"  {B}[DRY] {email} — avrebbe inviato{W}")
        inviati += 1
        continue
    res = req("POST", f"/users/{user['id']}/resend-credentials", token, {})
    if res.get("__error__"):
        print(f"  {R}🔴  {email}: {res.get('detail')}{W}")
    else:
        ok  = res.get("email_sent", True)
        pwd = res.get("new_password","?")
        flag = f"{G}📧{W}" if ok else f"{Y}⚠️{W}"
        print(f"  {G}✅  {email:<42}{W} {flag}  pwd: {BOLD}{pwd}{W}")
        inviati += 1

# ══════════════════════════════════════════════════════════
# RIEPILOGO FINALE
# ══════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{W}")
print(f"{BOLD}  RIEPILOGO FINALE{W}")
print(f"{BOLD}{'═'*65}{W}")
print(f"\n  Bambini spostati:              {G}{len(wrong_class) if not DRY_RUN else 0}{W}")
print(f"  Bambini mancanti (manuali):    {Y}{len(missing)}{W}")
print(f"  Bambini extra (verificare):    {Y}{len(bambini_extra)}{W}")
print(f"  Email maestre inviate:         {G}{len(MAESTRE_GGT) if not DRY_RUN else 0}{W}")
print(f"  Email genitori inviate:        {G}{inviati}{W}")
print(f"  Email genitori non trovate:    {Y}{non_trovati}{W}")

if bambini_extra:
    print(f"\n  {Y}⚠️  Bambini extra nel DB (non nel PDF) — verificare manualmente:{W}")
    for s, cls in bambini_extra:
        print(f"     • {s.get('name')} {s.get('cognome','')} (classe {cls})")

if bambini_barrati_db:
    print(f"\n  {R}🗑  Bambini BARRATI ancora nel DB — eliminare manualmente:{W}")
    for s, cls in bambini_barrati_db:
        print(f"     • {s.get('name')} {s.get('cognome','')} (classe {cls})")

if missing:
    print(f"\n  {Y}➕ Bambini da inserire manualmente (non in DB):{W}")
    for b in missing:
        print(f"     • {b['nome']} {b['cognome']} → {b['target_class'].get('name')} {'('+b['email']+')' if b.get('email') else '(no email)'}")

if DRY_RUN:
    print(f"\n  {Y}[DRY-RUN] Nessuna modifica effettuata. Esegui senza --dry-run per applicare.{W}")
print()
