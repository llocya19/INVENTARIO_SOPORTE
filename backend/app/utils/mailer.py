# app/utils/mailer.py
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

MAIL_HOST = os.getenv("MAIL_HOST", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))

MAIL_USER = os.getenv("MAIL_USERNAME") or os.getenv("MAIL_USER")
MAIL_PASS = os.getenv("MAIL_PASSWORD") or os.getenv("MAIL_PASS")

MAIL_FROM = os.getenv("MAIL_FROM") or os.getenv("FROM_EMAIL") or MAIL_USER
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "Soporte TI")
ADMIN_TO  = os.getenv("MAIL_ADMIN_TO") or os.getenv("ADMIN_EMAIL") or MAIL_FROM

def _build_message(subject: str, body: str, to: str, reply_to: str | None = None, cc: list[str] | None = None) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    # From con nombre amigable
    msg["From"] = formataddr((MAIL_FROM_NAME, MAIL_FROM))
    msg["To"] = to
    if cc:
        msg["Cc"] = ", ".join(cc)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    return msg

def send_mail_safe(
    subject: str,
    body: str,
    to: str | None = None,
    reply_to: str | None = None,
    cc: list[str] | None = None,
) -> bool:
    """
    Envía correo vía SMTP STARTTLS.
    - to: destinatario principal (si None -> ADMIN_TO)
    - reply_to: pondrá esa cabecera para que al responder se conteste a ese correo
    - cc: lista de copias
    Devuelve True si “parece” OK; False si falla (no interrumpe la app).
    """
    dest = to or ADMIN_TO
    if not (MAIL_HOST and MAIL_PORT and MAIL_USER and MAIL_PASS and MAIL_FROM and dest):
        print("[mailer] configuración SMTP incompleta; mensaje no enviado")
        return False

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(MAIL_HOST, MAIL_PORT, timeout=20) as s:
            s.ehlo()
            s.starttls(context=ctx)
            s.ehlo()
            s.login(MAIL_USER, MAIL_PASS)
            msg = _build_message(subject, body, dest, reply_to=reply_to, cc=cc)
            s.send_message(msg)
        return True
    except Exception as e:
        print(f"[mailer] error enviando correo: {e}")
        return False
