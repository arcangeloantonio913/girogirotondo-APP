# Raccolta Iscrizioni Scuole — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire uno strumento white-label ("Raccolta Iscrizioni") dove una scuola, via link con token dedicato, inserisce i bambini in una scheda validata o carica scansioni del registro; le submission sono archiviate, un admin le revisiona ed esporta `iscrizioni_normalized.json` per l'importer esistente.

**Architecture:** Backend FastAPI + MongoDB (nuovo router `intake.py`, collection `intake_tokens` e `intake_submissions`), autenticazione pubblica via token hashato (SHA-256) e admin via `get_current_user`/`_require_admin`, isolamento per `org_id`. Frontend Create React App + craco + react-router-dom: route pubblica `/iscrizioni` brandizzata via `tenant.js` (branding build-time per tenant) + pagina admin `/admin/iscrizioni`. L'export produce esattamente il formato già consumato da `scripts/import/import_iscrizioni.py`.

**Tech Stack:** Python 3, FastAPI, Motor/MongoDB, Pydantic v2, pytest + pytest-asyncio + mongomock-motor + httpx; React 18, react-router-dom v6, axios, craco; Firebase Storage (via `backend/utils/storage_helper.py`).

**Spec di riferimento:** `docs/superpowers/specs/2026-09-14-raccolta-iscrizioni-scuole-design.md`

---

## File Structure

**Backend (nuovi):**
- `backend/models/intake.py` — modelli Pydantic (token, child, submission, export request).
- `backend/routers/intake.py` — router `/api/intake` + dependency token.
- `tests/test_intake.py` — test pytest end-to-end del router.

**Backend (modificati):**
- `backend/main.py` — registra `intake_router`.

**Frontend (nuovi):**
- `frontend/src/lib/intakeApi.js` — funzioni client per gli endpoint intake.
- `frontend/src/pages/iscrizioni/IscrizioniPage.jsx` — landing pubblica (token → config → modalità).
- `frontend/src/pages/iscrizioni/SchedaStrutturata.jsx` — modalità A (form bulk).
- `frontend/src/pages/iscrizioni/UploadRegistro.jsx` — modalità B (upload scansioni).
- `frontend/src/pages/admin/AdminIscrizioni.jsx` — dashboard admin (lista/dettaglio/export).

**Frontend (modificati):**
- `frontend/src/App.js` — nuova route pubblica `/iscrizioni` + route admin `/admin/iscrizioni`.
- `frontend/src/components/layout/*` (menu admin) — link "Iscrizioni" (path individuato in Task 13).

---

# PARTE A — BACKEND (TDD con pytest)

Comando test di riferimento (da repo root): `python -m pytest tests/test_intake.py -v`
Il test harness (`tests/conftest.py`) usa mongomock-motor in-memory con org seed:
`ORG1="girogirotondo-group"` (sedi `girogirotondo`, `il-magico-mondo`), `ORG2="dimensione-bimbo"` (sede `db-sede-1`, classe `db-class-1`).
Fixture disponibili: `client`, `admin_headers` (org1), `super_headers` (superadmin org1), `super2_headers` (superadmin org2), `db2_admin_headers` (admin org2), `parent_headers`.

---

### Task 1: Modelli Pydantic `intake.py`

**Files:**
- Create: `backend/models/intake.py`
- Test: `tests/test_intake.py`

- [ ] **Step 1: Write the failing test**

Crea `tests/test_intake.py` con:

```python
"""Test del router Raccolta Iscrizioni (/api/intake)."""
import pytest
from services.database import get_db


def test_models_import_and_validate():
    from models.intake import (
        IntakeTokenCreate, IntakeChild, IntakeSubmissionUpsert,
    )
    tok = IntakeTokenCreate(label="Segreteria DB")
    assert tok.label == "Segreteria DB"

    child = IntakeChild(
        nome="Alice", cognome="Grasso", data_nascita="2021-05-30",
        sede_id="db-sede-1", classe="Infanzia — Valeria",
        genitore_nome="Simona", genitore_cognome="Ferracane",
        genitore_email="mail@example.com",
    )
    assert child.nome == "Alice"

    sub = IntakeSubmissionUpsert(mode="form", children=[child], status="bozza")
    assert sub.children[0].cognome == "Grasso"


def test_child_rejects_bad_date():
    from models.intake import IntakeChild
    with pytest.raises(Exception):
        IntakeChild(
            nome="X", cognome="Y", data_nascita="2035-01-01",  # anno futuro implausibile
            sede_id="db-sede-1", classe="C",
            genitore_nome="A", genitore_cognome="B", genitore_email="a@b.it",
        )


def test_child_rejects_bad_email():
    from models.intake import IntakeChild
    with pytest.raises(Exception):
        IntakeChild(
            nome="X", cognome="Y", data_nascita="2021-01-01",
            sede_id="db-sede-1", classe="C",
            genitore_nome="A", genitore_cognome="B", genitore_email="non-una-email",
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intake.py::test_models_import_and_validate -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'models.intake'`

- [ ] **Step 3: Write minimal implementation**

Crea `backend/models/intake.py`:

```python
"""Modelli Raccolta Iscrizioni — token scuola + submission (scheda/scansioni)."""
import re
from datetime import date
from typing import List, Optional, Literal

from pydantic import BaseModel, EmailStr, field_validator

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class IntakeTokenCreate(BaseModel):
    """Creazione token per una scuola. org_id è imposto server-side (mai dal body)."""
    label: str
    expires_at: Optional[str] = None   # ISO8601, opzionale

    @field_validator("label")
    @classmethod
    def _label(cls, v):
        if not v or not v.strip():
            raise ValueError("Etichetta obbligatoria")
        return v.strip()


class IntakeChild(BaseModel):
    """Un bambino nella scheda strutturata (modalità form)."""
    nome: str
    cognome: str
    data_nascita: str                  # YYYY-MM-DD (obbligatoria in modalità form)
    sede_id: str
    classe: str                        # nome sezione/classe (esistente o nuova)
    genitore_nome: str
    genitore_cognome: str
    genitore_email: EmailStr

    @field_validator("nome", "cognome", "sede_id", "classe", "genitore_nome", "genitore_cognome")
    @classmethod
    def _non_empty(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Campo obbligatorio")
        return str(v).strip()

    @field_validator("data_nascita")
    @classmethod
    def _valid_date(cls, v):
        v = (v or "").strip()
        if not _DATE_RE.match(v):
            raise ValueError("Data non valida: usa il formato AAAA-MM-GG")
        try:
            d = date.fromisoformat(v)
        except ValueError:
            raise ValueError("Data inesistente")
        # Range plausibile per un iscritto a nido/infanzia: 0–7 anni circa.
        if not (date(2015, 1, 1) <= d <= date.today()):
            raise ValueError("Data di nascita fuori dall'intervallo plausibile")
        return v


class IntakeSubmissionUpsert(BaseModel):
    """Crea/aggiorna una submission in modalità form (bozza o invio)."""
    mode: Literal["form", "scan"] = "form"
    status: Literal["bozza", "inviata"] = "bozza"
    children: List[IntakeChild] = []
    submission_id: Optional[str] = None   # se presente → update della bozza esistente


class IntakeChildPatch(BaseModel):
    """Correzione admin di un bambino in revisione (tutti opzionali)."""
    nome: Optional[str] = None
    cognome: Optional[str] = None
    data_nascita: Optional[str] = None
    sede_id: Optional[str] = None
    classe: Optional[str] = None
    genitore_nome: Optional[str] = None
    genitore_cognome: Optional[str] = None
    genitore_email: Optional[str] = None


class IntakeSubmissionPatch(BaseModel):
    """PATCH admin: sostituisce l'elenco children corretto."""
    children: Optional[List[IntakeChildPatch]] = None
    status: Optional[Literal["bozza", "inviata", "revisionata", "importata"]] = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intake.py -v -k "models or bad_date or bad_email"`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add backend/models/intake.py tests/test_intake.py
git commit -m "feat(intake): modelli Pydantic token + submission scheda iscrizioni"
```

---

### Task 2: Router token + registrazione + dependency

**Files:**
- Create: `backend/routers/intake.py`
- Modify: `backend/main.py` (import + include_router)
- Test: `tests/test_intake.py`

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/test_intake.py`:

```python
@pytest.mark.asyncio
async def test_admin_creates_token_bound_to_own_org(client, super2_headers):
    db = get_db()
    try:
        r = await client.post("/api/intake/tokens", json={"label": "Segreteria DB"},
                              headers=super2_headers)
        assert r.status_code == 201
        body = r.json()
        # il token in chiaro è restituito UNA sola volta
        assert body["token"] and len(body["token"]) >= 20
        assert body["org_id"] == "dimensione-bimbo"
        # nel DB è salvato SOLO l'hash, mai il valore in chiaro
        doc = await db.intake_tokens.find_one({"id": body["id"]})
        assert "token" not in doc and doc["token_hash"] != body["token"]
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_non_admin_cannot_create_token(client, parent_headers):
    r = await client.post("/api/intake/tokens", json={"label": "x"}, headers=parent_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_list_and_revoke_token(client, super2_headers):
    db = get_db()
    try:
        c = await client.post("/api/intake/tokens", json={"label": "T"}, headers=super2_headers)
        tid = c.json()["id"]
        lst = await client.get("/api/intake/tokens", headers=super2_headers)
        assert lst.status_code == 200
        assert any(t["id"] == tid for t in lst.json())
        # la lista NON espone token/token_hash
        assert all("token" not in t and "token_hash" not in t for t in lst.json())
        d = await client.delete(f"/api/intake/tokens/{tid}", headers=super2_headers)
        assert d.status_code == 200
        doc = await db.intake_tokens.find_one({"id": tid})
        assert doc["active"] is False
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intake.py -v -k "token"`
Expected: FAIL con 404 (route inesistente)

- [ ] **Step 3: Write minimal implementation**

Crea `backend/routers/intake.py`:

```python
"""Raccolta Iscrizioni — /api/intake.

- Token per scuola: creato/gestito solo da admin, legato all'org del creatore.
  Nel DB si salva SOLO l'hash SHA-256 del token; il valore in chiaro è mostrato una volta.
- Endpoint pubblici (config/submission/scan): autenticati SOLO dal token (query ?t=).
- Endpoint admin (lista/dettaglio/patch/export): get_current_user + isolamento per org_id.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from services.database import get_db
from middleware.auth import get_current_user
from models.intake import (
    IntakeTokenCreate, IntakeSubmissionUpsert, IntakeSubmissionPatch,
)

router = APIRouter(prefix="/api/intake", tags=["intake"])


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eseguire questa operazione")


def _caller_org(current_user: dict) -> str:
    org = current_user.get("org_id")
    if not org:
        raise HTTPException(status_code=400, detail="Account senza org_id: impossibile gestire iscrizioni")
    return org


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Dependency: autenticazione via token pubblico (?t=) ──────────────────────
async def get_intake_token(t: Optional[str] = None) -> dict:
    if not t:
        raise HTTPException(status_code=401, detail="Token mancante")
    db = get_db()
    doc = await db.intake_tokens.find_one(
        {"token_hash": _hash_token(t), "active": True}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=401, detail="Link non valido o revocato")
    exp = doc.get("expires_at")
    if exp and exp < _now_iso():
        raise HTTPException(status_code=401, detail="Link scaduto")
    return doc


# ── Token admin CRUD ─────────────────────────────────────────────────────────
@router.post("/tokens", status_code=201)
async def create_token(payload: IntakeTokenCreate, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    raw = secrets.token_urlsafe(24)
    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org,
        "label": payload.label,
        "token_hash": _hash_token(raw),
        "expires_at": payload.expires_at,
        "active": True,
        "created_by": current_user.get("id"),
        "created_at": _now_iso(),
    }
    await db.intake_tokens.insert_one(doc)
    # token in chiaro restituito UNA sola volta
    return {"id": doc["id"], "org_id": org, "label": doc["label"], "token": raw}


@router.get("/tokens")
async def list_tokens(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    rows = await db.intake_tokens.find(
        {"org_id": org}, {"_id": 0, "token_hash": 0}
    ).to_list(200)
    return rows


@router.delete("/tokens/{token_id}")
async def revoke_token(token_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    res = await db.intake_tokens.update_one(
        {"id": token_id, "org_id": org}, {"$set": {"active": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Token non trovato")
    return {"ok": True, "id": token_id}
```

Modifica `backend/main.py` — aggiungi accanto agli altri import di router (dopo la riga `from routers.presenze import ...`):

```python
from routers.intake import router as intake_router
```

e accanto agli altri `app.include_router(...)` (dopo `app.include_router(presenze_router)`):

```python
app.include_router(intake_router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intake.py -v -k "token"`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add backend/routers/intake.py backend/main.py tests/test_intake.py
git commit -m "feat(intake): router token scuola (crea/lista/revoca) + registrazione"
```

---

### Task 3: Config pubblica via token

**Files:**
- Modify: `backend/routers/intake.py`
- Test: `tests/test_intake.py`

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/test_intake.py`:

```python
async def _make_token(client, headers, label="T"):
    r = await client.post("/api/intake/tokens", json={"label": label}, headers=headers)
    return r.json()["token"], r.json()["id"]


@pytest.mark.asyncio
async def test_config_returns_org_and_sedi(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        r = await client.get(f"/api/intake/config?t={raw}")
        assert r.status_code == 200
        body = r.json()
        assert body["org_id"] == "dimensione-bimbo"
        # sedi dell'org (dal seed: db-sede-1)
        assert any(s["id"] == "db-sede-1" for s in body["sedi"])
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_config_rejects_missing_or_bad_token(client):
    assert (await client.get("/api/intake/config")).status_code == 401
    assert (await client.get("/api/intake/config?t=garbage")).status_code == 401


@pytest.mark.asyncio
async def test_config_rejects_revoked_token(client, super2_headers):
    db = get_db()
    try:
        raw, tid = await _make_token(client, super2_headers)
        await client.delete(f"/api/intake/tokens/{tid}", headers=super2_headers)
        assert (await client.get(f"/api/intake/config?t={raw}")).status_code == 401
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intake.py -v -k "config"`
Expected: FAIL con 404 (route inesistente)

- [ ] **Step 3: Write minimal implementation**

Aggiungi in fondo a `backend/routers/intake.py`:

```python
# ── Config pubblica (branding-data + sedi) ───────────────────────────────────
@router.get("/config")
async def public_config(token: dict = Depends(get_intake_token)):
    """Dati necessari alla pagina pubblica: org + sedi attive dell'org. Il branding
    visivo è build-time (tenant.js); qui forniamo solo i DATI (org, sedi, sezioni note)."""
    db = get_db()
    org = token["org_id"]
    sedi = await db.sedi.find(
        {"org_id": org, "active": True}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(50)
    # sezioni/classi già esistenti per sede (per il menù a tendina "scegli esistente")
    sede_ids = [s["id"] for s in sedi]
    classes = await db.classes.find(
        {"sede_id": {"$in": sede_ids}}, {"_id": 0, "sede_id": 1, "name": 1}
    ).to_list(500)
    sezioni_by_sede = {}
    for c in classes:
        sezioni_by_sede.setdefault(c["sede_id"], []).append(c["name"])
    return {"org_id": org, "sedi": sedi, "sezioni_by_sede": sezioni_by_sede}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intake.py -v -k "config"`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add backend/routers/intake.py tests/test_intake.py
git commit -m "feat(intake): endpoint pubblico /config (org + sedi + sezioni) via token"
```

---

### Task 4: Submission modalità form (crea/aggiorna/invia)

**Files:**
- Modify: `backend/routers/intake.py`
- Test: `tests/test_intake.py`

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/test_intake.py`:

```python
def _child(**over):
    base = dict(nome="Alice", cognome="Grasso", data_nascita="2021-05-30",
                sede_id="db-sede-1", classe="Infanzia — Valeria",
                genitore_nome="Simona", genitore_cognome="Ferracane",
                genitore_email="mail@example.com")
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_submission_create_draft_then_submit(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        # crea bozza
        r = await client.post(f"/api/intake/submissions?t={raw}", json={
            "mode": "form", "status": "bozza", "children": [_child()],
        })
        assert r.status_code == 201
        sid = r.json()["id"]
        assert r.json()["org_id"] == "dimensione-bimbo"
        assert r.json()["status"] == "bozza"
        # aggiorna la stessa bozza (submission_id) e invia
        r2 = await client.post(f"/api/intake/submissions?t={raw}", json={
            "mode": "form", "status": "inviata", "submission_id": sid,
            "children": [_child(), _child(nome="Marco", genitore_email="due@example.com")],
        })
        assert r2.status_code == 201
        assert r2.json()["id"] == sid   # stessa submission aggiornata
        doc = await db.intake_submissions.find_one({"id": sid})
        assert doc["status"] == "inviata" and len(doc["children"]) == 2
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_submission_rejects_invalid_child(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        r = await client.post(f"/api/intake/submissions?t={raw}", json={
            "mode": "form", "status": "inviata",
            "children": [_child(data_nascita="2040-01-01")],
        })
        assert r.status_code == 422
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_submission_requires_valid_token(client):
    r = await client.post("/api/intake/submissions?t=bad", json={"mode": "form", "children": []})
    assert r.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intake.py -v -k "submission and (draft or invalid_child or requires_valid)"`
Expected: FAIL con 404 (route inesistente)

- [ ] **Step 3: Write minimal implementation**

Aggiungi in fondo a `backend/routers/intake.py`:

```python
# ── Submission modalità form ─────────────────────────────────────────────────
@router.post("/submissions", status_code=201)
async def upsert_submission(payload: IntakeSubmissionUpsert, token: dict = Depends(get_intake_token)):
    db = get_db()
    org = token["org_id"]
    # sedi valide dell'org: rifiuta children che puntano fuori org
    valid_sedi = {s["id"] for s in await db.sedi.find(
        {"org_id": org, "active": True}, {"_id": 0, "id": 1}).to_list(50)}
    for c in payload.children:
        if c.sede_id not in valid_sedi:
            raise HTTPException(status_code=400, detail=f"Sede '{c.sede_id}' non valida per questa scuola")

    children = [c.model_dump() for c in payload.children]
    now = _now_iso()

    if payload.submission_id:
        res = await db.intake_submissions.update_one(
            {"id": payload.submission_id, "org_id": org},
            {"$set": {"children": children, "status": payload.status,
                      "mode": payload.mode, "updated_at": now,
                      **({"submitted_at": now} if payload.status == "inviata" else {})}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Bozza non trovata")
        doc = await db.intake_submissions.find_one({"id": payload.submission_id}, {"_id": 0})
        return doc

    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org,
        "token_id": token["id"],
        "mode": payload.mode,
        "status": payload.status,
        "children": children,
        "scans": [],
        "created_at": now,
        "updated_at": now,
        "submitted_at": now if payload.status == "inviata" else None,
    }
    await db.intake_submissions.insert_one(doc)
    doc.pop("_id", None)
    return doc
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intake.py -v -k "submission and (draft or invalid_child or requires_valid)"`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add backend/routers/intake.py tests/test_intake.py
git commit -m "feat(intake): submission modalità form (bozza/invio) con validazione sede/org"
```

---

### Task 5: Upload scansioni (modalità scan)

**Files:**
- Modify: `backend/routers/intake.py`
- Test: `tests/test_intake.py`

**Nota:** `storage_helper.upload_file` è async e usa Firebase (non attivo nei test). Per testarlo lo mockiamo con `unittest.mock.patch` sul nome importato nel router.

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/test_intake.py` (import in cima al file: `from unittest.mock import patch`):

```python
@pytest.mark.asyncio
async def test_scan_upload_stores_reference(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        # crea submission scan vuota
        r = await client.post(f"/api/intake/submissions?t={raw}",
                              json={"mode": "scan", "status": "bozza", "children": []})
        sid = r.json()["id"]
        with patch("routers.intake.storage_upload_file", return_value="intake/db/scan1.jpg"):
            files = {"file": ("registro.jpg", b"\xff\xd8\xff\xe0fakejpeg", "image/jpeg")}
            up = await client.post(f"/api/intake/submissions/{sid}/scans?t={raw}", files=files)
        assert up.status_code == 201
        doc = await db.intake_submissions.find_one({"id": sid})
        assert len(doc["scans"]) == 1
        assert doc["scans"][0]["storage_path"] == "intake/db/scan1.jpg"
        assert doc["scans"][0]["filename"] == "registro.jpg"
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_scan_upload_rejects_bad_type(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        r = await client.post(f"/api/intake/submissions?t={raw}",
                              json={"mode": "scan", "status": "bozza", "children": []})
        sid = r.json()["id"]
        files = {"file": ("virus.exe", b"MZ", "application/octet-stream")}
        up = await client.post(f"/api/intake/submissions/{sid}/scans?t={raw}", files=files)
        assert up.status_code == 400
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intake.py -v -k "scan_upload"`
Expected: FAIL con 404 (route inesistente) o AttributeError sul nome patchato

- [ ] **Step 3: Write minimal implementation**

In cima a `backend/routers/intake.py`, aggiungi l'import con alias (così il test può patcharlo):

```python
from utils.storage_helper import upload_file as storage_upload_file
```

Aggiungi in fondo al file:

```python
# ── Upload scansione registro (modalità scan) ────────────────────────────────
_ALLOWED_SCAN_TYPES = {"image/jpeg", "image/png", "application/pdf"}


@router.post("/submissions/{submission_id}/scans", status_code=201)
async def upload_scan(submission_id: str, token: dict = Depends(get_intake_token),
                      file: UploadFile = File(...)):
    if file.content_type not in _ALLOWED_SCAN_TYPES:
        raise HTTPException(status_code=400, detail="Tipo file non ammesso: usa JPG, PNG o PDF")
    db = get_db()
    org = token["org_id"]
    sub = await db.intake_submissions.find_one({"id": submission_id, "org_id": org})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission non trovata")

    data = await file.read()
    file_id = str(uuid.uuid4())
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin")
    dest = f"intake/{org}/{submission_id}/{file_id}.{ext}"
    # media_type governa la compressione lato storage_helper: "document" = nessuna compressione
    storage_path = await storage_upload_file(data, dest, file.content_type, media_type="document")

    scan = {
        "file_id": file_id,
        "filename": file.filename,
        "storage_path": storage_path,
        "content_type": file.content_type,
        "size": len(data),
        "uploaded_at": _now_iso(),
    }
    await db.intake_submissions.update_one(
        {"id": submission_id}, {"$push": {"scans": scan}, "$set": {"updated_at": _now_iso()}}
    )
    return {"ok": True, "scan": scan}
```

**Nota di verifica:** conferma la firma reale di `upload_file` in `backend/utils/storage_helper.py:70` (parametri `data`, `destination_path`, `content_type`, `media_type`). Se i nomi differiscono, adegua la chiamata mantenendo l'alias `storage_upload_file`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intake.py -v -k "scan_upload"`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add backend/routers/intake.py tests/test_intake.py
git commit -m "feat(intake): upload scansioni registro su storage (JPG/PNG/PDF)"
```

---

### Task 6: Admin lista/dettaglio/patch con isolamento org

**Files:**
- Modify: `backend/routers/intake.py`
- Test: `tests/test_intake.py`

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/test_intake.py`:

```python
@pytest.mark.asyncio
async def test_admin_list_and_detail_and_org_isolation(client, super2_headers, super_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        cr = await client.post(f"/api/intake/submissions?t={raw}",
                               json={"mode": "form", "status": "inviata", "children": [_child()]})
        sid = cr.json()["id"]
        # super2 (org DB) vede la submission
        lst = await client.get("/api/intake/submissions", headers=super2_headers)
        assert lst.status_code == 200 and any(s["id"] == sid for s in lst.json())
        det = await client.get(f"/api/intake/submissions/{sid}", headers=super2_headers)
        assert det.status_code == 200 and det.json()["children"][0]["nome"] == "Alice"
        # super (org1) NON vede le submission dell'org DB
        lst1 = await client.get("/api/intake/submissions", headers=super_headers)
        assert all(s["id"] != sid for s in lst1.json())
        assert (await client.get(f"/api/intake/submissions/{sid}", headers=super_headers)).status_code == 404
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_admin_patch_corrects_children(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        cr = await client.post(f"/api/intake/submissions?t={raw}",
                               json={"mode": "form", "status": "inviata", "children": [_child()]})
        sid = cr.json()["id"]
        p = await client.patch(f"/api/intake/submissions/{sid}", headers=super2_headers, json={
            "children": [_child(nome="Alessia")], "status": "revisionata",
        })
        assert p.status_code == 200
        doc = await db.intake_submissions.find_one({"id": sid})
        assert doc["children"][0]["nome"] == "Alessia" and doc["status"] == "revisionata"
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intake.py -v -k "admin_list or admin_patch"`
Expected: FAIL con 404 (route inesistente)

- [ ] **Step 3: Write minimal implementation**

Aggiungi in fondo a `backend/routers/intake.py`:

```python
# ── Admin: lista / dettaglio / patch ─────────────────────────────────────────
@router.get("/submissions")
async def list_submissions(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    rows = await db.intake_submissions.find(
        {"org_id": org}, {"_id": 0}
    ).sort([("created_at", -1)]).to_list(500)
    return rows


@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    doc = await db.intake_submissions.find_one({"id": submission_id, "org_id": org}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Submission non trovata")
    return doc


@router.patch("/submissions/{submission_id}")
async def patch_submission(submission_id: str, payload: IntakeSubmissionPatch,
                           current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    updates = {}
    if payload.children is not None:
        updates["children"] = [c.model_dump(exclude_none=True) for c in payload.children]
    if payload.status is not None:
        updates["status"] = payload.status
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    updates["updated_at"] = _now_iso()
    res = await db.intake_submissions.update_one(
        {"id": submission_id, "org_id": org}, {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission non trovata")
    return await db.intake_submissions.find_one({"id": submission_id}, {"_id": 0})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intake.py -v -k "admin_list or admin_patch"`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add backend/routers/intake.py tests/test_intake.py
git commit -m "feat(intake): admin lista/dettaglio/patch submission con isolamento org"
```

---

### Task 7: Export → formato importer `iscrizioni_normalized.json`

**Files:**
- Modify: `backend/routers/intake.py`
- Test: `tests/test_intake.py`

Il formato-bersaglio (vedi `scripts/import/import_iscrizioni.py`):
`{ org_id, classes_to_create:[{sede_id,name}], students:[{sede_id,class_name,name,cognome,date_of_birth,email_genitore}], parents:[{email,name}] }`.

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/test_intake.py`:

```python
@pytest.mark.asyncio
async def test_export_maps_to_importer_format(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        # due bambini con la STESSA email genitore (fratelli) → un solo parent
        children = [
            _child(nome="Alice", cognome="Grasso", genitore_email="fam@example.com",
                   genitore_nome="Simona", genitore_cognome="Ferracane", classe="Sez A"),
            _child(nome="Marco", cognome="Grasso", data_nascita="2023-02-01",
                   genitore_email="fam@example.com", genitore_nome="Simona",
                   genitore_cognome="Ferracane", classe="Sez A"),
        ]
        cr = await client.post(f"/api/intake/submissions?t={raw}",
                               json={"mode": "form", "status": "inviata", "children": children})
        sid = cr.json()["id"]
        ex = await client.post(f"/api/intake/submissions/{sid}/export", headers=super2_headers)
        assert ex.status_code == 200
        data = ex.json()
        assert data["org_id"] == "dimensione-bimbo"
        # una sola classe (sede_id, name) distinta
        assert data["classes_to_create"] == [{"sede_id": "db-sede-1", "name": "Sez A"}]
        # due studenti col formato importer
        assert len(data["students"]) == 2
        assert data["students"][0]["class_name"] == "Sez A"
        assert data["students"][0]["date_of_birth"] == "2021-05-30"
        assert data["students"][0]["email_genitore"] == "fam@example.com"
        # un solo parent (dedup per email), name = "Nome Cognome"
        assert data["parents"] == [{"email": "fam@example.com", "name": "Simona Ferracane"}]
        # la submission passa a stato "revisionata"
        doc = await db.intake_submissions.find_one({"id": sid})
        assert doc["status"] == "revisionata"
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_intake.py -v -k "export_maps"`
Expected: FAIL con 404 (route inesistente)

- [ ] **Step 3: Write minimal implementation**

Aggiungi in fondo a `backend/routers/intake.py`:

```python
# ── Export → formato importer iscrizioni_normalized.json ─────────────────────
@router.post("/submissions/{submission_id}/export")
async def export_submission(submission_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    org = _caller_org(current_user)
    db = get_db()
    sub = await db.intake_submissions.find_one({"id": submission_id, "org_id": org}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission non trovata")

    children = sub.get("children", [])
    # classi distinte per (sede_id, classe), preservando l'ordine di prima comparsa
    classes, seen_cls = [], set()
    students = []
    parents, seen_email = [], set()
    for c in children:
        key = (c["sede_id"], c["classe"])
        if key not in seen_cls:
            seen_cls.add(key)
            classes.append({"sede_id": c["sede_id"], "name": c["classe"]})
        students.append({
            "sede_id": c["sede_id"],
            "class_name": c["classe"],
            "name": c["nome"],
            "cognome": c["cognome"],
            "date_of_birth": c.get("data_nascita", ""),
            "email_genitore": c.get("genitore_email", ""),
        })
        em = c.get("genitore_email")
        if em and em not in seen_email:
            seen_email.add(em)
            full = f"{c.get('genitore_nome','')} {c.get('genitore_cognome','')}".strip()
            parents.append({"email": em, "name": full or f"Famiglia {c['cognome']}"})

    await db.intake_submissions.update_one(
        {"id": submission_id}, {"$set": {"status": "revisionata", "updated_at": _now_iso()}}
    )
    return {"org_id": org, "classes_to_create": classes,
            "students": students, "parents": parents}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_intake.py -v -k "export_maps"`
Expected: PASS

- [ ] **Step 5: Run the FULL intake suite + commit**

Run: `python -m pytest tests/test_intake.py -v`
Expected: PASS (tutti i test intake)

```bash
git add backend/routers/intake.py tests/test_intake.py
git commit -m "feat(intake): export submission -> formato importer (dedup genitori/classi)"
```

- [ ] **Step 6: Regressione globale**

Run: `python -m pytest tests -q`
Expected: nessun test preesistente rotto (verde). Se rosso, correggere prima di procedere.

---

# PARTE B — FRONTEND (CRA + react-router-dom)

**Nota metodo:** il progetto frontend non ha una suite di test attiva; la verifica è **manuale** (avvio dev server + controllo nel browser). Il branding è build-time (`REACT_APP_TENANT`). Backend URL: `REACT_APP_BACKEND_URL`.
Avvio dev: da `frontend/` → `npm run dev` (craco start, porta 3000).

---

### Task 8: Client API intake

**Files:**
- Create: `frontend/src/lib/intakeApi.js`

- [ ] **Step 1: Implementazione**

Crea `frontend/src/lib/intakeApi.js`:

```javascript
// Client per gli endpoint Raccolta Iscrizioni (/api/intake).
// Gli endpoint pubblici usano il token in query (?t=); quelli admin l'axios `api` (JWT).
import axios from 'axios';
import api from './api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const BASE = `${BACKEND_URL}/api/intake`;

// ── Pubblici (token) ─────────────────────────────────────────────
export async function getConfig(token) {
  const { data } = await axios.get(`${BASE}/config`, { params: { t: token } });
  return data;
}

export async function upsertSubmission(token, payload) {
  const { data } = await axios.post(`${BASE}/submissions`, payload, { params: { t: token } });
  return data;
}

export async function uploadScan(token, submissionId, file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await axios.post(`${BASE}/submissions/${submissionId}/scans`, form, {
    params: { t: token },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ── Admin (JWT via api client) ───────────────────────────────────
export async function createToken(label, expiresAt = null) {
  const { data } = await api.post('/intake/tokens', { label, expires_at: expiresAt });
  return data; // { id, org_id, label, token }  ← token in chiaro UNA volta
}
export async function listTokens() {
  return (await api.get('/intake/tokens')).data;
}
export async function revokeToken(id) {
  return (await api.delete(`/intake/tokens/${id}`)).data;
}
export async function listSubmissions() {
  return (await api.get('/intake/submissions')).data;
}
export async function getSubmission(id) {
  return (await api.get(`/intake/submissions/${id}`)).data;
}
export async function patchSubmission(id, payload) {
  return (await api.patch(`/intake/submissions/${id}`, payload)).data;
}
export async function exportSubmission(id) {
  return (await api.post(`/intake/submissions/${id}/export`)).data;
}
```

- [ ] **Step 2: Verifica sintassi**

Run (da `frontend/`): `node -e "require('@babel/core')" 2>/dev/null; npx eslint src/lib/intakeApi.js --no-eslintrc --parser-options=ecmaVersion:2021,sourceType:module || true`
Expected: nessun errore di sintassi bloccante.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/intakeApi.js
git commit -m "feat(intake-web): client API endpoint iscrizioni"
```

---

### Task 9: Landing pubblica + route + selezione modalità

**Files:**
- Create: `frontend/src/pages/iscrizioni/IscrizioniPage.jsx`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Crea la pagina landing**

Crea `frontend/src/pages/iscrizioni/IscrizioniPage.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { tenant, C } from '@/config/tenant';
import { getConfig } from '@/lib/intakeApi';
import SchedaStrutturata from './SchedaStrutturata';
import UploadRegistro from './UploadRegistro';

export default function IscrizioniPage() {
  const [params] = useSearchParams();
  const token = params.get('t');
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // 'form' | 'scan' | null

  useEffect(() => {
    if (!token) { setError('Link non valido: manca il codice di accesso.'); return; }
    getConfig(token)
      .then(setConfig)
      .catch(() => setError('Link non valido, scaduto o revocato. Contatta la scuola/Omnia.'));
  }, [token]);

  if (error) {
    return <CenteredCard><p data-testid="intake-error">{error}</p></CenteredCard>;
  }
  if (!config) {
    return <CenteredCard><p>Caricamento…</p></CenteredCard>;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={tenant.logo} alt={tenant.appName} style={{ height: 48, borderRadius: 12 }} />
        <div>
          <h1 style={{ color: C.primary, margin: 0 }}>{tenant.appName}</h1>
          <p style={{ margin: 0 }}>Raccolta iscrizioni {config.org_id ? '' : ''}</p>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
        <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <p><strong>Informativa:</strong> i dati inseriti (bambini e genitori) sono trattati
            dalla scuola per la gestione delle iscrizioni, in conformità al GDPR. Non inserire
            dati non richiesti.</p>
        </section>

        {!mode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ModeCard testid="mode-form" title="Compila la scheda"
              desc="Inserisci i bambini in un modulo guidato e validato."
              onClick={() => setMode('form')} color={C.primary} />
            <ModeCard testid="mode-scan" title="Carica il registro"
              desc="Hai già un registro? Carica scansioni pulite e leggibili."
              onClick={() => setMode('scan')} color={C.accentPink} />
          </div>
        )}

        {mode === 'form' && <SchedaStrutturata token={token} config={config} onBack={() => setMode(null)} />}
        {mode === 'scan' && <UploadRegistro token={token} config={config} onBack={() => setMode(null)} />}
      </main>

      <footer style={{ textAlign: 'center', padding: 20, fontSize: 12, color: '#666' }}>
        {tenant.footer}
      </footer>
    </div>
  );
}

function CenteredCard({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.bg }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 16 }}>{children}</div>
    </div>
  );
}

function ModeCard({ title, desc, onClick, color, testid }) {
  return (
    <button data-testid={testid} onClick={onClick}
      style={{ background: '#fff', border: `2px solid ${color}`, borderRadius: 16,
               padding: 24, textAlign: 'left', cursor: 'pointer' }}>
      <h3 style={{ color, marginTop: 0 }}>{title}</h3>
      <p style={{ margin: 0 }}>{desc}</p>
    </button>
  );
}
```

- [ ] **Step 2: Aggiungi la route pubblica in `App.js`**

In `frontend/src/App.js`, accanto agli altri `lazy(...)` (es. dopo `PrivacyPolicy`):

```javascript
const IscrizioniPage = lazy(() => import("@/pages/iscrizioni/IscrizioniPage"));
```

e dentro `<Routes>`, come route PUBBLICA (senza `ProtectedRoute`, accanto a `/login` e `/privacy`):

```jsx
<Route path="/iscrizioni" element={<IscrizioniPage />} />
```

- [ ] **Step 3: Verifica manuale**

Run (da `frontend/`): `npm run dev`
Apri `http://localhost:3000/iscrizioni` → deve mostrare l'errore "Link non valido" (manca `?t=`).
Genera un token reale (Task 12 admin) oppure via API e apri `http://localhost:3000/iscrizioni?t=<token>` → devono comparire le due card modalità, brandizzate.
Expected: header col logo/colore del tenant, footer GDPR, due card.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/iscrizioni/IscrizioniPage.jsx frontend/src/App.js
git commit -m "feat(intake-web): landing pubblica /iscrizioni brandizzata + selezione modalità"
```

---

### Task 10: Modalità A — scheda strutturata

**Files:**
- Create: `frontend/src/pages/iscrizioni/SchedaStrutturata.jsx`

- [ ] **Step 1: Implementazione**

Crea `frontend/src/pages/iscrizioni/SchedaStrutturata.jsx`:

```jsx
import React, { useMemo, useState } from 'react';
import { C } from '@/config/tenant';
import { upsertSubmission } from '@/lib/intakeApi';

const EMPTY = {
  nome: '', cognome: '', data_nascita: '', sede_id: '', classe: '',
  genitore_nome: '', genitore_cognome: '', genitore_email: '',
};

export default function SchedaStrutturata({ token, config, onBack }) {
  const [rows, setRows] = useState([{ ...EMPTY }]);
  const [submissionId, setSubmissionId] = useState(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const setCell = (i, k, v) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows(rs => [...rs, { ...EMPTY }]);
  const delRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i));

  const sezioniPerSede = config.sezioni_by_sede || {};

  const errors = useMemo(() => rows.map(validateRow), [rows]);
  const hasErrors = errors.some(e => Object.keys(e).length > 0);

  async function save(status) {
    setSaving(true); setMsg('');
    try {
      const res = await upsertSubmission(token, {
        mode: 'form', status, submission_id: submissionId, children: rows,
      });
      setSubmissionId(res.id);
      setMsg(status === 'inviata' ? 'Iscrizioni inviate! Grazie.' : 'Bozza salvata.');
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Errore nel salvataggio.');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <button data-testid="back" onClick={onBack}>← Indietro</button>
      <h2 style={{ color: C.primary }}>Scheda iscrizioni</h2>
      <table data-testid="scheda-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Nome','Cognome','Data nascita','Sede','Sezione','Genitore nome','Genitore cognome','Email genitore',''].map(h =>
              <th key={h} style={{ textAlign: 'left', fontSize: 12 }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input data-testid={`nome-${i}`} value={r.nome} onChange={e => setCell(i,'nome',e.target.value)} /></td>
              <td><input value={r.cognome} onChange={e => setCell(i,'cognome',e.target.value)} /></td>
              <td><input type="date" value={r.data_nascita} onChange={e => setCell(i,'data_nascita',e.target.value)} /></td>
              <td>
                <select value={r.sede_id} onChange={e => setCell(i,'sede_id',e.target.value)}>
                  <option value="">—</option>
                  {config.sedi.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </td>
              <td>
                <input list={`sez-${r.sede_id}`} value={r.classe}
                       onChange={e => setCell(i,'classe',e.target.value)} placeholder="Sezione" />
                <datalist id={`sez-${r.sede_id}`}>
                  {(sezioniPerSede[r.sede_id] || []).map(n => <option key={n} value={n} />)}
                </datalist>
              </td>
              <td><input value={r.genitore_nome} onChange={e => setCell(i,'genitore_nome',e.target.value)} /></td>
              <td><input value={r.genitore_cognome} onChange={e => setCell(i,'genitore_cognome',e.target.value)} /></td>
              <td><input type="email" value={r.genitore_email} onChange={e => setCell(i,'genitore_email',e.target.value)} /></td>
              <td><button onClick={() => delRow(i)} disabled={rows.length === 1}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasErrors && <p style={{ color: 'crimson' }} data-testid="validation-hint">
        Controlla i campi evidenziati (nome/cognome, data valida, sede, sezione, email).</p>}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button data-testid="add-row" onClick={addRow}>+ Aggiungi bambino</button>
        <button data-testid="save-draft" onClick={() => save('bozza')} disabled={saving}>Salva bozza</button>
        <button data-testid="submit" onClick={() => save('inviata')} disabled={saving || hasErrors}
          style={{ background: C.primary, color: '#fff' }}>Invia iscrizioni</button>
      </div>
      {msg && <p data-testid="scheda-msg">{msg}</p>}
    </div>
  );
}

function validateRow(r) {
  const e = {};
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.genitore_email);
  for (const k of ['nome','cognome','sede_id','classe','genitore_nome','genitore_cognome']) {
    if (!String(r[k] || '').trim()) e[k] = true;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data_nascita)) e.data_nascita = true;
  if (!emailOk) e.genitore_email = true;
  return e;
}
```

- [ ] **Step 2: Verifica manuale**

Con dev server attivo e `?t=<token>` valido: scegli "Compila la scheda", aggiungi righe, prova a inviare con campi vuoti (bottone Invia disabilitato + hint), poi compila correttamente e invia.
Expected: "Iscrizioni inviate! Grazie." e submission visibile in dashboard admin (Task 12).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/iscrizioni/SchedaStrutturata.jsx
git commit -m "feat(intake-web): modalità A scheda strutturata con validazione e bozza"
```

---

### Task 11: Modalità B — upload registro

**Files:**
- Create: `frontend/src/pages/iscrizioni/UploadRegistro.jsx`

- [ ] **Step 1: Implementazione**

Crea `frontend/src/pages/iscrizioni/UploadRegistro.jsx`:

```jsx
import React, { useState } from 'react';
import { C } from '@/config/tenant';
import { upsertSubmission, uploadScan } from '@/lib/intakeApi';

const OK_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export default function UploadRegistro({ token, onBack }) {
  const [submissionId, setSubmissionId] = useState(null);
  const [uploaded, setUploaded] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function ensureSubmission() {
    if (submissionId) return submissionId;
    const res = await upsertSubmission(token, { mode: 'scan', status: 'bozza', children: [] });
    setSubmissionId(res.id);
    return res.id;
  }

  async function onFiles(fileList) {
    setMsg(''); setBusy(true);
    try {
      const sid = await ensureSubmission();
      for (const f of Array.from(fileList)) {
        if (!OK_TYPES.includes(f.type)) { setMsg(`"${f.name}" ignorato: usa JPG, PNG o PDF.`); continue; }
        if (f.size > 15 * 1024 * 1024) { setMsg(`"${f.name}" troppo grande (max 15MB).`); continue; }
        const res = await uploadScan(token, sid, f);
        setUploaded(u => [...u, res.scan.filename]);
      }
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Errore nel caricamento.');
    } finally { setBusy(false); }
  }

  async function finish() {
    if (!submissionId) { setMsg('Carica almeno una scansione.'); return; }
    await upsertSubmission(token, { mode: 'scan', status: 'inviata', submission_id: submissionId, children: [] });
    setMsg('Registro inviato! Grazie.');
  }

  return (
    <div>
      <button data-testid="back" onClick={onBack}>← Indietro</button>
      <h2 style={{ color: C.primary }}>Carica il registro</h2>
      <p>Carica <strong>scansioni pulite e leggibili</strong> (JPG, PNG o PDF). Evita foto sfocate,
        storte o con ombre: se non sono leggibili non possiamo trascriverle correttamente.</p>
      <input data-testid="scan-input" type="file" multiple accept="image/*,application/pdf"
             onChange={e => onFiles(e.target.files)} disabled={busy} />
      <ul data-testid="scan-list">
        {uploaded.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
      <button data-testid="finish-scan" onClick={finish} disabled={busy || !submissionId}
        style={{ background: C.primary, color: '#fff' }}>Ho caricato tutto — Invia</button>
      {msg && <p data-testid="scan-msg">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verifica manuale**

Scegli "Carica il registro", carica un JPG/PDF pulito → compare nell'elenco; prova un `.exe` → messaggio di rifiuto. Poi "Invia".
Expected: submission `scan` con scans visibile in dashboard admin.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/iscrizioni/UploadRegistro.jsx
git commit -m "feat(intake-web): modalità B upload registro scansionato con controlli tipo/dimensione"
```

---

### Task 12: Dashboard admin (token + lista + dettaglio + export)

**Files:**
- Create: `frontend/src/pages/admin/AdminIscrizioni.jsx`
- Modify: `frontend/src/App.js` (route admin) + menu admin (link)

- [ ] **Step 1: Implementazione pagina admin**

Crea `frontend/src/pages/admin/AdminIscrizioni.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { C } from '@/config/tenant';
import {
  createToken, listTokens, revokeToken,
  listSubmissions, getSubmission, patchSubmission, exportSubmission,
} from '@/lib/intakeApi';

export default function AdminIscrizioni() {
  const [tokens, setTokens] = useState([]);
  const [subs, setSubs] = useState([]);
  const [sel, setSel] = useState(null);
  const [newToken, setNewToken] = useState(null); // token in chiaro appena creato
  const [msg, setMsg] = useState('');

  const reload = async () => {
    setTokens(await listTokens());
    setSubs(await listSubmissions());
  };
  useEffect(() => { reload().catch(() => setMsg('Errore nel caricamento.')); }, []);

  async function genToken() {
    const label = window.prompt('Etichetta del link (es. "Segreteria 2026/27")');
    if (!label) return;
    const t = await createToken(label);
    setNewToken(t);
    await reload();
  }

  function linkFor(rawToken) {
    return `${window.location.origin}/iscrizioni?t=${rawToken}`;
  }

  async function openDetail(id) { setSel(await getSubmission(id)); }

  async function doExport(id) {
    const data = await exportSubmission(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'iscrizioni_normalized.json';
    a.click();
    await reload();
    setMsg('File generato: iscrizioni_normalized.json (consegnalo a Omnia per l\'import).');
  }

  return (
    <div style={{ padding: 20 }} data-testid="admin-iscrizioni">
      <h1 style={{ color: C.primary }}>Raccolta Iscrizioni</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>Link per le scuole</h2>
        <button data-testid="gen-token" onClick={genToken}>+ Genera link segreteria</button>
        {newToken && (
          <div data-testid="new-token" style={{ background: '#fffae6', padding: 12, borderRadius: 8, marginTop: 8 }}>
            <strong>Copia e invia ora questo link (mostrato una sola volta):</strong>
            <input readOnly value={linkFor(newToken.token)} style={{ width: '100%' }}
                   onFocus={e => e.target.select()} />
          </div>
        )}
        <ul>
          {tokens.map(t => (
            <li key={t.id}>
              {t.label} — {t.active ? 'attivo' : 'revocato'}
              {t.active && <button onClick={async () => { await revokeToken(t.id); reload(); }}>Revoca</button>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Iscrizioni ricevute</h2>
        <table style={{ width: '100%' }}>
          <thead><tr><th>Data</th><th>Modalità</th><th>Stato</th><th>Bambini</th><th></th></tr></thead>
          <tbody>
            {subs.map(s => (
              <tr key={s.id} data-testid={`sub-${s.id}`}>
                <td>{(s.created_at || '').slice(0, 10)}</td>
                <td>{s.mode}</td>
                <td>{s.status}</td>
                <td>{(s.children || []).length}</td>
                <td>
                  <button onClick={() => openDetail(s.id)}>Apri</button>
                  <button onClick={() => doExport(s.id)}>Genera file import</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {sel && <SubmissionDetail sub={sel} onClose={() => setSel(null)}
        onSaved={async () => { await reload(); setSel(null); }} />}
      {msg && <p data-testid="admin-msg">{msg}</p>}
    </div>
  );
}

function SubmissionDetail({ sub, onClose, onSaved }) {
  const [children, setChildren] = useState(sub.children || []);
  const setCell = (i, k, v) => setChildren(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  async function save() {
    await patchSubmission(sub.id, { children, status: 'revisionata' });
    onSaved();
  }
  return (
    <div style={{ border: '1px solid #ccc', padding: 16, marginTop: 16 }} data-testid="sub-detail">
      <button onClick={onClose}>Chiudi</button>
      <h3>Dettaglio ({sub.mode})</h3>
      {sub.mode === 'scan' && (
        <ul>{(sub.scans || []).map(sc => <li key={sc.file_id}>{sc.filename} ({Math.round(sc.size/1024)} KB)</li>)}</ul>
      )}
      {children.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          <input value={c.nome || ''} onChange={e => setCell(i,'nome',e.target.value)} />
          <input value={c.cognome || ''} onChange={e => setCell(i,'cognome',e.target.value)} />
          <input value={c.data_nascita || ''} onChange={e => setCell(i,'data_nascita',e.target.value)} />
          <input value={c.classe || ''} onChange={e => setCell(i,'classe',e.target.value)} />
          <input value={c.genitore_email || ''} onChange={e => setCell(i,'genitore_email',e.target.value)} />
        </div>
      ))}
      <button data-testid="save-detail" onClick={save}>Salva correzioni</button>
    </div>
  );
}
```

- [ ] **Step 2: Route admin + link nel menu**

In `frontend/src/App.js`, aggiungi il lazy import (accanto agli altri Admin*):

```javascript
const AdminIscrizioni = lazy(() => import("@/pages/admin/AdminIscrizioni"));
```

e la route protetta (accanto a `/admin/users`):

```jsx
<Route path="/admin/iscrizioni" element={<ProtectedRoute allowedRoles={['admin']}><AdminIscrizioni /></ProtectedRoute>} />
```

Individua il file del menu/sidebar admin (cerca dove sono elencate le voci `/admin/users`, `/admin/classes`):

Run (da repo root): `grep -rn "/admin/users" frontend/src/components frontend/src/pages/admin | grep -iv "route"`

Nel file trovato, aggiungi una voce di menu "Iscrizioni" che punta a `/admin/iscrizioni`, con `data-testid="nav-iscrizioni"`, seguendo ESATTAMENTE il pattern delle voci vicine (stesse icone/classi). (Il codice esatto dipende dal componente: replica la voce `Utenti`/`/admin/users` cambiando label e path.)

- [ ] **Step 3: Verifica manuale end-to-end**

1. Login come admin dell'org (es. Dimensione Bimbo).
2. Vai su `/admin/iscrizioni` → "Genera link segreteria" → copia il link mostrato.
3. Apri il link in incognito → compila la scheda (Task 10) → Invia.
4. Torna in dashboard → la submission compare → "Apri" per correggere → "Genera file import" scarica `iscrizioni_normalized.json`.
5. Verifica che il JSON scaricato abbia `org_id`, `classes_to_create`, `students`, `parents` coerenti.

Expected: ciclo completo funzionante; il JSON è pronto per `scripts/import/import_iscrizioni.py` (dry-run).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/AdminIscrizioni.jsx frontend/src/App.js frontend/src/components
git commit -m "feat(intake-web): dashboard admin iscrizioni (token, lista, revisione, export)"
```

---

### Task 13: Verifica integrazione JSON ↔ importer

**Files:** (nessuna modifica; verifica di coerenza)

- [ ] **Step 1: Confronto formato**

Apri `scripts/import/import_iscrizioni.py` e `scripts/import/iscrizioni_normalized.json`. Confronta le chiavi con l'output di `exportSubmission`:
- `org_id`, `classes_to_create[].{sede_id,name}`, `students[].{sede_id,class_name,name,cognome,date_of_birth,email_genitore}`, `parents[].{email,name}`.

Expected: match esatto (già coperto dal test `test_export_maps_to_importer_format`). Annota eventuali chiavi extra ignorate dall'importer (innocue).

- [ ] **Step 2: Dry-run locale opzionale**

Se disponibile un DB di test con le sedi dell'org, salva il JSON esportato come input e lancia l'importer in dry-run per confermare i conteggi. (In produzione resta il protocollo backup → dry-run → apply, invariato.)

- [ ] **Step 3: Commit (se sono servite piccole correzioni di mapping)**

```bash
git add -A && git commit -m "chore(intake): allinea export al formato importer (verifica)"
```

---

### Task 14: Build per-tenant e deploy

- [ ] **Step 1: Build Girogirotondo (default) — verifica non-regressione**

Run (da `frontend/`): `npm run build`
Expected: build OK; `/iscrizioni` presente; nessun cambiamento alle pagine esistenti.

- [ ] **Step 2: Build Dimensione Bimbo (brandizzata)**

Run (da `frontend/`): `npm run build:dimensione-bimbo`
Expected: build OK con branding arancione DB.

- [ ] **Step 3: Deploy**

Backend (Railway): deploy del commit corrente (nuovo router `/api/intake`). Verifica `GET /api/intake/config?t=bad` → 401 in produzione.
Frontend: deploy Vercel del/i progetto/i (uno per tenant). Verifica il ciclo end-to-end in produzione con un token di prova, poi revoca il token di prova.

- [ ] **Step 4: Commit/tag finale**

```bash
git add -A && git commit -m "chore(intake): rilascio Raccolta Iscrizioni (backend + web)"
```

---

## Note di rollout / sicurezza
- Il token è mostrato **una sola volta**; se perso, revoca e rigenera.
- Le scansioni sono dati di minori: verificare che il bucket Firebase non esponga URL pubblici; servire alle admin tramite `get_signed_url` (evoluzione se serve un viewer in-app).
- Isolamento org verificato dai test (`super` org1 non vede submission org2).
- L'import nel DB reale **non è automatico**: resta il protocollo manuale backup → dry-run → apply.

---

# REVISIONE — Scheda a 3 sezioni (maestre / famiglie / direttrice)

> Aggiunta dopo il Task 1 (spec aggiornato 2026-09-14): la scheda raccoglie l'intera scuola.
> Maestre → account `teacher` con `class_ids`; Famiglie → `student`+`parent` (già coperto);
> Direttrice → account `admin` `is_superadmin=True` dell'org. Export/import estesi.
> Queste modifiche **sostituiscono/estendono** i task indicati. Field naming italiano coerente
> con `backend/models/intake.py` già creato.

### Task 1B: Estendi i modelli con Staff e Direttrice

**Files:** Modify `backend/models/intake.py`; Modify `tests/test_intake.py`

- [ ] **Step 1: Test (append a `tests/test_intake.py`)**

```python
def test_staff_and_direttrice_models():
    from models.intake import IntakeStaff, IntakeDirettrice, IntakeSubmissionUpsert
    s = IntakeStaff(nome="Valeria", cognome="Rossi", email="v@ex.it",
                    sede_id="db-sede-1", sezioni=["Sez A", "Sez B"])
    assert s.sezioni == ["Sez A", "Sez B"]
    d = IntakeDirettrice(nome="Cetty", cognome="Bianchi", email="c@ex.it")
    assert d.email == "c@ex.it"
    sub = IntakeSubmissionUpsert(mode="form", status="bozza", children=[],
                                 staff=[s], direttrici=[d])
    assert sub.staff[0].nome == "Valeria" and sub.direttrici[0].nome == "Cetty"


def test_staff_rejects_bad_email():
    from models.intake import IntakeStaff
    with pytest.raises(Exception):
        IntakeStaff(nome="X", cognome="Y", email="nope", sede_id="db-sede-1", sezioni=[])
```

- [ ] **Step 2: Run → fail** (`ImportError`): `PYTHONPATH=backend python -m pytest tests/test_intake.py -v -k "staff or direttrice"`

- [ ] **Step 3: Implementazione — aggiungi a `backend/models/intake.py`**

Nuovi modelli (dopo `IntakeChild`):

```python
class IntakeStaff(BaseModel):
    """Maestra: crea account teacher legato alle sezioni assegnate."""
    nome: str
    cognome: str
    email: EmailStr
    sede_id: str
    sezioni: List[str] = []            # nomi classi/sezioni assegnate

    @field_validator("nome", "cognome", "sede_id")
    @classmethod
    def _non_empty(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Campo obbligatorio")
        return str(v).strip()


class IntakeDirettrice(BaseModel):
    """Direttrice: crea account admin is_superadmin dell'org."""
    nome: str
    cognome: str
    email: EmailStr

    @field_validator("nome", "cognome")
    @classmethod
    def _non_empty(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Campo obbligatorio")
        return str(v).strip()
```

Estendi `IntakeSubmissionUpsert` aggiungendo due campi (dopo `children`):

```python
    staff: List[IntakeStaff] = []
    direttrici: List[IntakeDirettrice] = []
```

Estendi `IntakeSubmissionPatch` aggiungendo (dopo `children`):

```python
    staff: Optional[List[IntakeStaff]] = None
    direttrici: Optional[List[IntakeDirettrice]] = None
```

- [ ] **Step 4: Run → pass**: `PYTHONPATH=backend python -m pytest tests/test_intake.py -v`
- [ ] **Step 5: Commit**: `git add backend/models/intake.py tests/test_intake.py && git commit -m "feat(intake): modelli Staff e Direttrice + submission a 3 sezioni"`

---

### Task 4 (REV): submission accetta staff + direttrici

Nell'handler `upsert_submission` di `backend/routers/intake.py` (Task 4), sostituisci il corpo così da
validare le sedi ANCHE per lo staff e persistere staff/direttrici.

- [ ] **Step 1: Test (append)** — verifica che staff/direttrici siano salvati e che una sede staff fuori org sia rifiutata:

```python
@pytest.mark.asyncio
async def test_submission_stores_three_sections(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        payload = {
            "mode": "form", "status": "inviata",
            "children": [_child()],
            "staff": [{"nome": "Valeria", "cognome": "Rossi", "email": "v@ex.it",
                       "sede_id": "db-sede-1", "sezioni": ["Infanzia — Valeria"]}],
            "direttrici": [{"nome": "Cetty", "cognome": "B", "email": "cetty@ex.it"}],
        }
        r = await client.post(f"/api/intake/submissions?t={raw}", json=payload)
        assert r.status_code == 201
        doc = await db.intake_submissions.find_one({"id": r.json()["id"]})
        assert len(doc["staff"]) == 1 and len(doc["direttrici"]) == 1
        assert doc["staff"][0]["sezioni"] == ["Infanzia — Valeria"]
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_submission_rejects_staff_bad_sede(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        r = await client.post(f"/api/intake/submissions?t={raw}", json={
            "mode": "form", "status": "bozza", "children": [],
            "staff": [{"nome": "X", "cognome": "Y", "email": "x@ex.it",
                       "sede_id": "girogirotondo", "sezioni": []}],  # sede di ALTRA org
        })
        assert r.status_code == 400
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})
```

- [ ] **Step 2: Implementazione** — nell'handler `upsert_submission`, dopo il ciclo di validazione sedi dei children, aggiungi:

```python
    for s in payload.staff:
        if s.sede_id not in valid_sedi:
            raise HTTPException(status_code=400, detail=f"Sede '{s.sede_id}' non valida per questa scuola")
```

Nel documento nuovo e nell'update, aggiungi i campi:

```python
        "staff": [s.model_dump() for s in payload.staff],
        "direttrici": [d.model_dump() for d in payload.direttrici],
```

(nell'update `$set`, includi anche `"staff"` e `"direttrici"` con gli stessi valori.)

- [ ] **Step 3: Run → pass** (`-k "three_sections or staff_bad_sede"`) · **Commit**: `feat(intake): submission a 3 sezioni con validazione sede staff`

---

### Task 6 (REV): patch estende a staff + direttrici

Nell'handler `patch_submission`, dopo il blocco `children`, aggiungi:

```python
    if payload.staff is not None:
        updates["staff"] = [s.model_dump() for s in payload.staff]
    if payload.direttrici is not None:
        updates["direttrici"] = [d.model_dump() for d in payload.direttrici]
```

- [ ] Test rapido: un PATCH con `staff` aggiornato persiste; run + commit `feat(intake): patch revisione staff/direttrici`.

---

### Task 7 (REV): export esteso (staff + direttrici + sezioni staff nelle classi)

Sostituisci il corpo di `export_submission` con la versione estesa:

- [ ] **Step 1: Test (append)**

```python
@pytest.mark.asyncio
async def test_export_includes_staff_and_direttrici(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        payload = {
            "mode": "form", "status": "inviata",
            "children": [_child(classe="Sez A")],
            "staff": [{"nome": "Valeria", "cognome": "Rossi", "email": "v@ex.it",
                       "sede_id": "db-sede-1", "sezioni": ["Sez A", "Sez Solo-Maestra"]}],
            "direttrici": [{"nome": "Cetty", "cognome": "B", "email": "cetty@ex.it"}],
        }
        sid = (await client.post(f"/api/intake/submissions?t={raw}", json=payload)).json()["id"]
        data = (await client.post(f"/api/intake/submissions/{sid}/export", headers=super2_headers)).json()
        # sezione senza bambini ma citata dalla maestra è comunque creata
        names = {c["name"] for c in data["classes_to_create"]}
        assert {"Sez A", "Sez Solo-Maestra"} <= names
        assert data["staff"] == [{"email": "v@ex.it", "name": "Valeria", "cognome": "Rossi",
                                  "sede_id": "db-sede-1", "class_names": ["Sez A", "Sez Solo-Maestra"]}]
        assert data["direttrici"] == [{"email": "cetty@ex.it", "name": "Cetty", "cognome": "B"}]
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})
```

- [ ] **Step 2: Implementazione** — corpo esteso di `export_submission` (dopo aver caricato `sub`):

```python
    children = sub.get("children", [])
    staff_rows = sub.get("staff", [])
    dirs_rows = sub.get("direttrici", [])

    classes, seen_cls = [], set()
    def _add_class(sede_id, name):
        key = (sede_id, name)
        if name and key not in seen_cls:
            seen_cls.add(key)
            classes.append({"sede_id": sede_id, "name": name})

    students, parents, seen_email = [], [], set()
    for c in children:
        _add_class(c["sede_id"], c["classe"])
        students.append({
            "sede_id": c["sede_id"], "class_name": c["classe"],
            "name": c["nome"], "cognome": c["cognome"],
            "date_of_birth": c.get("data_nascita", ""),
            "email_genitore": c.get("genitore_email", ""),
        })
        em = c.get("genitore_email")
        if em and em not in seen_email:
            seen_email.add(em)
            full = f"{c.get('genitore_nome','')} {c.get('genitore_cognome','')}".strip()
            parents.append({"email": em, "name": full or f"Famiglia {c['cognome']}"})

    # sezioni citate dalle maestre → classi anche senza bambini
    staff = []
    for s in staff_rows:
        for sez in s.get("sezioni", []):
            _add_class(s["sede_id"], sez)
        staff.append({"email": s["email"], "name": s["nome"], "cognome": s["cognome"],
                      "sede_id": s["sede_id"], "class_names": list(s.get("sezioni", []))})

    direttrici = [{"email": d["email"], "name": d["nome"], "cognome": d["cognome"]}
                  for d in dirs_rows]

    await db.intake_submissions.update_one(
        {"id": submission_id}, {"$set": {"status": "revisionata", "updated_at": _now_iso()}}
    )
    return {"org_id": org, "classes_to_create": classes, "students": students,
            "parents": parents, "staff": staff, "direttrici": direttrici}
```

- [ ] **Step 3: Run → pass** · **Commit**: `feat(intake): export esteso con staff e direttrici`

---

### Task 7B (NEW): estendi `import_iscrizioni.py` (teacher + superadmin)

**Files:** Modify `scripts/import/import_iscrizioni.py`

Lo script è standalone (pymongo sync, gira su Railway; non sotto pytest). Estenderlo per creare
maestre e direttrici, **idempotente per email**, dopo la sezione genitori. `data.get("staff")` /
`data.get("direttrici")` assenti → nessuna scrittura (retro-compatibile).

- [ ] **Step 1: Implementazione** — dopo il blocco "--- 3. Genitori ---" e prima del CSV, aggiungi:

```python
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
```

Aggiorna anche la riga di riepilogo finale del dry-run per stampare `maestre_nuove`/`direttrici_nuove`.

- [ ] **Step 2: Verifica sintassi**: `python -m py_compile scripts/import/import_iscrizioni.py`
- [ ] **Step 3: Commit**: `git add scripts/import/import_iscrizioni.py && git commit -m "feat(import): crea anche maestre (teacher) e direttrici (superadmin), idempotente"`

**Nota:** non eseguibile localmente contro il DB reale; validare via code review + dry-run su Railway (mai apply senza conferma di Anto).

---

### Task 10 (REV): scheda frontend a 3 sezioni

`SchedaStrutturata.jsx` (Task 10) diventa un contenitore con tre sotto-tabelle. Riusa il pattern
righe/validazione già definito per le famiglie e aggiungi:

- **Maestre:** righe `{nome, cognome, email, sede_id, sezioni}` — `sezioni` come multi-select
  (checkbox/lista) popolata da `config.sezioni_by_sede[sede_id]` con possibilità di aggiungerne una nuova.
- **Direttrice:** righe `{nome, cognome, email}`.
- `data-testid`: `sezione-maestre`, `sezione-famiglie`, `sezione-direttrice`, con add/remove per riga.

Al salvataggio, `upsertSubmission` riceve `{mode:'form', status, submission_id, children, staff, direttrici}`.
Validazione: email valida per maestre/direttrice; nome/cognome non vuoti; per maestre `sede_id` scelto.
`Invia` disabilitato se una qualsiasi sezione compilata ha righe non valide. Sezioni vuote = ammesse.

- [ ] Implementa · verifica manuale (compila le 3 sezioni, invia) · commit `feat(intake-web): scheda a 3 sezioni (maestre/famiglie/direttrice)`.

---

### Task 12 (REV): dashboard admin — revisione 3 sezioni

In `AdminIscrizioni.jsx` → `SubmissionDetail`, mostra ed edita tre tabelle (maestre/famiglie/direttrice)
leggendo `sub.staff`, `sub.children`, `sub.direttrici`. Il `patchSubmission` invia i tre array corretti.
Evidenzia la sezione **Direttrice** con un avviso "crea account con privilegi di amministrazione".

- [ ] Implementa · verifica manuale end-to-end (revisiona 3 sezioni → export → il JSON contiene staff+direttrici) · commit `feat(intake-web): revisione admin a 3 sezioni`.
