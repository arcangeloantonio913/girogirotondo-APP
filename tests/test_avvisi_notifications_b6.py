"""FASE B/6 — notifications /send + avvisi (multi-sede + azione irreversibile).

Il pattern è il più pericoloso: target MULTI-SEDE (target_sedi è una lista) + push
IRREVERSIBILI. Coperti:
  /send   — scope per ramo (roles/class_id/user_ids), push MAI cross-sede, superadmin=tutte.
  avvisi  — POST all-or-nothing su target_sedi/target_class_ids, PUT senza expansion +
            ownership + sede_id immutabile, helper _avviso_visible_to fail-closed, read parent.
"""
import pytest
from unittest.mock import patch, MagicMock

from services.database import get_db

SEDE_GGT, SEDE_MM = "girogirotondo", "il-magico-mondo"
GGT_CLASS, MM_CLASS = "ggt-class-1", "mm-class-1"


# ── seed push_tokens (uno per sede) ────────────────────────────────────────────
async def _seed_tokens():
    await get_db().push_tokens.insert_many([
        {"id": "pt-ggt", "user_id": "parent-test-id", "token": "tok-ggt"},
        {"id": "pt-mm",  "user_id": "mm-parent-id",   "token": "tok-mm"},
    ])


async def _clean_tokens():
    await get_db().push_tokens.delete_many({"id": {"$in": ["pt-ggt", "pt-mm"]}})


# ===========================================================================
# notifications /send — push irreversibili, scope per ramo
# ===========================================================================

# ── (c) ramo roles=['parent'] da admin A -> solo token di A, mai di B ──
@pytest.mark.asyncio
async def test_send_roles_scoped_to_own_sede(client, admin_headers):
    await _seed_tokens()
    try:
        with patch("routers.notifications.send_multicast", MagicMock(return_value=1)) as mock_send:
            r = await client.post("/api/notifications/send",
                json={"title": "T", "body": "B", "roles": ["parent"]}, headers=admin_headers)
            assert r.status_code == 200
            mock_send.assert_called_once()
            sent_tokens = mock_send.call_args[0][0]
            assert "tok-ggt" in sent_tokens
            assert "tok-mm" not in sent_tokens        # sede B esclusa dalla query
    finally:
        await _clean_tokens()


# ── (d) ramo class_id di sede B da admin A -> 404, send_multicast NON chiamato ──
@pytest.mark.asyncio
async def test_send_class_id_cross_sede_404_no_push(client, admin_headers):
    await _seed_tokens()
    try:
        with patch("routers.notifications.send_multicast", MagicMock(return_value=1)) as mock_send:
            r = await client.post("/api/notifications/send",
                json={"title": "T", "body": "B", "class_id": MM_CLASS}, headers=admin_headers)
            assert r.status_code == 404
            mock_send.assert_not_called()             # nessuna push emessa
    finally:
        await _clean_tokens()


# ── (e) ramo user_ids con un id di sede B -> quel token SCARTATO, push solo ad A ──
@pytest.mark.asyncio
async def test_send_user_ids_filter_out_foreign(client, admin_headers):
    await _seed_tokens()
    try:
        with patch("routers.notifications.send_multicast", MagicMock(return_value=1)) as mock_send:
            r = await client.post("/api/notifications/send",
                json={"title": "T", "body": "B",
                      "user_ids": ["parent-test-id", "mm-parent-id"]}, headers=admin_headers)
            assert r.status_code == 200
            mock_send.assert_called_once()            # fire-once: broadcast lecito NON abortito
            sent_tokens = mock_send.call_args[0][0]
            assert "tok-ggt" in sent_tokens
            assert "tok-mm" not in sent_tokens        # id estraneo scartato
    finally:
        await _clean_tokens()


# ── (i-send POSITIVO) superadmin roles=['parent'] -> push a TUTTE le sedi ──
@pytest.mark.asyncio
async def test_send_superadmin_all_sedi(client, super_headers):
    await _seed_tokens()
    try:
        with patch("routers.notifications.send_multicast", MagicMock(return_value=2)) as mock_send:
            r = await client.post("/api/notifications/send",
                json={"title": "T", "body": "B", "roles": ["parent"]}, headers=super_headers)
            assert r.status_code == 200
            mock_send.assert_called_once()
            sent_tokens = mock_send.call_args[0][0]
            assert "tok-ggt" in sent_tokens and "tok-mm" in sent_tokens   # broadcast globale lecito
    finally:
        await _clean_tokens()


# ── (e-bis) zero destinatari leciti -> send_multicast NON chiamato ──
@pytest.mark.asyncio
async def test_send_user_ids_only_foreign_no_push(client, admin_headers):
    await _seed_tokens()
    try:
        with patch("routers.notifications.send_multicast", MagicMock(return_value=1)) as mock_send:
            r = await client.post("/api/notifications/send",
                json={"title": "T", "body": "B", "user_ids": ["mm-parent-id"]}, headers=admin_headers)
            assert r.status_code == 200
            assert r.json()["sent"] == 0
            mock_send.assert_not_called()
    finally:
        await _clean_tokens()


# ===========================================================================
# avvisi — POST all-or-nothing
# ===========================================================================

# ── (a) POST target_sedi=[A,B] da admin A -> 404, nessun avviso creato (entrambi gli ordini) ──
@pytest.mark.asyncio
async def test_post_avviso_cross_sede_target_404_both_orders(client, admin_headers):
    db = get_db()
    for target in ([SEDE_GGT, SEDE_MM], [SEDE_MM, SEDE_GGT]):
        titolo = "avv-cross-" + "-".join(target)
        r = await client.post("/api/avvisi",
            json={"titolo": titolo, "testo": "x", "target_sedi": target}, headers=admin_headers)
        assert r.status_code == 404, target
        assert await db.avvisi.find_one({"titolo": titolo}) is None, target


# ── (b) POST target_class_ids = classe di sede B da admin A -> 404, niente creato ──
@pytest.mark.asyncio
async def test_post_avviso_cross_sede_class_404(client, admin_headers):
    db = get_db()
    r = await client.post("/api/avvisi",
        json={"titolo": "avv-classB", "testo": "x", "target_class_ids": [MM_CLASS]}, headers=admin_headers)
    assert r.status_code == 404
    assert await db.avvisi.find_one({"titolo": "avv-classB"}) is None


# ── (i-post POSITIVO) superadmin target_sedi=[A,B] -> creato ──
@pytest.mark.asyncio
async def test_post_avviso_superadmin_multi_sede_created(client, super_headers):
    db = get_db()
    r = await client.post("/api/avvisi",
        json={"titolo": "super-broadcast", "testo": "x", "target_sedi": [SEDE_GGT, SEDE_MM]},
        headers=super_headers)
    assert r.status_code == 201
    try:
        assert set(r.json()["target_sedi"]) == {SEDE_GGT, SEDE_MM}
        assert await db.avvisi.find_one({"titolo": "super-broadcast"}) is not None
    finally:
        await db.avvisi.delete_many({"titolo": "super-broadcast"})


# ── (positivo) admin A sulla propria sede -> creato; sede_id derivato server-side ──
@pytest.mark.asyncio
async def test_post_avviso_admin_own_sede_created(client, admin_headers):
    db = get_db()
    r = await client.post("/api/avvisi",
        json={"titolo": "own-sede", "testo": "x", "target_sedi": [SEDE_GGT]}, headers=admin_headers)
    assert r.status_code == 201
    try:
        assert r.json()["sede_id"] == SEDE_GGT
        assert r.json()["target_sedi"] == [SEDE_GGT]
    finally:
        await db.avvisi.delete_many({"titolo": "own-sede"})


# ── (positivo) admin A senza target_sedi -> default = solo la propria sede ──
@pytest.mark.asyncio
async def test_post_avviso_admin_default_own_sede(client, admin_headers):
    db = get_db()
    r = await client.post("/api/avvisi",
        json={"titolo": "default-sede", "testo": "x"}, headers=admin_headers)
    assert r.status_code == 201
    try:
        assert r.json()["target_sedi"] == [SEDE_GGT]
    finally:
        await db.avvisi.delete_many({"titolo": "default-sede"})


# ===========================================================================
# avvisi — PUT (ownership + no expansion + sede_id immutabile)
# ===========================================================================

# ── (f) PUT che allarga target_sedi [A]->[A,B] (admin A) -> 404, target INVARIATO ──
@pytest.mark.asyncio
async def test_put_no_target_expansion(client, admin_headers):
    db = get_db()
    await db.avvisi.insert_one({
        "id": "avv-put-1", "titolo": "orig", "testo": "x",
        "sede_id": SEDE_GGT, "target_sedi": [SEDE_GGT],
        "author_id": "admin-test-id", "author_role": "admin"})
    try:
        r = await client.put("/api/avvisi/avv-put-1",
            json={"target_sedi": [SEDE_GGT, SEDE_MM]}, headers=admin_headers)
        assert r.status_code == 404
        doc = await db.avvisi.find_one({"id": "avv-put-1"})
        assert doc["target_sedi"] == [SEDE_GGT]        # INVARIATO
    finally:
        await db.avvisi.delete_one({"id": "avv-put-1"})


# ── (g) PUT su avviso di sede B (admin A) -> 404, avviso INVARIATO ──
@pytest.mark.asyncio
async def test_put_cross_sede_avviso_404_invariato(client, admin_headers):
    db = get_db()
    await db.avvisi.insert_one({
        "id": "avv-put-mm", "titolo": "origMM", "testo": "x",
        "sede_id": SEDE_MM, "target_sedi": [SEDE_MM],
        "author_id": "mm-admin", "author_role": "admin"})
    try:
        r = await client.put("/api/avvisi/avv-put-mm",
            json={"titolo": "HACKED"}, headers=admin_headers)
        assert r.status_code == 404
        doc = await db.avvisi.find_one({"id": "avv-put-mm"})
        assert doc["titolo"] == "origMM"               # INVARIATO
    finally:
        await db.avvisi.delete_one({"id": "avv-put-mm"})


# ── (positivo) PUT lecito nella propria sede -> aggiornato ──
@pytest.mark.asyncio
async def test_put_own_sede_ok(client, admin_headers):
    db = get_db()
    await db.avvisi.insert_one({
        "id": "avv-put-ok", "titolo": "prima", "testo": "x",
        "sede_id": SEDE_GGT, "target_sedi": [SEDE_GGT],
        "author_id": "admin-test-id", "author_role": "admin"})
    try:
        r = await client.put("/api/avvisi/avv-put-ok",
            json={"titolo": "dopo"}, headers=admin_headers)
        assert r.status_code == 200
        doc = await db.avvisi.find_one({"id": "avv-put-ok"})
        assert doc["titolo"] == "dopo"
    finally:
        await db.avvisi.delete_one({"id": "avv-put-ok"})


# ===========================================================================
# avvisi — helper fail-closed + read parent
# ===========================================================================

# ── helper: avviso SENZA attribuzione di sede -> invisibile ad alcuno (difesa in profondità) ──
def test_helper_failclosed_no_sede_attribution():
    from routers.avvisi import _avviso_visible_to
    a = {"target_roles": ["parent"]}   # né sede_id né target_sedi
    assert _avviso_visible_to(a, "parent", "p1", [], [], SEDE_GGT) is False


# ── (h) read parent A: vede A nel target/sede, non solo-B; legacy senza sede -> fail-closed ──
@pytest.mark.asyncio
async def test_parent_read_scoped_and_legacy_failclosed(client, parent_headers):
    db = get_db()
    await db.avvisi.insert_many([
        {"id": "avv-ggt", "titolo": "GGT", "testo": "x", "sede_id": SEDE_GGT,
         "target_sedi": [SEDE_GGT], "target_roles": ["parent"], "created_at": "2026-02-01"},
        {"id": "avv-mm", "titolo": "MM", "testo": "x", "sede_id": SEDE_MM,
         "target_sedi": [SEDE_MM], "target_roles": ["parent"], "created_at": "2026-02-01"},
        {"id": "avv-legacy", "titolo": "LEGACY", "testo": "x",
         "target_roles": ["parent"], "created_at": "2026-02-01"},   # nessuna sede
    ])
    try:
        r = await client.get("/api/avvisi", headers=parent_headers)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert "avv-ggt" in ids
        assert "avv-mm" not in ids
        assert "avv-legacy" not in ids                 # fail-closed
    finally:
        await db.avvisi.delete_many({"id": {"$in": ["avv-ggt", "avv-mm", "avv-legacy"]}})
