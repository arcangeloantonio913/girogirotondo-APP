"""Maestra associata SOLO via classes.teacher_id (users.class_ids vuoto/disallineato).

Regressione: la direzione vedeva la maestra associata in "Classi" ma la maestra non
vedeva né classi né bambini, perché lo scope leggeva solo users.class_ids.
"""
import pytest

from services.database import get_db
from tests.conftest import _headers, SEDE_GGT, ORG1

T_ID = "teacher-drift-id"
C_ID = "ggt-class-drift"
S_ID = "ggt-student-drift"


@pytest.fixture
async def drifted_teacher():
    db = get_db()
    await db.users.insert_one({
        "id": T_ID, "role": "teacher", "sede_id": SEDE_GGT, "org_id": ORG1,
        "class_ids": [], "class_id": None, "active": True, "email": "drift@ggt.it",
    })
    await db.classes.insert_one({"id": C_ID, "name": "Pesciolini", "sede_id": SEDE_GGT, "teacher_id": T_ID})
    await db.students.insert_one({"id": S_ID, "name": "Nathan", "class_id": C_ID, "sede_id": SEDE_GGT})
    yield _headers(T_ID, "teacher")
    await db.users.delete_one({"id": T_ID})
    await db.classes.delete_one({"id": C_ID})
    await db.students.delete_one({"id": S_ID})


@pytest.mark.asyncio
async def test_teacher_sees_class_assigned_via_teacher_id(client, drifted_teacher):
    r = await client.get("/api/classes", headers=drifted_teacher)
    assert r.status_code == 200
    assert [c["id"] for c in r.json()] == [C_ID]


@pytest.mark.asyncio
async def test_teacher_sees_students_of_class_assigned_via_teacher_id(client, drifted_teacher):
    r = await client.get("/api/students", headers=drifted_teacher)
    assert r.status_code == 200
    assert S_ID in [s["id"] for s in r.json()]


@pytest.mark.asyncio
async def test_auth_me_exposes_effective_class_ids(client, drifted_teacher):
    r = await client.get("/api/auth/me", headers=drifted_teacher)
    assert r.status_code == 200
    assert r.json()["class_ids"] == [C_ID]


@pytest.mark.asyncio
async def test_teacher_does_not_gain_unrelated_classes(client, drifted_teacher):
    r = await client.get("/api/classes", headers=drifted_teacher)
    assert "ggt-class-1" not in [c["id"] for c in r.json()]
