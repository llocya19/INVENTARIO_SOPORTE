from flask import Blueprint
from app.core.security import require_roles
from app.db import get_conn
from app.utils.mailer import send_mail_safe

bp = Blueprint("debug_mail", __name__, url_prefix="/api/debug-mail")

@bp.post("/send-pending")
@require_roles(["ADMIN"])
def send_pending():
    sent = 0
    with get_conn("system") as (conn, cur):
        cur.execute("""
          SELECT n.notif_id, n.tipo, n.destinatario_usuario_id, n.subject, n.body,
                 u.usuario_email
          FROM inv.notificaciones n
          LEFT JOIN inv.usuarios u ON u.usuario_id = n.destinatario_usuario_id
          WHERE n.sent_at IS NULL
          ORDER BY n.created_at
          LIMIT 50
        """)
        rows = cur.fetchall()
        for notif_id, _tipo, _uid, subject, body, email in rows:
            if not email:
                continue
            if send_mail_safe(subject=subject, body=body, to=email):
                cur.execute("UPDATE inv.notificaciones SET sent_at=now() WHERE notif_id=%s", (notif_id,))
                sent += 1
    return {"ok": True, "sent": sent}
