"""FASE B/5 — meals: universali sede-wide scopati per sede (fail-closed) + create-side assert_class.
meals è scopato per SEDE (non per classe). Universale = class_id vuoto/null, con sede_id presente."""
import pytest
from services.database import get_db

GGT_CLASS, MM_CLASS = "ggt-class-1", "mm-class-1"
D = "2026-05-15"


async def _seed():
    db = get_db()
    await db.meals.insert_many([
        {"id": "meal-ggt-class", "class_id": GGT_CLASS, "sede_id": "girogirotondo", "date": D, "primo": "GGT"},
        {"id": "meal-mm-class",  "class_id": MM_CLASS,  "sede_id": "il-magico-mondo", "date": D, "primo": "MM"},
        {"id": "meal-ggt-univ",  "class_id": "",        "sede_id": "girogirotondo", "date": D, "primo": "Univ GGT"},
        {"id": "meal-mm-univ",   "class_id": "",        "sede_id": "il-magico-mondo", "date": D, "primo": "Univ MM"},
        {"id": "meal-univ-nosede", "class_id": "",      "date": D, "primo": "Univ SENZA sede"},   # niente sede_id
    ])


async def _cleanup():
    await get_db().meals.delete_many({"id": {"$in": [
        "meal-ggt-class", "meal-mm-class", "meal-ggt-univ", "meal-mm-univ", "meal-univ-nosede"]}})


# ── (a) parent A: universali di A sì, universali di B no, universale senza sede no (fail-closed) ──
@pytest.mark.asyncio
async def test_parent_universals_own_sede_only_and_failclosed(client, parent_headers):
    await _seed()
    try:
        r = await client.get("/api/meals", headers=parent_headers)
        assert r.status_code == 200
        ids = {m["id"] for m in r.json()}
        assert "meal-ggt-univ" in ids            # universale della PROPRIA sede
        assert "meal-mm-univ" not in ids          # universale di sede B -> LEAK core chiuso
        assert "meal-univ-nosede" not in ids      # universale SENZA sede_id -> FAIL-CLOSED
        assert "meal-ggt-class" in ids            # menu del figlio
        assert "meal-mm-class" not in ids          # (b) class-specific di sede B
    finally:
        await _cleanup()


# ── (b) parent A che passa class_id di sede B -> solo universali della propria sede ──
@pytest.mark.asyncio
async def test_parent_class_id_of_other_sede_only_own_universals(client, parent_headers):
    await _seed()
    try:
        r = await client.get(f"/api/meals?class_id={MM_CLASS}", headers=parent_headers)
        assert r.status_code == 200
        ids = {m["id"] for m in r.json()}
        assert "meal-mm-class" not in ids and "meal-mm-univ" not in ids
        assert "meal-ggt-univ" in ids
    finally:
        await _cleanup()


# ── (c) create admin A con class_id di sede B -> 404, nessun menu creato ──
@pytest.mark.asyncio
async def test_create_admin_cross_sede_class_404(client, admin_headers):
    db = get_db()
    r = await client.post("/api/meals/menu",
        json={"class_id": MM_CLASS, "date": "2026-06-02", "primo": "X"}, headers=admin_headers)
    assert r.status_code == 404
    assert await db.meals.find_one({"class_id": MM_CLASS, "date": "2026-06-02"}) is None


# ── (d) teacher A: universali propri + classi proprie; niente di sede B ──
@pytest.mark.asyncio
async def test_teacher_own_universals_and_classes_isolated(client, teacher_headers):
    await _seed()
    try:
        r = await client.get("/api/meals", headers=teacher_headers)
        assert r.status_code == 200
        ids = {m["id"] for m in r.json()}
        assert "meal-ggt-class" in ids
        assert "meal-ggt-univ" in ids             # fix over-filter (prima la maestra non li vedeva)
        assert "meal-mm-class" not in ids
        assert "meal-mm-univ" not in ids
        assert "meal-univ-nosede" not in ids
    finally:
        await _cleanup()


# ── (e) create universale (class_id "") da admin A -> visibile ai genitori A, non a quelli di B ──
@pytest.mark.asyncio
async def test_create_universal_sede_wide_not_global(client, admin_headers, parent_headers, mm_parent_headers):
    db = get_db()
    r = await client.post("/api/meals/menu",
        json={"class_id": "", "date": "2026-06-03", "primo": "Univ"}, headers=admin_headers)
    assert r.status_code == 201
    mid = r.json()["id"]
    assert r.json()["sede_id"] == "girogirotondo"     # sede del creatore (mai globale per omissione)
    try:
        rg = await client.get("/api/meals?date=2026-06-03", headers=parent_headers)
        assert mid in {m["id"] for m in rg.json()}      # genitore GGT lo vede
        rm = await client.get("/api/meals?date=2026-06-03", headers=mm_parent_headers)
        assert mid not in {m["id"] for m in rm.json()}  # genitore MM NON lo vede
    finally:
        await db.meals.delete_many({"id": mid})


# ── (f) DELETE cross-sede -> 404, menu ancora presente ──
@pytest.mark.asyncio
async def test_delete_cross_sede_404_present(client, admin_headers):
    await _seed()
    try:
        r = await client.delete("/api/meals/menu/meal-mm-class", headers=admin_headers)
        assert r.status_code == 404
        assert await get_db().meals.find_one({"id": "meal-mm-class"}) is not None
    finally:
        await _cleanup()


# ── regressione: admin A vede i propri universali + classi, non quelli di B ──
@pytest.mark.asyncio
async def test_admin_own_sede_incl_universals(client, admin_headers):
    await _seed()
    try:
        r = await client.get("/api/meals", headers=admin_headers)
        assert r.status_code == 200
        ids = {m["id"] for m in r.json()}
        assert {"meal-ggt-univ", "meal-ggt-class"} <= ids
        assert "meal-mm-univ" not in ids and "meal-mm-class" not in ids
    finally:
        await _cleanup()
