# Design — Raccolta Iscrizioni Scuole (white-label)

> Spec di design. Nasce dal dolore reale dell'import Dimensione Bimbo 2026/2027, dove i dati
> arrivavano da un quaderno cartaceo → 57 righe dubbie, split cognome/nome, date mancanti,
> email illeggibili. Obiettivo: ricevere dalle scuole dati **già strutturati e validati**,
> pronti per l'importer esistente.
>
> Data: 2026-09-14 · Stato: approvato per stesura piano · Autore: Anto + Claude

---

## 1. Obiettivo

Uno strumento web **brandizzato per scuola** ("Raccolta Iscrizioni") a cui la segreteria accede
tramite un **link con token dedicato**, dove può:

- **Modalità A — Scheda strutturata:** compilare in blocco tutti i bambini con campi validati.
- **Modalità B — Upload registro:** caricare scansioni pulite del registro cartaceo esistente.

Le submission vengono **archiviate nel backend**; un admin (Anto) le **revisiona da una dashboard**
e con un click genera il file `iscrizioni_normalized.json` che alimenta l'**importer esistente**
(`scripts/import/import_iscrizioni.py`) nel flusso attuale backup → dry-run → apply.

Servizio offerto alle scuole come "primo inserimento" durante l'onboarding.

## 2. Contesto (cosa esiste già e che riusiamo)

- **Frontend**: Create React App + craco + `react-router-dom` in `frontend/` (NON Next.js —
  il CLAUDE.md è datato). Routing centralizzato in `src/App.js`; `src/config/tenant.js` →
  branding per-tenant (colori, logo, footer, sedi) scelto a **build-time** via `REACT_APP_TENANT`,
  con deploy separato per tenant (`npm run build:dimensione-bimbo`).
- **Backend**: FastAPI + MongoDB (Motor). Router in `backend/routers/`, modelli in
  `backend/models/`, middleware `auth`, `rate_limiter`, `error_handler` già presenti.
- **Endpoint iscrizione**: `POST /api/users/iscrizione` (solo admin) crea studente + genitore;
  ne riusiamo la forma dei documenti.
- **Formato-bersaglio importer**: `scripts/import/iscrizioni_normalized.json`:
  ```json
  {
    "org_id": "dimensione-bimbo",
    "classes_to_create": [{ "sede_id": "...", "name": "..." }],
    "students": [{ "sede_id", "class_name", "name", "cognome", "date_of_birth", "email_genitore" }],
    "parents": [{ "email", "name" }]
  }
  ```
- **Storage**: Firebase Storage via `backend/utils/storage_helper.py`.
- **Multi-tenant**: livello `org` sopra le `sedi` (`backend/models/org.py`, `sede.py`).

## 3. Utenti e ruoli

- **Segreteria scuola** (non ha account app): accede solo con il token, compila/carica, invia.
- **Admin/superadmin org** (es. Cetty/Angela per DB; Anto per tutti): genera token, revisiona
  submission, esporta il file import.

## 4. Modello di accesso — token per scuola/org

- Nuova collection `intake_tokens`: `{ id, token, org_id, label, expires_at?, active, created_by, created_at }`.
  - `token` = stringa random ad alta entropia (es. `secrets.token_urlsafe(24)`), salvata **hashata**
    (stesso principio delle password: non conservare il token in chiaro nel DB).
- Link consegnato alla segreteria: `.../iscrizioni?t=<token>`.
- La pagina valida il token → ricava `org_id` e da lì branding + sedi/sezioni ammesse.
- Scadenza opzionale + revoca (flag `active`). Nessun dato sensibile è raggiungibile senza token valido.

## 5. La pagina pubblica — 2 modalità

Nuova route pubblica `react-router-dom` in `frontend/src/App.js` (es. `/iscrizioni`), con la pagina
in `frontend/src/pages/iscrizioni/`. Branding **build-time** via `tenant.js`/`REACT_APP_TENANT`
(ogni scuola ha il proprio deploy brandizzato); il token scopa org/dati lato backend.
Footer GDPR del tenant obbligatorio. All'ingresso: informativa privacy + selezione modalità.

### Modalità A — Scheda strutturata (bulk)
- Elenco "aggiungi bambino" con i campi:
  - **Nome** e **Cognome** (caselle **separate** → elimina alla radice lo split ambiguo).
  - **Data di nascita** obbligatoria, con validazione (range plausibile, no anni impossibili tipo 2026).
  - **Sede** (tendina: sedi dell'org) e **Sezione/Classe** (tendina: sezioni esistenti o nuove per sede).
  - **Genitore**: nome, cognome, **email** con validazione formato.
- Fratelli/gemelli: stessa email genitore → in export confluiscono in un unico account (come l'importer).
- Salvataggio **bozza** (riprendibile con lo stesso token) + **invio** finale.
- Validazione lato client E lato server (non fidarsi del client).

### Modalità B — Upload registro scansionato
- Upload multiplo di file (PDF/JPG/PNG), con:
  - Limite dimensione per file, tipi MIME ammessi.
  - Messaggio esplicito "carica scansioni pulite e leggibili" + esempio di buona/cattiva scansione.
- I file vanno su Firebase Storage (accesso ristretto), referenziati dalla submission.
- La trascrizione in dati strutturati avviene in **fase di revisione** admin (manuale/assistita;
  OCR automatico è fuori scope MVP, vedi §11).

## 6. Modello dati — `intake_submissions`

```
intake_submissions {
  id: str (uuid)
  org_id: str
  token_id: str            # riferimento a intake_tokens.id
  mode: "form" | "scan"
  status: "bozza" | "inviata" | "revisionata" | "importata"
  children: [              # popolato in modalità A (e dopo revisione in modalità B)
    { name, cognome, date_of_birth, sede_id, class_name,
      parent_nome, parent_cognome, parent_email }
  ]
  scans: [                 # popolato in modalità B
    { file_id, filename, storage_path, content_type, size, uploaded_at }
  ]
  created_at, updated_at, submitted_at?
}
```

- Indici: `org_id`, `status`, `token_id`.
- **Nota chiave**: in modalità A i `children` sono già normalizzati → l'export verso
  `iscrizioni_normalized.json` è una **mappatura diretta**, senza la fase "sporca" di `build_plan.py`.

## 7. API — nuovo router `backend/routers/intake.py`

Segue il pattern degli altri router (prefix `/api/intake`, dipendenze auth dove serve).

| Metodo | Path | Auth | Scopo |
|---|---|---|---|
| POST | `/api/intake/tokens` | admin | Crea token per un'org (`label`, `expires_at?`) → restituisce il token in chiaro **una sola volta** |
| GET | `/api/intake/tokens` | admin | Lista token dell'org (senza valore in chiaro) |
| DELETE | `/api/intake/tokens/{id}` | admin | Revoca (`active=false`) |
| GET | `/api/intake/config?t=` | token pubblico | Branding + sedi/sezioni ammesse per l'org del token |
| POST | `/api/intake/submissions?t=` | token pubblico | Crea/aggiorna bozza o invia (modalità A) |
| POST | `/api/intake/submissions/{id}/scans?t=` | token pubblico | Upload scansione (modalità B) |
| GET | `/api/intake/submissions` | admin | Lista submission dell'org (filtri stato/sede) |
| GET | `/api/intake/submissions/{id}` | admin | Dettaglio (children + scans) |
| PATCH | `/api/intake/submissions/{id}` | admin | Correggi children in revisione |
| POST | `/api/intake/submissions/{id}/export` | admin | Genera `iscrizioni_normalized.json` (download) e segna `revisionata` |

- Rate-limiting sugli endpoint pubblici (middleware esistente).
- Validazione server-side con modelli Pydantic in `backend/models/intake.py`.

## 8. Dashboard admin (revisione → import)

- Vista nel frontend (area admin esistente): lista submission per org/sede con stato.
- Dettaglio: **tabella bambini editabile** (correzione refusi prima dell'import) + **viewer scansioni**.
- Bottone **"Genera file import"** → scarica `iscrizioni_normalized.json`.
- La **creazione dei record NON è automatica**: da lì Anto esegue il flusso attuale
  (backup → `import_iscrizioni.py` dry-run → apply). Il doppio controllo umano resta invariato.

## 9. Branding white-label

- La pagina e la dashboard riusano `tenant.js` (colori/logo/footer/sedi).
- Il tenant è determinato dall'**org del token** → coerenza Girogirotondo vs Dimensione Bimbo.
- Girogirotondo resta byte-identico (nessuna regressione sul tenant esistente).

## 10. GDPR / sicurezza (dati di minori)

- Informativa privacy + footer legale del tenant in testa alla pagina.
- Token: alta entropia, salvato hashato, scadenza + revoca.
- Scansioni: Firebase Storage ad accesso ristretto; niente URL pubblici indicizzabili.
- Nessun dato raggiungibile senza token valido; validazione input server-side; rate-limiting.
- Minimizzazione: si raccolgono solo i campi elencati (niente telefono — coerente con lo schema `users`).

## 11. Fuori scope (YAGNI per l'MVP)

- Compilazione da parte dei singoli genitori (per ora la scuola compila tutto).
- **OCR automatico** delle scansioni: in MVP le scansioni si leggono in revisione; OCR = fase 2.
- Import automatico senza revisione umana.
- Editing avanzato delle sezioni/classi oltre "scegli esistente o creane una nuova".

## 12. Fasi di build (per il piano di implementazione)

1. **Backend fondamenta**: modelli `intake.py`, collection + indici, router token (CRUD) con auth admin.
2. **Config pubblica**: `GET /api/intake/config` con validazione token → branding + sedi/sezioni.
3. **Submission modalità A**: `POST /submissions` (bozza/invio) + validazione Pydantic.
4. **Submission modalità B**: upload scansioni su Firebase Storage.
5. **Pagina pubblica** (CRA + react-router) brandizzata: selezione modalità, scheda A, upload B, footer GDPR.
6. **Dashboard admin**: lista + dettaglio + editing children + viewer scansioni.
7. **Export**: `POST /{id}/export` → `iscrizioni_normalized.json` (mappatura diretta) + download.
8. **Test end-to-end** con token DB: compila → invia → revisiona → export → dry-run importer.

## 13. Criteri di successo

- Una scuola completa l'inserimento senza produrre righe "dubbie" (dati validati alla fonte).
- L'export si aggancia all'importer esistente senza modifiche al formato.
- Girogirotondo invariato; Dimensione Bimbo brandizzata correttamente.
- Nessun dato sensibile accessibile senza token valido.

## 14. Testing

- Unit: validatori campi (nome/cognome, DOB range, email), mappatura submission→normalized json.
- Integrazione: ciclo token→config→submission→export; controllo isolamento org (token DB non vede Giro).
- Sicurezza: token scaduto/revocato rifiutato; upload tipi non ammessi rifiutato; rate-limit.
