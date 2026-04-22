"""Email service — invio credenziali via SMTP Libero.it"""
import os
import smtplib
import asyncio
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import partial

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.libero.it"
SMTP_PORT = 587
SMTP_USER = "scuolagirogirotondo@libero.it"
SMTP_PASS = os.environ.get("EMAIL_PASSWORD", "")


def _send_sync(to_email: str, subject: str, html_body: str, plain_body: str = ""):
    """Invio sincrono da eseguire in executor (smtplib è bloccante)."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Girogirotondo Scuola dell'Infanzia <{SMTP_USER}>"
    msg["To"] = to_email

    if plain_body:
        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, [to_email], msg.as_string())


async def send_credentials_email(
    to_email: str,
    bambino_nome: str,
    bambino_cognome: str,
    password: str,
):
    """Invia email di benvenuto con le credenziali di accesso al genitore."""
    subject = f"Benvenuto su Girogirotondo — Credenziali per {bambino_nome} {bambino_cognome}"

    plain_body = (
        f"Gentile Famiglia {bambino_cognome},\n\n"
        f"Benvenuti nel portale Girogirotondo!\n\n"
        f"Credenziali per {bambino_nome} {bambino_cognome}:\n"
        f"  Email: {to_email}\n"
        f"  Password: {password}\n\n"
        f"Vi consigliamo di cambiare la password al primo accesso.\n\n"
        f"Per assistenza: scuolagirogirotondo@libero.it\n\n"
        f"Girogirotondo — Scuola dell'Infanzia"
    )

    html_body = f"""
<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#FFFDD0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:white;border-radius:16px;padding:32px;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Logo / Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;
                border-bottom:1px solid #F0F0F0;">
              <h1 style="margin:0;font-size:22px;color:#4169E1;
                         font-weight:800;">&#127897; Girogirotondo</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#888;">
                Scuola dell'Infanzia
              </p>
            </td>
          </tr>

          <!-- Saluto -->
          <tr>
            <td style="padding:24px 0 0;">
              <p style="margin:0 0 12px;font-size:15px;color:#1A202C;">
                Gentile <strong>Famiglia {bambino_cognome}</strong>,
              </p>
              <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">
                Siamo lieti di darvi il benvenuto nel portale Girogirotondo!<br>
                Di seguito le credenziali di accesso per il profilo di
                <strong>{bambino_nome} {bambino_cognome}</strong>.
              </p>
            </td>
          </tr>

          <!-- Box credenziali -->
          <tr>
            <td style="padding:20px 0;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#EBF0FF;border-radius:12px;padding:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 12px;font-size:11px;color:#666;
                               font-weight:700;letter-spacing:.5px;
                               text-transform:uppercase;">
                      Credenziali di accesso
                    </p>
                    <p style="margin:0 0 6px;font-size:14px;color:#1A202C;">
                      <strong>Email:&nbsp;</strong>{to_email}
                    </p>
                    <p style="margin:0;font-size:14px;color:#1A202C;">
                      <strong>Password:&nbsp;</strong>
                      <code style="background:white;padding:2px 8px;
                                   border-radius:6px;color:#4169E1;
                                   font-size:14px;">{password}</code>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Nota sicurezza -->
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
                &#128274;&nbsp;Vi consigliamo di modificare la password al primo accesso.<br>
                Per qualsiasi necessità contattateci a:<br>
                <a href="mailto:scuolagirogirotondo@libero.it"
                   style="color:#4169E1;text-decoration:none;font-weight:600;">
                  scuolagirogirotondo@libero.it
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center"
                style="border-top:1px solid #F0F0F0;padding-top:20px;">
              <p style="margin:0;font-size:11px;color:#bbb;">
                &copy; {bambino_nome[:4] if bambino_nome else '2024'[:4]}
                Girogirotondo — Scuola dell'Infanzia<br>
                Messaggio generato automaticamente, non rispondere.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    if not SMTP_PASS:
        # Configurazione email mancante — logga le credenziali in chiaro (solo dev)
        logger.warning(
            "[EMAIL] EMAIL_PASSWORD non configurata. "
            "Credenziali per %s: email=%s password=%s",
            to_email, to_email, password,
        )
        return

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(
            None,
            partial(_send_sync, to_email, subject, html_body, plain_body),
        )
        logger.info("[EMAIL] Credenziali inviate con successo a %s", to_email)
    except Exception as exc:
        # L'errore email non blocca la registrazione, ma lo logghiamo
        logger.error("[EMAIL] Invio fallito a %s: %s", to_email, exc)
