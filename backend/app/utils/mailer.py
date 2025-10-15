import os
import smtplib
import ssl
from email.message import EmailMessage

# Toma valores desde .env (acepta dos convenciones de nombres)
MAIL_HOST = os.getenv("MAIL_HOST", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))

MAIL_USER = os.getenv("MAIL_USERNAME") or os.getenv("MAIL_USER")
MAIL_PASS = os.getenv("MAIL_PASSWORD") or os.getenv("MAIL_PASS")

MAIL_FROM = os.getenv("MAIL_FROM") or os.getenv("FROM_EMAIL") or MAIL_USER
ADMIN_TO  = os.getenv("MAIL_ADMIN_TO") or os.getenv("ADMIN_EMAIL") or MAIL_FROM

def _build_message(subject: str, body: str, to: str, reply_to: str | None = None) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = MAIL_FROM
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    return msg

def send_mail_safe(subject: str, body: str, to: str | None = None, reply_to: str | None = None) -> bool:
    """Envía correo vía SMTP STARTTLS. Devuelve True si “parece” OK; False si falla (sin cortar el flujo)."""
    dest = to or ADMIN_TO
    if not (MAIL_HOST and MAIL_PORT and MAIL_USER and MAIL_PASS and MAIL_FROM and dest):
        # Falta configuración; no interrumpir la app
        print("[mailer] configuración SMTP incompleta; mensaje no enviado")
        return False

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(MAIL_HOST, MAIL_PORT, timeout=20) as s:
            s.ehlo()
            s.starttls(context=ctx)
            s.ehlo()
            s.login(MAIL_USER, MAIL_PASS)
            msg = _build_message(subject, body, dest, reply_to)
            s.send_message(msg)
        return True
    except Exception as e:
        # No rompas la petición HTTP; deja rastro en logs
        print(f"[mailer] error enviando correo: {e}")
        return False
