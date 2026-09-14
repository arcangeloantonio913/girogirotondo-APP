"""
IMPORT iscrizioni Dimensione Bimbo 2026/2027 — da eseguire su Railway con /opt/venv/bin/python.

Modalita':
  (default)   DRY-RUN  -> SOLA LETTURA. Conta cosa verrebbe creato, verifica collisioni, NON scrive.
  --apply              -> SCRIVE sul DB (solo dopo backup + conferma esplicita di Anto).

Consuma /app/scripts/iscrizioni_normalized.json (prodotto in locale da build_plan.py).
Replica ESATTAMENTE la forma dei documenti dell'endpoint POST /api/users/iscrizione.
Idempotente: classi per (sede_id,name); bambini per (cognome,name,date_of_birth,sede_id,class_id);
genitori per email (fratelli/gemelli con stessa email -> UN account, piu' figli in child_ids).
In --apply genera password random+bcrypt, NON invia email, e scrive il CSV credenziali.
Non stampa mai MONGO_URL.
"""
import os
import sys
import json
import uuid
import random
import string
import csv
from datetime import datetime, timezone
from pymongo import MongoClient

APPLY = "--apply" in sys.argv
DATA_PATH = "/app/scripts/iscrizioni_normalized.json"
CSV_PATH = "/app/scripts/credenziali_dimensione_bimbo.csv"
MODE = "APPLY (SCRITTURA REALE)" if APPLY else "DRY-RUN (sola lettura)"


def gen_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    return "".join(random.choices(chars, k=length))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> None:
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    client = MongoClient(os.environ["MONGO_URL"])
    db = client["girogirotondo"]

    print("=" * 72)
    print(f"IMPORT Dimensione Bimbo — MODALITA': {MODE}")
    print("=" * 72)

    # --- 0. Verifica sedi ---
    org = data["org_id"]
    sedi = {s["id"] for s in db.sedi.find({"org_id": org}, {"id": 1})}
    need_sedi = {c["sede_id"] for c in data["classes_to_create"]}
    missing_sedi = need_sedi - sedi
    print(f"Sedi org '{org}': {sorted(sedi)}")
    if missing_sedi:
        print(f"!! SEDI MANCANTI: {missing_sedi} — STOP")
        return

    # --- 1. Classi ---
    class_id = {}
    new_classes = 0
    for c in data["classes_to_create"]:
        key = (c["sede_id"], c["name"])
        ex = db.classes.find_one({"sede_id": c["sede_id"], "name": c["name"]})
        if ex:
            class_id[key] = ex["id"]
        elif APPLY:
            cid = str(uuid.uuid4())
            db.classes.insert_one({"id": cid, "name": c["name"],
                                   "sede_id": c["sede_id"], "teacher_id": None})
            class_id[key] = cid
            new_classes += 1
        else:
            class_id[key] = None  # verrebbe creata
            new_classes += 1
    print(f"\nClassi: {new_classes} da creare, {len(data['classes_to_create']) - new_classes} gia' presenti.")

    # --- 2. Bambini ---
    email_to_sids = {}   # email -> [student_id]
    email_to_sede = {}   # email -> sede del primo figlio
    new_students = existing_students = 0
    for s in data["students"]:
        key = (s["sede_id"], s["class_name"])
        cid = class_id.get(key)
        query = {"cognome": s["cognome"], "name": s["name"],
                 "sede_id": s["sede_id"], "date_of_birth": s["date_of_birth"]}
        if cid:
            query["class_id"] = cid
        ex = db.students.find_one(query) if cid else None
        if ex:
            existing_students += 1
            sid = ex["id"]
        else:
            sid = str(uuid.uuid4())
            new_students += 1
            if APPLY:
                db.students.insert_one({
                    "id": sid,
                    "name": s["name"],
                    "cognome": s["cognome"],
                    "class_id": cid,
                    "sede_id": s["sede_id"],
                    "date_of_birth": s["date_of_birth"] or "",
                    "child_code": f"GGT-{str(uuid.uuid4())[:4].upper()}",
                    "allergies": [],
                    "notes": "",
                    "parent_id": None,
                    "created_at": now_iso(),
                })
        em = s.get("email_genitore")
        if em:
            email_to_sids.setdefault(em, []).append(sid)
            email_to_sede.setdefault(em, s["sede_id"])
    print(f"Bambini: {new_students} nuovi, {existing_students} gia' presenti.")

    # --- 3. Genitori (dedup per email) ---
    name_by_email = {p["email"]: p["name"] for p in data["parents"]}
    new_parents = existing_parents = staff_conflicts = 0
    creds = []  # (email, nome, figli_ids, password) — solo in apply
    for email, sids in email_to_sids.items():
        ex = db.users.find_one({"email": email})
        if ex and ex.get("role") == "parent":
            existing_parents += 1
            if APPLY:
                db.users.update_one({"email": email},
                                    {"$addToSet": {"child_ids": {"$each": sids}},
                                     "$set": {"child_id": sids[-1]}})
        elif ex:
            staff_conflicts += 1
            print(f"  !! EMAIL gia' usata da account NON-parent: {email} — salto (verifica manuale)")
        else:
            new_parents += 1
            if APPLY:
                pw = gen_password()
                cognome = name_by_email.get(email, "").split()[-1] if name_by_email.get(email) else ""
                import bcrypt
                db.users.insert_one({
                    "id": str(uuid.uuid4()),
                    "name": name_by_email.get(email) or "Genitore",
                    "cognome": cognome,
                    "email": email,
                    "password": bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode(),
                    "role": "parent",
                    "is_superadmin": False,
                    "sede_id": email_to_sede[email],
                    "child_id": sids[-1],
                    "child_ids": sids,
                    "class_id": None,
                    "class_ids": [],
                    "firebase_uid": None,
                    "avatar_url": None,
                    "active": True,
                    "created_at": now_iso(),
                })
                creds.append((email, name_by_email.get(email) or "Genitore", ",".join(sids), pw))
    print(f"Genitori: {new_parents} nuovi, {existing_parents} gia' presenti"
          f"{f', {staff_conflicts} conflitti staff' if staff_conflicts else ''}.")

    # --- 3b. Maestre (teacher) — idempotente per email ---
    import bcrypt
    ORG = data["org_id"]
    new_staff = existing_staff = staff_conf = 0
    for s in data.get("staff", []):
        email = s.get("email")
        if not email:
            continue
        # risolvi class_ids dalle sezioni assegnate (create in sez.1)
        cids = [class_id.get((s["sede_id"], sez)) for sez in s.get("class_names", [])]
        cids = [c for c in cids if c]
        ex = db.users.find_one({"email": email})
        if ex and ex.get("role") == "teacher":
            existing_staff += 1
            if APPLY and cids:
                db.users.update_one({"email": email}, {"$addToSet": {"class_ids": {"$each": cids}}})
        elif ex:
            staff_conf += 1
            print(f"  !! EMAIL maestra gia' usata da NON-teacher: {email} — salto")
        else:
            new_staff += 1
            if APPLY:
                pw = gen_password()
                db.users.insert_one({
                    "id": str(uuid.uuid4()),
                    "name": s.get("name") or "Maestra",
                    "cognome": s.get("cognome") or "",
                    "email": email,
                    "password": bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode(),
                    "role": "teacher",
                    "is_superadmin": False,
                    "org_id": ORG,
                    "sede_id": s["sede_id"],
                    "class_id": cids[-1] if cids else None,
                    "class_ids": cids,
                    "child_id": None, "child_ids": [],
                    "firebase_uid": None, "avatar_url": None,
                    "active": True, "created_at": now_iso(),
                })
                creds.append((email, s.get("name") or "Maestra", ",".join(cids), pw))
    print(f"Maestre: {new_staff} nuove, {existing_staff} gia' presenti"
          f"{f', {staff_conf} conflitti' if staff_conf else ''}.")

    # --- 3c. Direttrici (admin superadmin) — idempotente per email ---
    new_dir = existing_dir = dir_conf = 0
    for d in data.get("direttrici", []):
        email = d.get("email")
        if not email:
            continue
        ex = db.users.find_one({"email": email})
        if ex and ex.get("role") == "admin":
            existing_dir += 1
            if APPLY:
                db.users.update_one({"email": email},
                                    {"$set": {"is_superadmin": True, "org_id": ORG}})
        elif ex:
            dir_conf += 1
            print(f"  !! EMAIL direttrice gia' usata da NON-admin: {email} — salto")
        else:
            new_dir += 1
            if APPLY:
                pw = gen_password()
                db.users.insert_one({
                    "id": str(uuid.uuid4()),
                    "name": d.get("name") or "Direttrice",
                    "cognome": d.get("cognome") or "",
                    "email": email,
                    "password": bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode(),
                    "role": "admin",
                    "is_superadmin": True,
                    "org_id": ORG,
                    "sede_id": None,
                    "class_id": None, "class_ids": [],
                    "child_id": None, "child_ids": [],
                    "firebase_uid": None, "avatar_url": None,
                    "active": True, "created_at": now_iso(),
                })
                creds.append((email, d.get("name") or "Direttrice", "SUPERADMIN", pw))
    print(f"Direttrici: {new_dir} nuove, {existing_dir} gia' presenti"
          f"{f', {dir_conf} conflitti' if dir_conf else ''}.")

    # --- 4. CSV credenziali (solo apply) ---
    if APPLY and creds:
        with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["email", "nome_account", "student_ids", "password_temporanea"])
            w.writerows(creds)
        print(f"\nCSV credenziali scritto: {CSV_PATH} ({len(creds)} righe).")

    print("\n" + "=" * 72)
    if APPLY:
        print("APPLY COMPLETATO. Rilancia in dry-run per confermare '0 nuovi record' (idempotenza).")
    else:
        print("DRY-RUN OK — nessuna scrittura eseguita.")
        print(f"Riepilogo: classi_nuove={new_classes}  bambini_nuovi={new_students}  "
              f"genitori_nuovi={new_parents}  conflitti_staff={staff_conflicts}  "
              f"maestre_nuove={new_staff}  direttrici_nuove={new_dir}")
    client.close()


if __name__ == "__main__":
    main()
