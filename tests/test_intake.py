"""Test del router Raccolta Iscrizioni (/api/intake)."""
import pytest
from unittest.mock import patch
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


@pytest.mark.asyncio
async def test_admin_patch_corrects_staff_and_direttrici(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        cr = await client.post(f"/api/intake/submissions?t={raw}", json={
            "mode": "form", "status": "inviata", "children": [_child()],
            "staff": [{"nome": "Valeria", "cognome": "Rossi", "email": "v@ex.it",
                       "sede_id": "db-sede-1", "sezioni": ["Sez A"]}],
            "direttrici": [{"nome": "Cetty", "cognome": "B", "email": "cetty@ex.it"}],
        })
        sid = cr.json()["id"]
        p = await client.patch(f"/api/intake/submissions/{sid}", headers=super2_headers, json={
            "staff": [{"nome": "Valeria", "cognome": "Rossi Corretto", "email": "v@ex.it",
                       "sede_id": "db-sede-1", "sezioni": ["Sez A", "Sez B"]}],
            "direttrici": [{"nome": "Cetty", "cognome": "Bianchi", "email": "cetty@ex.it"}],
        })
        assert p.status_code == 200
        doc = await db.intake_submissions.find_one({"id": sid})
        assert doc["staff"][0]["cognome"] == "Rossi Corretto"
        assert doc["staff"][0]["sezioni"] == ["Sez A", "Sez B"]
        assert doc["direttrici"][0]["cognome"] == "Bianchi"
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_patch_rejects_partial_child(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        cr = await client.post(f"/api/intake/submissions?t={raw}",
                               json={"mode": "form", "status": "inviata", "children": [_child()]})
        sid = cr.json()["id"]
        p = await client.patch(f"/api/intake/submissions/{sid}", headers=super2_headers, json={
            "children": [{"nome": "SoloNome"}],
        })
        assert p.status_code == 422
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_patch_rejects_child_bad_sede(client, super2_headers):
    db = get_db()
    try:
        raw, _ = await _make_token(client, super2_headers)
        cr = await client.post(f"/api/intake/submissions?t={raw}",
                               json={"mode": "form", "status": "inviata", "children": [_child()]})
        sid = cr.json()["id"]
        p = await client.patch(f"/api/intake/submissions/{sid}", headers=super2_headers, json={
            "children": [_child(sede_id="girogirotondo")],   # sede di ALTRA org
        })
        assert p.status_code == 400
    finally:
        await db.intake_submissions.delete_many({"org_id": "dimensione-bimbo"})
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


@pytest.mark.asyncio
async def test_token_expires_at_normalized(client, super2_headers):
    db = get_db()
    try:
        r = await client.post("/api/intake/tokens",
                              json={"label": "Con scadenza", "expires_at": "2030-01-01"},
                              headers=super2_headers)
        assert r.status_code == 201
        doc = await db.intake_tokens.find_one({"id": r.json()["id"]})
        assert "T" in doc["expires_at"] and "+00:00" in doc["expires_at"]
    finally:
        await db.intake_tokens.delete_many({"org_id": "dimensione-bimbo"})


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
