# backend/app/routes/profile_routes.py
from flask import Blueprint, request
from app.core.security import require_auth
from app.db import get_conn
from app.utils.mailer import send_mail_safe

# 👇 ESTE nombre debe ser exactamente "bp"
bp = Blueprint("profile", __name__, url_prefix="/api/profile")


@bp.get("")
@require_auth
def get_profile():
    """
    Devuelve username, rol (del JWT) y email (desde BD).
    """
    username = request.claims["username"]
    rol = request.claims.get("rol")

    email = None
    try:
        with get_conn(username) as (conn, cur):
            cur.execute(
                "SELECT usuario_email FROM inv.usuarios WHERE usuario_username=%s",
                (username,),
            )
            row = cur.fetchone()
            email = row[0] if row and row[0] else None
    except Exception:
        email = None

    return {"username": username, "rol": rol, "email": email}


@bp.patch("")
@require_auth
def set_email():
    """
    Actualiza el email del usuario logueado.
    Maneja la violación de unicidad (uq_usuarios_email_ci) devolviendo 400.
    """
    d = request.get_json(force=True) or {}
    email = (d.get("email") or "").strip()
    if not email or "@" not in email:
        return {"error": "email inválido"}, 400

    username = request.claims["username"]

    try:
        with get_conn(username) as (conn, cur):
            cur.execute(
                """
                UPDATE inv.usuarios
                   SET usuario_email=%s, usuario_actualizado_en=now()
                 WHERE usuario_username=current_setting('app.user', true)
                """,
                (email,),
            )
        return {"ok": True, "email": email}
    except Exception as e:
        # índice único case-insensitive sobre email
        if "uq_usuarios_email_ci" in str(e):
            return {"error": "Ese correo ya está registrado para otro usuario."}, 400
        # cualquier otro error
        return {"error": f"No se pudo actualizar el email: {e}"}, 500


@bp.post("/send-test")
@require_auth
def send_test_mail():
    """
    Envía un correo de prueba al email del perfil (si existe).
    Si no hay email, no falla pero avisa.
    """
    username = request.claims["username"]

    # leemos el email actual del usuario
    email = None
    with get_conn(username) as (conn, cur):
        cur.execute(
            "SELECT usuario_email FROM inv.usuarios WHERE usuario_username=%s",
            (username,),
        )
        row = cur.fetchone()
        email = row[0] if row and row[0] else None

    if not email:
        return {"error": "Aún no has configurado tu email en el perfil."}, 400

    ok = send_mail_safe(
        subject="Prueba de correo • Inventario / Soporte TI",
        body=f"Hola {username},\n\nEste es un correo de prueba.\n\nSaludos.",
        to=email,
    )
    return {"ok": bool(ok)}
