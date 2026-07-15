"""Identità mittente brand-level + precedenza portal_url (white-label).

Verifica due garanzie anti-leak per il reset password (raggiungibile da QUALSIASI
tenant tramite "Password dimenticata?"):

  1. Il deep-link di reset usa SEMPRE il `portal_url` dell'org del destinatario.
     Un FRONTEND_URL globale (es. il frontend di Girogirotondo su Railway) NON deve
     dirottare i link di reset degli altri tenant. FRONTEND_URL vale solo come
     fallback quando l'org non ha un proprio portal_url.

  2. Se l'org non ha un mittente verificato (`from_email` assente), l'invio viene
     ANNULLATO e nessun transport viene chiamato: `onboarding@resend.dev` verso un
     destinatario reale fallirebbe 403 SILENZIOSAMENTE, quindi non si spedisce.

Nessuna email reale: entrambi i transport sono monkeypatchati.
"""
import services.email_service as es

ORG_DB  = "dimensione-bimbo"   # org 2 (seed conftest), SENZA identità mittente di base
SEDE_DB = "db-sede-1"          # sede di org 2 (seed conftest)

_IDENTITY_FIELDS = {"from_name": "", "from_email": "", "support_email": "", "portal_url": ""}


import pytest_asyncio


@pytest_asyncio.fixture(autouse=True)
async def clean_org_identity(seed_db):
    """Azzera i campi identità su ORG_DB prima e dopo ogni test.

    seed_db è session-scoped: senza reset le mutazioni di un test contaminerebbero
    gli altri. Ogni test imposta esplicitamente solo ciò che gli serve.
    """
    await seed_db.orgs.update_one({"id": ORG_DB}, {"$unset": _IDENTITY_FIELDS})
    yield
    await seed_db.orgs.update_one({"id": ORG_DB}, {"$unset": _IDENTITY_FIELDS})


async def test_portal_url_wins_over_frontend_url_env(seed_db, monkeypatch):
    """org.portal_url vince su FRONTEND_URL anche quando l'env punta a Giro."""
    await seed_db.orgs.update_one({"id": ORG_DB}, {"$set": {
        "from_name":     "Dimensione Bimbo",
        "from_email":    "noreply@dimensionebimbo.example",
        "support_email": "info@dimensionebimbo.example",
        "portal_url":    "https://portale.dimensionebimbo.example",
    }})

    captured = {}

    async def fake_resend(to_email, subject, html, plain,
                          from_name=None, from_email=None, reply_to=None):
        captured.update(html=html, plain=plain, from_name=from_name,
                        from_email=from_email, reply_to=reply_to)
        return True

    monkeypatch.setattr(es, "_send_via_resend", fake_resend)
    # FRONTEND_URL = portale di Girogirotondo: NON deve comparire nel link DB.
    monkeypatch.setenv("FRONTEND_URL", "https://girogirotondowebapp.it")

    ok = await es.send_reset_password_email(
        "p@db2.it", "Marco", "tok-123", sede_id=SEDE_DB, org_id=ORG_DB)

    assert ok is True
    link = "https://portale.dimensionebimbo.example/reset-password?token=tok-123"
    assert link in captured["plain"]
    assert link in captured["html"]
    assert "girogirotondowebapp.it" not in captured["plain"]
    assert "girogirotondowebapp.it" not in captured["html"]
    # Mittente + Reply-To provengono dall'identità dell'org, non da valori Giro.
    assert captured["from_email"] == "noreply@dimensionebimbo.example"
    assert captured["reply_to"] == "info@dimensionebimbo.example"


async def test_no_reset_when_org_lacks_portal_url(seed_db, monkeypatch):
    """Org SENZA portal_url (solo landing) → reset NON inviato, anche se c'è un
    mittente verificato e un FRONTEND_URL globale. Un link di reset senza portale
    del tenant non ha destinazione e non deve finire su un FRONTEND_URL di terzi."""
    # Mittente verificato presente ma NESSUN portal_url (come Dimensione Bimbo).
    await seed_db.orgs.update_one({"id": ORG_DB}, {"$set": {
        "from_email": "noreply@dimensionebimbo.example",
    }})

    called = {"resend": False, "smtp": False}

    async def fake_resend(*a, **k):
        called["resend"] = True
        return True

    async def fake_smtp(*a, **k):
        called["smtp"] = True
        return True

    monkeypatch.setattr(es, "_send_via_resend", fake_resend)
    monkeypatch.setattr(es, "_send_via_smtp", fake_smtp)
    # FRONTEND_URL globale (Giro) NON deve fungere da fallback per un tenant DB.
    monkeypatch.setenv("FRONTEND_URL", "https://girogirotondowebapp.it")

    ok = await es.send_reset_password_email(
        "p@db2.it", "Marco", "tok-456", sede_id=SEDE_DB, org_id=ORG_DB)

    assert ok is False
    assert called["resend"] is False
    assert called["smtp"] is False


async def test_no_send_when_org_lacks_verified_sender(seed_db, monkeypatch):
    """Org senza from_email → invio annullato, nessun transport chiamato."""
    called = {"resend": False, "smtp": False}

    async def fake_resend(*a, **k):
        called["resend"] = True
        return True

    async def fake_smtp(*a, **k):
        called["smtp"] = True
        return True

    monkeypatch.setattr(es, "_send_via_resend", fake_resend)
    monkeypatch.setattr(es, "_send_via_smtp", fake_smtp)
    # ORG_DB non ha from_email (clean_org_identity lo ha azzerato).
    ok = await es.send_reset_password_email(
        "p@db2.it", "Marco", "tok-789", sede_id=SEDE_DB, org_id=ORG_DB)

    assert ok is False
    assert called["resend"] is False
    assert called["smtp"] is False
