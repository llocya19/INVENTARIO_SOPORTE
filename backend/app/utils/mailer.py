# backend/app/utils/mailer.py
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from typing import Iterable, Optional, Dict, Any

MAIL_HOST = os.getenv("MAIL_HOST", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))

MAIL_USER = os.getenv("MAIL_USERNAME") or os.getenv("MAIL_USER")
MAIL_PASS = os.getenv("MAIL_PASSWORD") or os.getenv("MAIL_PASS")

MAIL_FROM = os.getenv("MAIL_FROM") or os.getenv("FROM_EMAIL") or MAIL_USER
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "Soporte TI")

# Destinatario por defecto (admin)
ADMIN_TO  = os.getenv("MAIL_ADMIN_TO") or os.getenv("ADMIN_EMAIL") or MAIL_FROM

def _is_valid_email(s: Optional[str]) -> bool:
    if not s:
        return False
    s = s.strip()
    return "@" in s and "." in s and " " not in s and "<" not in s and ">" not in s

def _as_list(addr: Optional[Iterable[str] | str]) -> list[str]:
    if not addr:
        return []
    if isinstance(addr, str):
        return [addr]
    return [a for a in addr if a]

def _build_message(
    subject: str,
    body: str,
    to: Iterable[str],
    *,
    reply_to: Optional[str] = None,
    cc: Optional[Iterable[str]] = None,
    bcc: Optional[Iterable[str]] = None,
    from_name_extra: Optional[str] = None,
    extra_headers: Optional[Dict[str, Any]] = None,
) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject

    # From con nombre amigable (opcionalmente añade “(reportado por X)”)
    from_display = MAIL_FROM_NAME
    if from_name_extra:
        from_display = f"{MAIL_FROM_NAME} ({from_name_extra})"
    msg["From"] = formataddr((from_display, MAIL_FROM))

    to_list = _as_list(to)
    cc_list = _as_list(cc)
    bcc_list = _as_list(bcc)

    if to_list:
        msg["To"] = ", ".join(to_list)
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)

    # Reply-To (clave para que al responder vaya al correo del usuario)
    if _is_valid_email(reply_to):
        msg["Reply-To"] = reply_to

    # Cabeceras extra (útiles en Gmail “mostrar detalles”)
    if extra_headers:
        for k, v in extra_headers.items():
            if v is not None:
                msg[k] = str(v)

    msg.set_content(body)

    # Guardamos BCC para usarlo al enviar (no se añade header)
    if bcc_list:
        msg._bcc = bcc_list  # type: ignore[attr-defined]

    return msg

def send_mail_safe(
    subject: str,
    body: str,
    to: Optional[Iterable[str] | str] = None,
    *,
    reply_to: Optional[str] = None,
    cc: Optional[Iterable[str] | str] = None,
    bcc: Optional[Iterable[str] | str] = None,
    from_name_extra: Optional[str] = None,
    extra_headers: Optional[Dict[str, Any]] = None,
    enrich_subject_with_reporter: Optional[str] = None,  # ej. username
) -> bool:
    """
    Envía correo vía SMTP STARTTLS.
      - to: destinatarios principales (si None -> ADMIN_TO)
      - reply_to: correo al que se responderá (usuario reportante)
      - cc / bcc: copias
      - from_name_extra: añade “(reportado por X)” al nombre del remitente
      - extra_headers: cabeceras personalizadas
      - enrich_subject_with_reporter: añade “ · por <username>” al asunto

    Devuelve True si parece OK; False si falla (no interrumpe la app).
    """
    dest = _as_list(to) or _as_list(ADMIN_TO)
    cc_list = _as_list(cc)
    bcc_list = _as_list(bcc)

    if enrich_subject_with_reporter:
        subject = f"{subject} · por {enrich_subject_with_reporter}"

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

            msg = _build_message(
                subject=subject,
                body=body,
                to=dest,
                reply_to=reply_to,
                cc=cc_list,
                bcc=bcc_list,
                from_name_extra=from_name_extra,
                extra_headers=extra_headers,
            )

            all_rcpt = dest + cc_list + getattr(msg, "_bcc", [])
            s.send_message(msg, from_addr=MAIL_FROM, to_addrs=all_rcpt)
        return True
    except Exception as e:
        print(f"[mailer] error enviando correo: {e}")
        return False
