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

- **Modalità A — Scheda strutturata:** compilare in blocco l'intera scuola con campi validati,
  organizzata in **tre sezioni**:
  - **Maestre (staff):** nome, cognome, email, sede, sezioni assegnate → crea account `teacher`
    già collegato alle classi che insegna (`class_ids`).
  - **Famiglie:** bambini + genitore di riferimento → crea `student` + account `parent` (come oggi).
  - **Direttrice:** nome, cognome, email → crea account `admin` `is_superadmin=True` dell'org
    (vede tutte le sedi dell'org, mai altri tenant), stesso pattern di `crea_superadmin_org2.py`.
- **Modalità B — Upload registro:** caricare scansioni pulite del registro cartaceo esistente.

Le submission vengono **archiviate nel backend**; un admin (Anto) le **revisiona da una dashboard**
e con un click genera il file `iscrizioni_normalized.json` (esteso con `staff` e `direttrici`) che
alimenta l'**importer** (`scripts/import/import_iscrizioni.py`, esteso in questo lavoro) nel flusso
backup → dry-run → apply.

Servizio offerto alle scuole come "primo inserimento" durante l'onboarding: staff, famiglie e
direzione in un unico passaggio strutturato.

## 2. Contesto (cosa esiste già e che riusiamo)

- **Frontend**: Create React App + craco + `react-router-dom` in `frontend/` (NON Next.js —
  il CLAUDE.md è datato). Routing centralizzato in `src/App.js`; `src/config/tenant.js` →
  branding per-tenant (colori, logo, footer, sedi) scelto a **build-time** via `REACT_APP_TENANT`,
  con deploy separato per tenant (`npm run build:dimensione-bimbo`).
- **Backend**: FastAPI + MongoDB (Motor). Router in `backend/routers/`, modelli in
  `backend/models/`, middleware `auth`, `rate_limiter`, `error_handler` già presenti.
- **Endpoint iscrizione**: `POST /api/users/iscrizione` (solo admin) crea studente + genitore;
  ne riusiamo la forma dei documenti.
- **Formato-bersaglio importer** (esteso in questo lavoro): `scripts/import/iscrizioni_normalized.json`:
  ```json
  {
    "org_id": "dimensione-bimbo",
    "classes_to_create": [{ "sede_id": "...", "name": "..." }],
    "students": [{ "sede_id", "class_name", "name", "cognome", "date_of_birth", "email_genitore" }],
    "parents": [{ "email", "name" }],
    "staff": [{ "email", "name", "cognome", "sede_id", "class_names": ["..."] }],
    "direttrici": [{ "email", "name", "cognome" }]
  }
  ```
  Le chiavi `students`/`parents`/`classes_to_create` restano invariate (retro-compatibili);
  `staff` e `direttrici` sono nuove e opzionali (assenti = comportamento identico a oggi).
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

### Modalità A — Scheda strutturata (bulk), 3 sezioni
La pagina presenta tre sezioni compilabili (una submission può contenerle tutte):

**A.1 — Maestre (staff):** righe con **Nome**, **Cognome**, **email** (validata), **Sede** (tendina),
**Sezioni assegnate** (multi-selezione dalle sezioni della sede; anche più di una). → account `teacher`.

**A.2 — Famiglie (bambini + genitore):** righe con
  - **Nome** e **Cognome** del bambino (caselle **separate** → elimina lo split ambiguo).
  - **Data di nascita** obbligatoria, validata (range plausibile, no anni impossibili tipo 2026).
  - **Sede** (tendina) e **Sezione/Classe** (tendina: esistenti o nuove per sede).
  - **Genitore**: nome, cognome, **email** validata.
  - Fratelli/gemelli: stessa email genitore → in export confluiscono in un unico account `parent`.

**A.3 — Direttrice:** righe con **Nome**, **Cognome**, **email** (validata). → account `admin`
`is_superadmin=True` dell'org. Può essercene più di una (es. Cetty + Angela).

- Le sezioni citate dalle maestre alimentano `classes_to_create` anche se non hanno bambini.
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

Nomi campo in italiano, coerenti coi modelli Pydantic già implementati (`backend/models/intake.py`).

```
intake_submissions {
  id: str (uuid)
  org_id: str
  token_id: str            # riferimento a intake_tokens.id
  mode: "form" | "scan"
  status: "bozza" | "inviata" | "revisionata" | "importata"
  children: [              # sezione Famiglie (bambino + genitore di riferimento)
    { nome, cognome, data_nascita, sede_id, classe,
      genitore_nome, genitore_cognome, genitore_email }
  ]
  staff: [                 # sezione Maestre
    { nome, cognome, email, sede_id, sezioni: ["..."] }
  ]
  direttrici: [            # sezione Direttrice
    { nome, cognome, email }
  ]
  scans: [                 # popolato in modalità B
    { file_id, filename, storage_path, content_type, size, uploaded_at }
  ]
  created_at, updated_at, submitted_at?
}
```

- Indici: `org_id`, `status`, `token_id`.
- **Nota chiave**: in modalità A i dati sono già normalizzati → l'export verso
  `iscrizioni_normalized.json` è una **mappatura diretta**, senza la fase "sporca" di `build_plan.py`.
- `staff`/`direttrici` sono opzionali: una submission può contenere solo famiglie, o tutte e tre.

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
| PATCH | `/api/intake/submissions/{id}` | admin | Correggi children/staff/direttrici in revisione |
| POST | `/api/intake/submissions/{id}/export` | admin | Genera `iscrizioni_normalized.json` esteso (students+parents+classes+staff+direttrici) e segna `revisionata` |

Il payload di `POST /submissions` porta `children`, `staff`, `direttrici` (tutti opzionali).

- Rate-limiting sugli endpoint pubblici (middleware esistente).
- Validazione server-side con modelli Pydantic in `backend/models/intake.py`.

## 8. Dashboard admin (revisione → import)

- Vista nel frontend (area admin esistente): lista submission per org/sede con stato.
- Dettaglio: tabelle editabili per **Maestre**, **Famiglie (bambini)** e **Direttrice**
  (correzione refusi prima dell'import) + **viewer scansioni**.
- Bottone **"Genera file import"** → scarica `iscrizioni_normalized.json` (esteso).
- La **creazione dei record NON è automatica**: da lì Anto esegue il flusso attuale
  (backup → `import_iscrizioni.py` dry-run → apply). Il doppio controllo umano resta invariato.
- ⚠️ La direttrice diventa **superadmin** dell'org: verificare con attenzione la sezione
  Direttrice in revisione prima dell'apply (account privilegiato).

## 9. Branding white-label

- La pagina e la dashboard riusano `tenant.js` (colori/logo/footer/sedi).
- Il tenant è determinato dall'**org del token** → coerenza Girogirotondo vs Dimensione Bimbo.
- Girogirotondo resta byte-identico (nessuna regressione sul tenant esistente).

## 10. GDPR / sicurezza (dati di minori + adulti)

- Informativa privacy + footer legale del tenant in testa alla pagina.
- Token: alta entropia, salvato hashato, scadenza + revoca.
- Scansioni: Firebase Storage ad accesso ristretto; niente URL pubblici indicizzabili.
- Nessun dato raggiungibile senza token valido; validazione input server-side; rate-limiting.
- Minimizzazione: si raccolgono solo i campi elencati (niente telefono — coerente con lo schema `users`).
- La scheda raccoglie anche dati di **adulti** (maestre, direttrice): stesse tutele; email trattate
  per creare gli account di servizio.
- L'account **superadmin** (direttrice) è privilegiato: creazione solo previa revisione admin
  (mai auto-applicata dalla submission).

## 11. Fuori scope (YAGNI per l'MVP)

- Compilazione da parte dei singoli genitori (per ora la scuola compila tutto).
- **OCR automatico** delle scansioni: in MVP le scansioni si leggono in revisione; OCR = fase 2.
- Import automatico senza revisione umana.
- Editing avanzato delle sezioni/classi oltre "scegli esistente o creane una nuova".

## 12. Fasi di build (per il piano di implementazione)

1. **Backend fondamenta**: modelli `intake.py` (incl. `IntakeStaff`, `IntakeDirettrice`), router token (CRUD) con auth admin.
2. **Config pubblica**: `GET /api/intake/config` con validazione token → sedi/sezioni.
3. **Submission modalità A**: `POST /submissions` (bozza/invio) con `children`+`staff`+`direttrici` + validazione Pydantic.
4. **Submission modalità B**: upload scansioni su Firebase Storage.
5. **Pagina pubblica** (CRA + react-router) brandizzata: 3 sezioni (maestre/famiglie/direttrice), upload B, footer GDPR.
6. **Dashboard admin**: lista + dettaglio + editing delle 3 sezioni + viewer scansioni.
7. **Export**: `POST /{id}/export` → `iscrizioni_normalized.json` esteso (students+parents+classes+staff+direttrici) + download.
8. **Estensione importer**: `import_iscrizioni.py` crea anche `teacher` (con `class_ids`) e `superadmin` (idempotente).
9. **Test end-to-end** con token DB: compila 3 sezioni → invia → revisiona → export → dry-run importer.

## 13. Criteri di successo

- Una scuola completa l'inserimento senza produrre righe "dubbie" (dati validati alla fonte).
- L'export si aggancia all'importer esistente senza modifiche al formato.
- Girogirotondo invariato; Dimensione Bimbo brandizzata correttamente.
- Nessun dato sensibile accessibile senza token valido.

## 14. Testing

- Unit: validatori campi (nome/cognome, DOB range, email), mappatura submission→normalized json.
- Integrazione: ciclo token→config→submission→export; controllo isolamento org (token DB non vede Giro).
- Sicurezza: token scaduto/revocato rifiutato; upload tipi non ammessi rifiutato; rate-limit.
