"""Logica di dominio Rette/Pagamenti — generazione addebiti e ricalcolo stato.

Separata dai router (che restano sottili) perché la generazione è multi-step e va
testata in isolamento. Nessuno stato globale: ogni funzione riceve `db`.

Stato addebito (`status`) = stato di INCASSO:
    da_pagare | parziale | pagato | stornato
Lo stato "scaduto" è DERIVATO (due_date < oggi e non ancora pagato) e calcolato in
lettura da `annotate(charge)` → non va persistito (cambia da solo col passare dei giorni).
"""
import uuid
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_str() -> str:
    """Data odierna 'YYYY-MM-DD' (UTC) — confronto lessicografico sicuro con le ISO date."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def net_amount(gross: float, discount_pct: float) -> float:
    """Importo al netto dello sconto, arrotondato ai centesimi."""
    gross = float(gross or 0)
    disc = float(discount_pct or 0)
    return round(gross * (1 - disc / 100.0), 2)


def annotate(charge: dict, today: str | None = None) -> dict:
    """Aggiunge campi derivati a un addebito per la UI: `residuo` e `scaduto`.
    Non modifica lo stato persistito."""
    today = today or today_str()
    amount = float(charge.get("amount") or 0)
    paid = float(charge.get("paid_amount") or 0)
    charge["residuo"] = round(max(amount - paid, 0), 2)
    due = charge.get("due_date") or ""
    not_settled = charge.get("status") in ("da_pagare", "parziale")
    charge["scaduto"] = bool(not_settled and due and due < today)
    return charge


def _settlement_status(amount: float, paid: float) -> str:
    amount = round(float(amount or 0), 2)
    paid = round(float(paid or 0), 2)
    if paid <= 0:
        return "da_pagare"
    if paid + 0.001 >= amount:
        return "pagato"
    return "parziale"


async def recompute_charge(db, charge_id: str) -> dict | None:
    """Ricalcola paid_amount + status di un addebito sommando i suoi pagamenti.
    Idempotente. Ritorna l'addebito aggiornato (senza _id)."""
    charge = await db.charges.find_one({"id": charge_id})
    if not charge:
        return None
    if charge.get("status") == "stornato":
        return {k: v for k, v in charge.items() if k != "_id"}
    rows = await db.payments.find({"charge_id": charge_id}, {"_id": 0, "amount": 1}).to_list(1000)
    paid = round(sum(float(r.get("amount") or 0) for r in rows), 2)
    status = _settlement_status(charge.get("amount"), paid)
    await db.charges.update_one(
        {"id": charge_id},
        {"$set": {"paid_amount": paid, "status": status, "updated_at": _now_iso()}},
    )
    charge["paid_amount"] = paid
    charge["status"] = status
    return {k: v for k, v in charge.items() if k != "_id"}


def _build_charge(sede_id, student_id, plan_id, component, assegnazione, period, due_date) -> dict:
    """Costruisce un documento addebito da una voce di piano + assegnazione."""
    key = component["key"]
    gross = float(assegnazione.get("overrides", {}).get(key, component["amount"]))
    disc = float(assegnazione.get("discount_pct") or 0)
    amount = net_amount(gross, disc)
    return {
        "id": str(uuid.uuid4()),
        "sede_id": sede_id,
        "student_id": student_id,
        "plan_id": plan_id,
        "assegnazione_id": assegnazione.get("id"),
        "period": period,
        "component_key": key,
        "description": component["label"],
        "gross_amount": round(gross, 2),
        "discount_pct": disc,
        "amount": amount,
        "due_date": due_date,
        "status": "da_pagare",
        "paid_amount": 0.0,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }


def _active_components(plan: dict, assegnazione: dict, kinds: set) -> list:
    disabled = set(assegnazione.get("disabled_components") or [])
    out = []
    for c in plan.get("components", []):
        if c.get("kind") in kinds and c.get("key") not in disabled:
            out.append(c)
    return out


async def generate_one_off_charges(db, sede_id: str, assegnazione: dict, plan: dict) -> list:
    """Genera gli addebiti una_tantum/annuale all'ATTIVAZIONE di una retta (es. iscrizione).
    Idempotente: salta le voci già presenti per quel bambino."""
    created = []
    for c in _active_components(plan, assegnazione, {"una_tantum", "annuale"}):
        exists = await db.charges.find_one({
            "student_id": assegnazione["student_id"],
            "component_key": c["key"],
            "period": "una_tantum" if c["kind"] == "una_tantum" else "annuale",
        })
        if exists:
            continue
        period = "una_tantum" if c["kind"] == "una_tantum" else "annuale"
        charge = _build_charge(sede_id, assegnazione["student_id"], plan["id"], c, assegnazione, period, None)
        await db.charges.insert_one(charge)
        charge.pop("_id", None)
        created.append(charge)
    return created


def _in_window(period: str, start: str | None, end: str | None) -> bool:
    """`period` (YYYY-MM) ricade nella finestra [start, end] della retta (estremi inclusi)."""
    if start and period < start:
        return False
    if end and period > end:
        return False
    return True


async def generate_monthly_charges(db, sede_id: str, period: str, due_day: int) -> dict:
    """Genera gli addebiti MENSILI per tutte le rette attive della sede in `period`.
    Idempotente: non duplica un addebito (bambino+voce+periodo) già esistente.
    Ritorna un riepilogo {creati, saltati, totale_euro}."""
    due_date = f"{period}-{due_day:02d}"
    assegnazioni = await db.student_fees.find(
        {"sede_id": sede_id, "active": True}, {"_id": 0}
    ).to_list(5000)

    # Cache piani per non rileggerli a ogni assegnazione
    plan_cache: dict = {}
    created, skipped, total = 0, 0, 0.0

    for a in assegnazioni:
        if not _in_window(period, a.get("start_month"), a.get("end_month")):
            continue
        # Il bambino deve esistere ancora nella sede (niente addebiti a fantasmi)
        student = await db.students.find_one(
            {"id": a["student_id"]}, {"_id": 0, "id": 1, "sede_id": 1}
        )
        if not student:
            continue

        plan = plan_cache.get(a["plan_id"])
        if plan is None:
            plan = await db.fee_plans.find_one({"id": a["plan_id"]}, {"_id": 0})
            if not plan:
                continue
            plan_cache[a["plan_id"]] = plan

        for c in _active_components(plan, a, {"mensile"}):
            exists = await db.charges.find_one({
                "student_id": a["student_id"],
                "component_key": c["key"],
                "period": period,
            })
            if exists:
                skipped += 1
                continue
            charge = _build_charge(sede_id, a["student_id"], plan["id"], c, a, period, due_date)
            await db.charges.insert_one(charge)
            created += 1
            total += charge["amount"]

    return {"period": period, "creati": created, "saltati": skipped, "totale_euro": round(total, 2)}
