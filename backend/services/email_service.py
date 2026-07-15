"""Email service — invio credenziali tramite Resend (primario) o SMTP Libero.it (fallback).

Resend è un servizio transazionale cloud-native che funziona perfettamente da Railway.
SMTP Libero.it blocca le connessioni dai server cloud, quindi viene usato solo in locale.

Returns True se l'email è stata inviata, False altrimenti.
NON solleva eccezioni: i fallimenti vengono loggati ma non bloccano la registrazione.
"""
import os
import json as _json
import logging
import urllib.request
import urllib.error
from datetime import datetime

logger = logging.getLogger(__name__)

# Fallback TENANT-NEUTRO: usato SOLO se né la sede né l'org si risolvono.
# NON contiene alcun nome-scuola/brand — così l'email di un cliente non può MAI
# mostrare il nome di un'altra scuola (fuga di brand cross-tenant). White-label.
_NEUTRAL_SCHOOL_NAME = "Portale Famiglie"
# Colore neutro quando sede.color manca: grigio, MAI il blu di Giro (#4169E1)
# come default (sarebbe un brand-leak visivo verso Girogirotondo).
_NEUTRAL_COLOR = "#6B7280"

# Display-name neutro se l'org non ha `from_name` (solo cosmetico: senza un
# `from_email` verificato NON si invia comunque — vedi _org_identity).
# NIENTE fallback per il from_email: onboarding@resend.dev accetta invii solo
# verso il titolare dell'account Resend → verso un genitore reale darebbe 403
# SILENZIOSO. Se l'org non ha un mittente verificato, l'invio va ANNULLATO
# con un errore esplicito, non mascherato da un mittente generico.
_NEUTRAL_FROM_NAME = _NEUTRAL_SCHOOL_NAME


def _tint(hex_color: str, weight: float = 0.10) -> str:
    """Sfondo chiaro derivato dal colore del tenant (weight·colore + (1-weight)·bianco).

    Sostituisce lo sfondo azzurro fisso del box credenziali (#EBF0FF): così il box
    prende la tinta del tenant (verde per un Nido, ecc.) invece del blu di Giro.
    Per Giro (#4169E1) → ~#ECF0FC, visivamente identico all'azzurro originale.
    """
    try:
        h = hex_color.lstrip("#")
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except Exception:
        return "#F3F4F6"
    mix = lambda c: round(c * weight + 255 * (1 - weight))
    return f"#{mix(r):02X}{mix(g):02X}{mix(b):02X}"


def _brand_parts(school_name: str):
    """Scompone "<Brand> — <Qualifica>" in (brand, qualifica).

    brand → header/titolo; qualifica → sottotitoli. Se non c'è em-dash,
    qualifica = "" (es. fallback org.name o "Portale Famiglie").
    """
    parts = [p.strip() for p in school_name.split("—", 1)]
    return parts[0], (parts[1] if len(parts) > 1 else "")


def _org_identity(org_doc: dict | None, org_id: str | None) -> dict:
    """Identità mittente BRAND-LEVEL letta dal documento org (non dalla sede).

    Campi: from_name (display mittente), from_email (indirizzo mittente VERIFICATO
    su Resend), support_email (contatti nel corpo + Reply-To), portal_url (link nel corpo).

    `from_email` NON ha fallback: se l'org non lo ha configurato, l'identità è
    "non spedibile" (from_email=None) e le send_* devono ANNULLARE l'invio con un
    errore esplicito. MAI sostituirlo con un mittente generico (fallirebbe 403
    silenzioso) né con un valore di un altro tenant.
    """
    fn = fe = se = pu = None
    if org_doc:
        fn = org_doc.get("from_name") or None
        fe = org_doc.get("from_email") or None
        se = org_doc.get("support_email") or None
        pu = org_doc.get("portal_url") or None

    if not fe:
        logger.error(
            "[EMAIL] org %r senza mittente verificato (from_email assente) — "
            "invio da annullare (nessun fallback: eviterei un 403 Resend silenzioso)",
            org_id,
        )

    se = se or fe            # contatto: support se presente, altrimenti il mittente
    return {
        "org_id":        org_id,
        "from_name":     fn or _NEUTRAL_FROM_NAME,
        "from_email":    fe,               # None ⇒ identità non spedibile
        "support_email": se,
        "portal_url":    pu or "",
        "reply_to":      se,               # le risposte vanno alla scuola giusta
    }


async def _resolve_email_context(sede_id: str, org_id: str | None = None):
    """Risolve tutto ciò che serve a un'email tenant-safe, letto dal DB.

    Ritorna (school_name, color, identity):
      - school_name/color → brand mostrato nel corpo (vedi cascata sotto).
      - identity → dict mittente brand-level (vedi _org_identity).

    NOME — cascata: sede.email_display_name → org.name → ERROR + neutro.
    COLORE — sede.color → neutro (_NEUTRAL_COLOR), MAI il blu di Giro.
    IDENTITÀ — sempre dall'org (dell'utente o ricavata dalla sede).
    """
    from services.database import get_db
    db = get_db()

    name = None
    color = None
    eff_org = org_id

    # 1. Sede — email_display_name + color + org_id (stesso modello di GET /api/sedi)
    if sede_id:
        try:
            sede = await db.sedi.find_one(
                {"id": sede_id}, {"_id": 0, "email_display_name": 1, "color": 1, "org_id": 1}
            )
        except Exception as exc:
            logger.error("[EMAIL] lookup sede '%s' fallito: %s", sede_id, exc)
            sede = None
        if sede:
            name = sede.get("email_display_name") or None
            color = sede.get("color") or None
            eff_org = org_id or sede.get("org_id")

    # 2. Org — nome (fallback brand) + identità mittente (sempre necessaria)
    org_doc = None
    if eff_org:
        try:
            org_doc = await db.orgs.find_one(
                {"id": eff_org},
                {"_id": 0, "name": 1, "from_name": 1, "from_email": 1,
                 "support_email": 1, "portal_url": 1},
            )
        except Exception as exc:
            logger.error("[EMAIL] lookup org '%s' fallito: %s", eff_org, exc)
            org_doc = None
    if not name and org_doc and org_doc.get("name"):
        name = org_doc["name"]

    # 3. Nessuna risoluzione del nome → NIENTE brand (evita fuga cross-tenant).
    if not name:
        logger.error(
            "[EMAIL] nome-scuola non risolvibile (sede_id=%r org_id=%r) — "
            "uso fallback tenant-neutro senza brand", sede_id, eff_org,
        )
        name = _NEUTRAL_SCHOOL_NAME

    return name, (color or _NEUTRAL_COLOR), _org_identity(org_doc, eff_org)


async def _resolve_brand(sede_id: str, org_id: str | None = None):
    """Solo (nome-scuola, colore) — vedi _resolve_email_context per la cascata."""
    name, color, _ = await _resolve_email_context(sede_id, org_id)
    return name, color


async def _get_school_display_name(sede_id: str, org_id: str | None = None) -> str:
    """Solo il nome-scuola (vedi _resolve_email_context per la cascata completa)."""
    name, _ = await _resolve_brand(sede_id, org_id)
    return name


def _sender_ready(ident: dict) -> bool:
    """False (e log ERROR) se l'org non ha un from_email verificato.

    In quel caso l'invio va ANNULLATO: spedire con un mittente generico
    (onboarding@resend.dev) verso un genitore reale darebbe un 403 Resend
    silenzioso e la famiglia non riceverebbe mai le credenziali.
    """
    if not ident.get("from_email"):
        logger.error(
            "[EMAIL] invio ANNULLATO: org %r non ha un mittente verificato (from_email). "
            "Configura from_email/from_name/support_email/portal_url sul documento org.",
            ident.get("org_id"),
        )
        return False
    return True

# Fallback mittente SOLO se il chiamante non passa un'identità org (non dovrebbe
# succedere: tutte le send_* risolvono l'identità dall'org e annullano l'invio se
# manca il from_email). NIENTE default di Girogirotondo: solo l'env, se impostata.
def _get_from_email():
    return os.environ.get("RESEND_FROM_EMAIL", "").strip()

FROM_EMAIL = _get_from_email()  # compatibilità backward
REPLY_TO   = os.environ.get("RESEND_REPLY_TO", "").strip()


def _build_html(bambino_nome, bambino_cognome, to_email, password, school_name, year,
                header_color, support_email, portal_url):
    # Il display-name è "<Brand> — <Qualifica>" (es. "Girogirotondo — Scuola
    # dell'Infanzia", "Dimensione Bimbo — Nido"). Scomponiamo per usare il brand
    # nell'header e la qualifica nei sottotitoli: così restano TENANT-NEUTRE
    # (un Nido 0-3 non è una "scuola dell'infanzia") e Giro resta identico.
    # header_color arriva da sede.color (via _resolve_email_context): per Giro è
    # #4169E1, identico all'ex-euristica.
    school_header, school_kind = _brand_parts(school_name)
    # Sottotitolo header: "<Qualifica> — Portale Famiglie" (o solo "Portale Famiglie")
    subtitle       = f"{school_kind} — Portale Famiglie" if school_kind else "Portale Famiglie"
    # Suffisso riga contatti: solo il brand resta in <strong>, la qualifica fuori
    # (preserva l'esatto grassetto di Giro: "<b>Girogirotondo</b> — Scuola dell'Infanzia")
    contatti_suffix = f" — {school_kind}" if school_kind else ""
    # Mittente/portale/contatti dal documento org (brand-level, non hardcoded).
    cred_box_bg   = _tint(header_color)   # box credenziali: tinta del tenant, non azzurro fisso
    portal_display = portal_url.replace("https://", "").replace("http://", "")

    # Blocchi dipendenti dal portale web. Se l'org NON ha portal_url (es. tenant con
    # sola landing, nessun login web) li OMETTIAMO: niente link rotti nel corpo.
    # Per un org CON portal_url (es. Girogirotondo) l'output resta byte-identico.
    if portal_url:
        come_accedere = f"""
            <!-- Come accedere -->
            <p style="margin:0 0 12px;font-size:14px;color:#1A202C;font-weight:700;">
              📱 Come accedere al portale
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#F8F9FA;border-radius:12px;padding:16px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0 0 8px;font-size:13px;color:#374151;line-height:1.6;">
                  <strong>Passo 1.</strong> Apri il browser sul tuo smartphone o computer
                </p>
                <p style="margin:0 0 8px;font-size:13px;color:#374151;line-height:1.6;">
                  <strong>Passo 2.</strong> Vai all'indirizzo:
                  <a href="{portal_url}"
                     style="color:{header_color};font-weight:700;text-decoration:none;">
                    {portal_display}
                  </a>
                </p>
                <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">
                  <strong>Passo 3.</strong> Inserisci l'email e la password indicata sopra
                </p>
              </td></tr>
            </table>

            <!-- Pulsante accesso -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="{portal_url}"
                     style="display:inline-block;background:{header_color};color:white;
                            text-decoration:none;padding:14px 40px;border-radius:12px;
                            font-weight:800;font-size:15px;letter-spacing:0.3px;">
                    Accedi al Portale →
                  </a>
                </td>
              </tr>
            </table>

"""
        footer_web = f"""              <tr>
                <td style="font-size:12px;color:#374151;">
                  🌐
                  <a href="{portal_url}"
                     style="color:{header_color};text-decoration:none;font-weight:600;">
                    {portal_display}
                  </a>
                </td>
              </tr>
"""
    else:
        come_accedere = ""
        footer_web = ""

    return f"""<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#FFFDD0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:white;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- HEADER COLORATO -->
        <tr>
          <td align="center"
              style="background:{header_color};padding:28px 32px 24px;">
            <h1 style="margin:0;font-size:26px;color:white;font-weight:900;
                        letter-spacing:-0.5px;">&#127897; {school_header}</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">
              {subtitle}
            </p>
          </td>
        </tr>

        <!-- CORPO -->
        <tr>
          <td style="padding:32px 32px 0;">

            <!-- Saluto -->
            <p style="margin:0 0 8px;font-size:16px;color:#1A202C;font-weight:700;">
              Benvenuta Famiglia {bambino_cognome}! 👋
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.75;">
              Siamo lieti di comunicarvi che <strong>{bambino_nome} {bambino_cognome}</strong>
              è stato registrato con successo nel portale digitale della scuola.<br>
              Di seguito trovate le credenziali personali per accedere.
            </p>

            <!-- Box credenziali -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:{cred_box_bg};border-radius:12px;padding:20px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0 0 14px;font-size:11px;color:{header_color};font-weight:800;
                           letter-spacing:.8px;text-transform:uppercase;">
                  🔑 Le tue credenziali di accesso
                </p>
                <table width="100%" cellpadding="6">
                  <tr>
                    <td style="font-size:13px;color:#555;width:90px;">Email</td>
                    <td style="font-size:14px;color:#1A202C;font-weight:700;">{to_email}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#555;">Password</td>
                    <td>
                      <code style="background:white;padding:4px 12px;border-radius:8px;
                                   color:{header_color};font-size:15px;font-weight:800;
                                   border:1px solid #E2E8F0;">{password}</code>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
{come_accedere}            <!-- Nota sicurezza -->
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;
                       padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
              🔒 Per sicurezza vi consigliamo di cambiare la password al primo accesso.<br>
              Le credenziali sono personali e non vanno condivise con altri.
            </p>
          </td>
        </tr>

        <!-- FOOTER CONTATTI -->
        <tr>
          <td style="padding:20px 32px 28px;background:#FAFAFA;">
            <p style="margin:0 0 10px;font-size:12px;color:#6B7280;font-weight:700;
                       text-transform:uppercase;letter-spacing:.5px;">
              Contatti Scuola
            </p>
            <table width="100%" cellpadding="4">
              <tr>
                <td style="font-size:12px;color:#374151;">
                  🏫 <strong>{school_header}</strong>{contatti_suffix}
                </td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#374151;">
                  📧
                  <a href="mailto:{support_email}"
                     style="color:{header_color};text-decoration:none;font-weight:600;">
                    {support_email}
                  </a>
                </td>
              </tr>
{footer_web}            </table>
            <p style="margin:14px 0 0;font-size:10px;color:#D1D5DB;text-align:center;">
              &copy; {year} {school_name} &nbsp;|&nbsp;
              Messaggio automatico — non rispondere a questa email
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _resend_http_sync(api_key: str, payload: dict):
    """Chiama Resend API via urllib (stdlib) — zero dipendenze esterne."""
    data = _json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        "https://api.resend.com/emails",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent":     "girogirotondo-app/1.0",
            "Content-Type":  "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


async def _send_via_resend(to_email, subject, html_body, plain_body,
                           from_name=None, from_email=None, reply_to=None) -> bool:
    """Invio tramite Resend API HTTP diretta — nessun SDK, solo stdlib Python.

    Mittente/Reply-To arrivano dall'identità dell'org (brand-level). Fallback ai
    default solo se il chiamante non passa nulla (retrocompatibilità).
    """
    import asyncio
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        logger.warning("[EMAIL] RESEND_API_KEY non trovata nelle env vars di Railway!")
        return False
    fe = from_email or _get_from_email()
    from_field = f"{from_name} <{fe}>" if from_name else fe
    payload = {
        "from":     from_field,
        "to":       [to_email],
        "reply_to": reply_to or REPLY_TO,
        "subject":  subject,
        "html":     html_body,
        "text":     plain_body,
    }
    try:
        loop = asyncio.get_event_loop()
        status, body = await loop.run_in_executor(
            None, lambda: _resend_http_sync(api_key, payload)
        )
        if status in (200, 201):
            try:
                resp_id = _json.loads(body).get("id", "?")
            except Exception:
                resp_id = "?"
            logger.info("[EMAIL] ✅ Resend OK → %s  id=%s", to_email, resp_id)
            return True
        logger.error("[EMAIL] ❌ Resend %d → %s", status, body[:400])
        return False
    except Exception as exc:
        logger.error("[EMAIL] ❌ Resend exception → %s", exc)
        return False


async def _send_via_smtp(to_email, subject, html_body, plain_body,
                         from_name=None, from_email=None, reply_to=None) -> bool:
    """Fallback SMTP Libero.it — funziona solo da connessioni locali/residenziali.

    Header From/Reply-To riflettono l'identità dell'org. L'account SMTP autenticato
    resta quello del relay Libero (SMTP_USER), indipendente dal tenant: Libero non
    permette di spedire da mittenti arbitrari non autenticati.
    """
    import asyncio, smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    smtp_pass = os.environ.get("EMAIL_PASSWORD", "")
    if not smtp_pass:
        logger.debug("[EMAIL] EMAIL_PASSWORD non configurata, salto SMTP")
        return False
    # Account autenticato del relay Libero — credenziale infra (NON mostrato al
    # destinatario: From/Reply-To sono guidati dall'identità org). Env-configurabile.
    smtp_user = os.environ.get("SMTP_USER", "girogirotondo@libero.it")
    smtp_host = os.environ.get("SMTP_HOST", "smtp.libero.it")
    fn = from_name or _NEUTRAL_FROM_NAME
    fe = from_email or smtp_user

    def _send():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{fn} <{fe}>"
        msg["To"]      = to_email
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html",  "utf-8"))
        with smtplib.SMTP(smtp_host, 587, timeout=15) as srv:
            srv.ehlo(); srv.starttls()
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(smtp_user, [to_email], msg.as_string())

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send)
        logger.info("[EMAIL] Inviata via SMTP Libero a %s", to_email)
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error("[EMAIL] SMTP auth fallita — password Libero errata")
        return False
    except Exception as exc:
        logger.error("[EMAIL] Errore SMTP per %s: %s", to_email, exc)
        return False


async def send_credentials_email(
    to_email: str,
    bambino_nome: str,
    bambino_cognome: str,
    password: str,
    sede_name: str = "girogirotondo",
    org_id: str | None = None,
) -> bool:
    """
    Invia email di benvenuto con credenziali.
    Prova prima Resend (cloud), poi SMTP Libero (locale).
    `org_id`: org dell'utente destinatario — usato come fallback per il
    nome-scuola se la sede non si risolve (vedi _get_school_display_name).
    Returns True se l'email è stata inviata.
    """
    year        = datetime.now().year
    school_name, brand_color, ident = await _resolve_email_context(sede_name, org_id)
    if not _sender_ready(ident):
        return False
    brand_header, _ = _brand_parts(school_name)
    subject     = f"Benvenuto su {brand_header} — Credenziali per {bambino_nome} {bambino_cognome}"

    plain_body = (
        f"Gentile Famiglia {bambino_cognome},\n\n"
        f"Benvenuti nel portale {school_name}!\n\n"
        f"Credenziali per {bambino_nome} {bambino_cognome}:\n"
        f"  Email: {to_email}\n"
        f"  Password: {password}\n\n"
        f"Vi consigliamo di cambiare la password al primo accesso.\n\n"
        f"Per assistenza: {ident['support_email']}\n\n{school_name}"
    )
    html_body = _build_html(bambino_nome, bambino_cognome, to_email, password, school_name,
                            year, brand_color, ident["support_email"], ident["portal_url"])

    # Prova Resend (sempre funziona da cloud)
    if await _send_via_resend(to_email, subject, html_body, plain_body,
                              from_name=ident["from_name"], from_email=ident["from_email"],
                              reply_to=ident["reply_to"]):
        return True

    # Fallback SMTP Libero (solo locale/residenziale)
    if await _send_via_smtp(to_email, subject, html_body, plain_body,
                            from_name=ident["from_name"], from_email=ident["from_email"],
                            reply_to=ident["reply_to"]):
        return True

    logger.warning(
        "[EMAIL] Nessun metodo di invio disponibile. "
        "Configura RESEND_API_KEY su Railway. "
        "Credenziali per %s: pwd=%s", to_email, password
    )
    return False


async def send_resend_credentials_email(
    to_email: str,
    user_name: str,
    new_password: str,
    role: str = "parent",
    sede_id: str | None = None,
    org_id: str | None = None,
) -> bool:
    """
    Invia email di aggiornamento credenziali (usata quando l'admin resetta la password).
    Funziona per qualsiasi ruolo (genitore, maestra, admin).
    Brand (nome + colore) risolto dal DB via _resolve_brand: nessun literal
    "Girogirotondo" — l'email riporta il brand della sede/org del destinatario.
    """
    year = datetime.now().year
    role_label = {"parent": "Genitore", "teacher": "Maestra", "admin": "Amministratore"}.get(role, "Utente")
    school_name, brand_color, ident = await _resolve_email_context(sede_id, org_id)
    if not _sender_ready(ident):
        return False
    brand_header, _ = _brand_parts(school_name)
    cred_box_bg = _tint(brand_color)

    subject = f"{brand_header} — Aggiornamento credenziali di accesso"
    plain = (
        f"Ciao {user_name},\n\n"
        f"Le tue credenziali di accesso al portale sono state aggiornate.\n\n"
        f"Email:    {to_email}\n"
        f"Password: {new_password}\n\n"
        f"Accedi su: {ident['portal_url']}\n\n"
        f"Per assistenza: {ident['support_email']}\n\n"
        f"{school_name}"
    )
    html = f"""<!DOCTYPE html>
<html lang="it"><body style="margin:0;padding:0;background:#FFFDD0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        <tr>
          <td align="center" style="background:{brand_color};padding:28px 32px 24px;">
            <h1 style="margin:0;font-size:26px;color:white;font-weight:900;">&#127897; {brand_header}</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Aggiornamento credenziali</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 0;">
            <p style="margin:0 0 16px;font-size:15px;color:#1A202C;font-weight:700;">Ciao {user_name}! 👋</p>
            <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.75;">
              Le tue credenziali di accesso al portale <strong>{brand_header}</strong> sono state aggiornate dall'amministrazione.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:{cred_box_bg};border-radius:12px;padding:20px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0 0 14px;font-size:11px;color:{brand_color};font-weight:800;letter-spacing:.8px;text-transform:uppercase;">
                  🔑 Le tue nuove credenziali
                </p>
                <table width="100%" cellpadding="6">
                  <tr>
                    <td style="font-size:13px;color:#555;width:90px;">Email</td>
                    <td style="font-size:14px;color:#1A202C;font-weight:700;">{to_email}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#555;">Password</td>
                    <td>
                      <code style="background:white;padding:4px 12px;border-radius:8px;
                                   color:{brand_color};font-size:15px;font-weight:800;
                                   border:1px solid #E2E8F0;">{new_password}</code>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td align="center">
                <a href="{ident['portal_url']}"
                   style="display:inline-block;background:{brand_color};color:white;text-decoration:none;
                          padding:14px 40px;border-radius:12px;font-weight:800;font-size:15px;">
                  Accedi al Portale →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;background:#FAFAFA;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;">
              &copy; {year} {school_name} &nbsp;|&nbsp;
              <a href="mailto:{ident['support_email']}" style="color:{brand_color};">{ident['support_email']}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    if await _send_via_resend(to_email, subject, html, plain,
                              from_name=ident["from_name"], from_email=ident["from_email"],
                              reply_to=ident["reply_to"]):
        return True
    return await _send_via_smtp(to_email, subject, html, plain,
                                from_name=ident["from_name"], from_email=ident["from_email"],
                                reply_to=ident["reply_to"])


async def send_reset_password_email(
    to_email: str,
    user_name: str,
    token: str,
    sede_id: str | None = None,
    org_id: str | None = None,
) -> bool:
    """Invia email con link per il reset della password.

    Brand (nome + colore) dal DB via _resolve_brand: nessun literal "Girogirotondo".
    Raggiungibile dal link "Password dimenticata?" di QUALSIASI tenant → deve
    riportare il brand corretto del destinatario, non quello di Girogirotondo.
    """
    year        = datetime.now().year
    school_name, brand_color, ident = await _resolve_email_context(sede_id, org_id)
    if not _sender_ready(ident):
        return False
    # Il deep-link di reset richiede un portale web (destinazione del link). Un org
    # con sola landing (portal_url vuoto) NON ha dove far atterrare il reset: inviare
    # un link rotto — o peggio, dirottarlo su un FRONTEND_URL globale di un ALTRO
    # tenant — sarebbe un leak/errore. Quindi: nessun portal_url → nessun invio.
    if not ident["portal_url"]:
        logger.error(
            "[RESET] Invio ANNULLATO: org %r non ha portal_url (nessun portale web) — "
            "reset non recapitabile. Il reset password va gestito fuori app.",
            ident.get("org_id"),
        )
        return False
    brand_header, _ = _brand_parts(school_name)
    # Il portale del TENANT è SEMPRE la base del deep-link (mai un FRONTEND_URL globale
    # che dirotterebbe i reset di un altro tenant sul portale sbagliato).
    frontend_url = ident["portal_url"]
    reset_link   = f"{frontend_url}/reset-password?token={token}"

    subject = f"{brand_header} — Reimposta la tua password"
    plain   = (
        f"Ciao {user_name},\n\n"
        f"Hai richiesto il reset della password.\n"
        f"Clicca sul link per procedere (valido 1 ora):\n{reset_link}\n\n"
        f"Se non hai richiesto questo reset, ignora questa email.\n\n"
        f"{school_name}"
    )
    html = f"""<!DOCTYPE html>
<html lang="it"><body style="margin:0;padding:0;background:#FFFDD0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td align="center" style="padding-bottom:20px;border-bottom:1px solid #F0F0F0;">
            <h1 style="margin:0;font-size:22px;color:{brand_color};font-weight:800;">&#127897; {brand_header}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 0;">
            <p style="font-size:15px;color:#1A202C;">Ciao <strong>{user_name}</strong>,</p>
            <p style="font-size:14px;color:#555;line-height:1.7;">
              Hai richiesto di reimpostare la password del tuo account.<br>
              Clicca sul pulsante qui sotto per procedere. Il link è valido per <strong>1 ora</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0;" align="center">
            <a href="{reset_link}"
               style="display:inline-block;background:{brand_color};color:white;text-decoration:none;
                      padding:14px 32px;border-radius:12px;font-weight:bold;font-size:15px;">
              Reimposta Password
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:20px;">
            <p style="font-size:12px;color:#888;">
              Se non hai richiesto questo reset, ignora questa email. La password rimarrà invariata.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="border-top:1px solid #F0F0F0;padding-top:16px;">
            <p style="font-size:11px;color:#bbb;">&copy; {year} {school_name}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    if await _send_via_resend(to_email, subject, html, plain,
                              from_name=ident["from_name"], from_email=ident["from_email"],
                              reply_to=ident["reply_to"]):
        return True
    if await _send_via_smtp(to_email, subject, html, plain,
                            from_name=ident["from_name"], from_email=ident["from_email"],
                            reply_to=ident["reply_to"]):
        return True
    # Do NOT log the reset link (account-takeover token) or the recipient email.
    logger.warning("[RESET EMAIL] Invio reset fallito (email e link non loggati per privacy/sicurezza)")
    return False


async def send_appointment_email(
    to_email: str,
    parent_name: str,
    date: str,
    time_slot: str,
    reason: str,
    status: str = "pending",
    sede_id: str | None = None,
    org_id: str | None = None,
) -> bool:
    """
    Invia notifica email per prenotazione o conferma appuntamento.
    status: 'pending' (nuova prenotazione) | 'confirmed' (confermata) | 'cancelled' (annullata)
    Brand (nome + colore) dal DB via _resolve_brand: nessun literal "Girogirotondo".
    NB: `status_color` (arancio/verde/rosso) resta il colore SEMANTICO dello stato,
    distinto dal `brand_color` della scuola usato nell'header.
    """
    year = datetime.now().year
    school_name, brand_color, ident = await _resolve_email_context(sede_id, org_id)
    if not _sender_ready(ident):
        return False
    brand_header, _ = _brand_parts(school_name)
    status_labels = {
        "pending":   ("Nuova prenotazione ricevuta", "#F59E0B"),
        "confirmed": ("Appuntamento confermato ✅",  "#32CD32"),
        "cancelled": ("Appuntamento annullato",       "#EF4444"),
    }
    label, status_color = status_labels.get(status, ("Aggiornamento appuntamento", brand_color))

    try:
        date_fmt = datetime.strptime(date, "%Y-%m-%d").strftime("%-d %B %Y")
    except Exception:
        date_fmt = date

    subject = f"{brand_header} — {label}"
    plain = (
        f"Gentile {parent_name},\n\n"
        f"{label}\n\n"
        f"Data:    {date_fmt}\n"
        f"Orario:  {time_slot}\n"
        f"Motivo:  {reason}\n\n"
        f"Per informazioni: {ident['support_email']}\n\n"
        f"{school_name}"
    )
    html = f"""<!DOCTYPE html>
<html lang="it"><body style="margin:0;padding:0;background:#FFFDD0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td align="center" style="padding-bottom:20px;border-bottom:1px solid #F0F0F0;">
            <h1 style="margin:0;font-size:22px;color:{brand_color};font-weight:800;">&#127897; {brand_header}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 12px;">
            <p style="font-size:15px;color:#1A202C;">Gentile <strong>{parent_name}</strong>,</p>
            <p style="font-size:14px;color:{status_color};font-weight:bold;">{label}</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:24px;">
            <table width="100%" style="background:#F9FAFB;border-radius:12px;padding:16px;" cellpadding="8">
              <tr><td style="font-size:13px;color:#666;width:100px;">Data</td>
                  <td style="font-size:13px;color:#1A202C;font-weight:bold;">{date_fmt}</td></tr>
              <tr><td style="font-size:13px;color:#666;">Orario</td>
                  <td style="font-size:13px;color:#1A202C;font-weight:bold;">{time_slot}</td></tr>
              <tr><td style="font-size:13px;color:#666;">Motivo</td>
                  <td style="font-size:13px;color:#1A202C;">{reason}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="border-top:1px solid #F0F0F0;padding-top:16px;">
            <p style="font-size:11px;color:#bbb;">&copy; {year} {school_name}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    if await _send_via_resend(to_email, subject, html, plain,
                              from_name=ident["from_name"], from_email=ident["from_email"],
                              reply_to=ident["reply_to"]):
        return True
    return await _send_via_smtp(to_email, subject, html, plain,
                                from_name=ident["from_name"], from_email=ident["from_email"],
                                reply_to=ident["reply_to"])
