# app/routes/debug_mail_routes.py
from flask import Blueprint, request
from app.core.security import require_auth, require_roles
from app.utils.mailer import send_mail_safe

bp = Blueprint("debug_mail", __name__, url_prefix="/api/_debug")

@bp.post("/test-mail")
@require_auth
@require_roles(["ADMIN"])
def test_mail():
    d = request.get_json(silent=True) or {}
    to = (d.get("to") or "").strip() or None
    subject = d.get("subject") or "Prueba de correo"
    body = d.get("body") or "Este es un mensaje de prueba desde inventario."
    ok, err = send_mail_safe(subject, body, to_addr=to)
    if not ok:
        return {"ok": False, "error": err}, 500
    return {"ok": True}
