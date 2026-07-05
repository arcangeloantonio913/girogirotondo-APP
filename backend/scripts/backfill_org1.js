// backend/scripts/backfill_org1.js
// Backfill livello org — Tier 1 (orgs, sedi, users). Assegna ORG 1 a TUTTI i dati esistenti
// (Girogirotondo + Il Magico Mondo). NON tocca org 2 (non esiste ancora).
//
// Uso:   mongosh "<PROD_URI>/<DB_NAME>" backend/scripts/backfill_org1.js
//
// GATE APPLY:  APPLY=false = DRY-RUN (conta e verifica, NON scrive). Imposta true SOLO dopo
//              aver letto i conteggi del dry-run.
// Idempotente: filtra su {org_id:{$exists:false}} → non clobbera una futura org 2 e può
//              essere ri-eseguito senza danni.
//
// ORDINE CRITICO: orgs → SEDI → users. Le sedi ricevono org_id PRIMA degli utenti: se un
// superadmin ottenesse org_id mentre le sue sedi non ce l'hanno, get_valid_sede_ids(org)
// tornerebbe VUOTO → lockout. Il GATE 2b rende l'invariante fail-safe anche in caso di
// riordino accidentale delle righe.

const APPLY     = false;
const ORG1_ID   = "girogirotondo-group";
const ORG1_NAME = "Gruppo Girogirotondo";
const EXPECTED_SEDI = ["girogirotondo", "il-magico-mondo"];

// ── DRY-RUN / PRE-CHECK ────────────────────────────────────────────────────
print("=== DRY-RUN / PRE-CHECK ===");
const totSedi    = db.sedi.countDocuments({});
const sediNoOrg  = db.sedi.countDocuments({ org_id: { $exists: false } });
const totUsers   = db.users.countDocuments({});
const usersNoOrg = db.users.countDocuments({ org_id: { $exists: false } });
const superNoOrg = db.users.countDocuments({ is_superadmin: true, org_id: { $exists: false } });
printjson({ totSedi, sediNoOrg, totUsers, usersNoOrg, superNoOrg });
print("distinct org_id (sedi): " + JSON.stringify(db.sedi.distinct("org_id")));
print("sede ids presenti:      " + JSON.stringify(db.sedi.distinct("id")));

// GATE 1 — nessuna sede inattesa (ogni sede esistente è org 1; org 2 non esiste ancora).
const unexpected = db.sedi.distinct("id").filter(function (id) {
  return EXPECTED_SEDI.indexOf(id) === -1;
});
if (unexpected.length) {
  print("ATTENZIONE: sedi inattese (possibili duplicati prod): " + JSON.stringify(unexpected));
  print("            Decidi se fare la dedup PRIMA del backfill. Riceveranno comunque org 1.");
}

if (!APPLY) {
  print("DRY-RUN: nessuna scrittura eseguita. Rivedi i conteggi, poi imposta APPLY=true.");
  quit(0);
}

// ── WRITE (ordine CRITICO: orgs → SEDI → users) ────────────────────────────
print("=== WRITE (ordine CRITICO: orgs -> SEDI -> users) ===");

// 1) registry org 1 (upsert idempotente)
db.orgs.updateOne(
  { id: ORG1_ID },
  { $set: { id: ORG1_ID, name: ORG1_NAME, active: true },
    $setOnInsert: { created_at: new Date().toISOString() } },
  { upsert: true }
);

// 2) org_id sulle SEDI — DEVE precedere gli utenti. Solo le non-migrate (mai clobbera org 2).
const rSedi = db.sedi.updateMany(
  { org_id: { $exists: false } },
  { $set: { org_id: ORG1_ID } }
);
print("sedi org_id stampato: " + rSedi.modifiedCount);

// 2b) GATE FAIL-SAFE: NON toccare gli utenti finché ESISTE anche una sola sede senza org_id.
//     Rende l'invariante sedi-prima-di-users indipendente dall'ordine testuale.
const sediResidue = db.sedi.countDocuments({ org_id: { $exists: false } });
if (sediResidue > 0) {
  print("STOP: " + sediResidue + " sedi ancora senza org_id — NON procedo con gli utenti "
        + "(eviterei il lockout dei superadmin). Verifica le sedi e ri-esegui.");
  quit(1);
}

// 3) org_id sugli UTENTI — solo DOPO che tutte le sedi sono stampate (gate 2b superato).
const rUsers = db.users.updateMany(
  { org_id: { $exists: false } },
  { $set: { org_id: ORG1_ID } }
);
print("users org_id stampato: " + rUsers.modifiedCount);

// ── POST-CHECK (attesi: tutti 0 / coerenti) ────────────────────────────────
print("=== POST-CHECK ===");
printjson({
  orgExists:        db.orgs.countDocuments({ id: ORG1_ID }),                                       // 1
  sediSenzaOrg:     db.sedi.countDocuments({ org_id: { $exists: false } }),                        // 0
  usersSenzaOrg:    db.users.countDocuments({ org_id: { $exists: false } }),                       // 0
  superSenzaOrg:    db.users.countDocuments({ is_superadmin: true, org_id: { $exists: false } }),  // 0
  distinctOrgSedi:  db.sedi.distinct("org_id"),                                                    // ["girogirotondo-group"]
  distinctOrgUsers: db.users.distinct("org_id")                                                    // ["girogirotondo-group"]
});
