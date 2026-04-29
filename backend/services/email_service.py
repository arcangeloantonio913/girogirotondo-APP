"""Email service — invio credenziali tramite Resend (primario) o SMTP Libero.it (fallback).

Resend è un servizio transazionale cloud-native che funziona perfettamente da Railway.
SMTP Libero.it blocca le connessioni dai server cloud, quindi viene usato solo in locale.

Returns True se l'email è stata inviata, False altrimenti.
NON solleva eccezioni: i fallimenti vengono loggati ma non bloccano la registrazione.
"""
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

SCHOOL_DISPLAY_NAMES = {
    "girogirotondo":  "Girogirotondo — Scuola dell'Infanzia",
    "il-magico-mondo": "Il Magico Mondo — Scuola dell'Infanzia",
}

# FROM: usa onboarding@resend.dev (funziona senza verifica dominio su piano free Resend)
# Per usare scuola@girogirotondowebapp.it: verifica il dominio su resend.com/domains
FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "Girogirotondo <onboarding@resend.dev>")
REPLY_TO   = "scuolagirogirotondo@libero.it"


def _build_html(bambino_nome, bambino_cognome, to_email, password, school_name, year):
    return f"""<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#FFFDD0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:white;border-radius:16px;padding:32px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td align="center" style="padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
            <h1 style="margin:0;font-size:22px;color:#4169E1;font-weight:800;">&#127897; Girogirotondo</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#888;">{school_name}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 0;">
            <p style="margin:0 0 12px;font-size:15px;color:#1A202C;">
              Gentile <strong>Famiglia {bambino_cognome}</strong>,
            </p>
            <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">
              Siamo lieti di darvi il benvenuto nel portale!<br>
              Di seguito le credenziali di accesso per il profilo di
              <strong>{bambino_nome} {bambino_cognome}</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#EBF0FF;border-radius:12px;padding:20px;">
              <tr><td>
                <p style="margin:0 0 12px;font-size:11px;color:#666;font-weight:700;
                           letter-spacing:.5px;text-transform:uppercase;">
                  Credenziali di accesso
                </p>
                <p style="margin:0 0 6px;font-size:14px;color:#1A202C;">
                  <strong>Email:&nbsp;</strong>{to_email}
                </p>
                <p style="margin:0;font-size:14px;color:#1A202C;">
                  <strong>Password:&nbsp;</strong>
                  <code style="background:white;padding:2px 8px;border-radius:6px;
                               color:#4169E1;font-size:14px;">{password}</code>
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
              &#128274;&nbsp;Vi consigliamo di modificare la password al primo accesso.<br>
              Per assistenza:
              <a href="mailto:{REPLY_TO}"
                 style="color:#4169E1;text-decoration:none;font-weight:600;">{REPLY_TO}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="border-top:1px solid #F0F0F0;padding-top:20px;">
            <p style="margin:0;font-size:11px;color:#bbb;">
              &copy; {year} {school_name}<br>
              Messaggio generato automaticamente, non rispondere a questa email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def _send_via_resend(to_email, subject, html_body, plain_body) -> bool:
    """Invio tramite Resend API — funziona da Railway e qualsiasi cloud provider."""
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        logger.debug("[EMAIL] RESEND_API_KEY non configurata, salto Resend")
        return False
    try:
        import resend
        resend.api_key = api_key
        params = resend.Emails.SendParams(
            from_=FROM_EMAIL,
            to=[to_email],
            reply_to=REPLY_TO,
            subject=subject,
            html=html_body,
            text=plain_body,
        )
        email = resend.Emails.send(params)
        logger.info("[EMAIL] Inviata via Resend a %s — id: %s", to_email, email.get("id", "?"))
        return True
    except Exception as exc:
        logger.error("[EMAIL] Errore Resend per %s: %s", to_email, exc)
        return False


async def _send_via_smtp(to_email, subject, html_body, plain_body) -> bool:
    """Fallback SMTP Libero.it — funziona solo da connessioni locali/residenziali."""
    import asyncio, smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from functools import partial

    smtp_pass = os.environ.get("EMAIL_PASSWORD", "")
    if not smtp_pass:
        logger.debug("[EMAIL] EMAIL_PASSWORD non configurata, salto SMTP")
        return False

    def _send():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Girogirotondo Scuola dell'Infanzia <scuolagirogirotondo@libero.it>"
        msg["To"]      = to_email
        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html",  "utf-8"))
        with smtplib.SMTP("smtp.libero.it", 587, timeout=15) as srv:
            srv.ehlo(); srv.starttls()
            srv.login("scuolagirogirotondo@libero.it", smtp_pass)
            srv.sendmail("scuolagirogirotondo@libero.it", [to_email], msg.as_string())

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
) -> bool:
    """
    Invia email di benvenuto con credenziali.
    Prova prima Resend (cloud), poi SMTP Libero (locale).
    Returns True se l'email è stata inviata.
    """
    year        = datetime.now().year
    school_name = SCHOOL_DISPLAY_NAMES.get(sede_name, "Girogirotondo — Scuola dell'Infanzia")
    subject     = f"Benvenuto su Girogirotondo — Credenziali per {bambino_nome} {bambino_cognome}"

    plain_body = (
        f"Gentile Famiglia {bambino_cognome},\n\n"
        f"Benvenuti nel portale {school_name}!\n\n"
        f"Credenziali per {bambino_nome} {bambino_cognome}:\n"
        f"  Email: {to_email}\n"
        f"  Password: {password}\n\n"
        f"Vi consigliamo di cambiare la password al primo accesso.\n\n"
        f"Per assistenza: {REPLY_TO}\n\n{school_name}"
    )
    html_body = _build_html(bambino_nome, bambino_cognome, to_email, password, school_name, year)

    # Prova Resend (sempre funziona da cloud)
    if await _send_via_resend(to_email, subject, html_body, plain_body):
        return True

    # Fallback SMTP Libero (solo locale/residenziale)
    if await _send_via_smtp(to_email, subject, html_body, plain_body):
        return True

    logger.warning(
        "[EMAIL] Nessun metodo di invio disponibile. "
        "Configura RESEND_API_KEY su Railway. "
        "Credenziali per %s: pwd=%s", to_email, password
    )
    return False


async def send_reset_password_email(to_email: str, user_name: str, token: str) -> bool:
    """Invia email con link per il reset della password."""
    year        = datetime.now().year
    frontend_url = os.environ.get("FRONTEND_URL", "https://girogirotondowebapp.it")
    reset_link   = f"{frontend_url}/reset-password?token={token}"

    subject = "Girogirotondo — Reimposta la tua password"
    plain   = (
        f"Ciao {user_name},\n\n"
        f"Hai richiesto il reset della password.\n"
        f"Clicca sul link per procedere (valido 1 ora):\n{reset_link}\n\n"
        f"Se non hai richiesto questo reset, ignora questa email.\n\n"
        f"Girogirotondo — Scuola dell'Infanzia"
    )
    html = f"""<!DOCTYPE html>
<html lang="it"><body style="margin:0;padding:0;background:#FFFDD0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td align="center" style="padding-bottom:20px;border-bottom:1px solid #F0F0F0;">
            <h1 style="margin:0;font-size:22px;color:#4169E1;font-weight:800;">&#127897; Girogirotondo</h1>
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
               style="display:inline-block;background:#4169E1;color:white;text-decoration:none;
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
            <p style="font-size:11px;color:#bbb;">&copy; {year} Girogirotondo — Scuola dell'Infanzia</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    if await _send_via_resend(to_email, subject, html, plain):
        return True
    if await _send_via_smtp(to_email, subject, html, plain):
        return True
    logger.warning("[RESET EMAIL] Impossibile inviare reset a %s — link: %s", to_email, reset_link)
    return False
