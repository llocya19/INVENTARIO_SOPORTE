# app/routes/profile_routes.py
from flask import Blueprint, request
from app.core.security import require_auth
from app.db import get_conn
from app.utils.mailer import send_mail_safe

bp = Blueprint("profile", __name__, url_prefix="/api/me")

@bp.patch("/email")
@require_auth
def set_email():
    d = request.get_json(force=True) or {}
    email = (d.get("email") or "").strip()
    if not email or "@" not in email:
        return {"error": "email inválido"}, 400
    # Ajusta a tu tabla real de usuarios (auth.usuarios, por ejemplo).
    with get_conn(request.claims["username"]) as (conn, cur):
        cur.execute("""
          UPDATE auth.usuarios
             SET email=%s, updated_at=NOW()
           WHERE username=current_setting('app.user', true)
        """, (email,))
    return {"ok": True, "email": email}

@bp.post("/email-admin")
@require_auth
def email_admin():
    d = request.get_json(force=True) or {}
    asunto = (d.get("asunto") or "").strip()
    cuerpo = (d.get("cuerpo") or "").strip()
    if not asunto or not cuerpo:
        return {"error": "asunto y cuerpo requeridos"}, 400

    # opcional: guarda también como incidencia
    # (si no quieres esto, elimina el bloque try/except)
    try:
        from app.models.incidencia_model import create_incidencia
        inc_id = create_incidencia(request.claims["username"], asunto, cuerpo, None)
        asunto = f"[INCIDENCIA #{inc_id}] {asunto}"
    except Exception:
        pass

    send_mail_safe(subject=asunto, body=f"De: {request.claims['username']}\n\n{cuerpo}")
    return {"ok": True}
