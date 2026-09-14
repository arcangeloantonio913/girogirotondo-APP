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
