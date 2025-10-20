from typing import List, Tuple
from app.db import get_conn
from app.utils.mailer import send_mail_safe

def send_pending_notifs(app_user: str = "system") -> Tuple[int, List[int]]:
    """
    Envía correos pendientes en inv.notificaciones (sent_at IS NULL).
    Devuelve (enviadas, ids).
    """
    sent_ids: List[int] = []
    with get_conn(app_user) as (conn, cur):
        cur.execute("""
            SELECT n.notif_id, n.subject, n.body, u.usuario_email
            FROM inv.notificaciones n
            LEFT JOIN inv.usuarios u ON u.usuario_id = n.destinatario_usuario_id
            WHERE n.sent_at IS NULL
              AND COALESCE(u.usuario_email,'') <> ''
            ORDER BY n.notif_id
            LIMIT 100
        """)
        rows = cur.fetchall()

        for notif_id, subject, body, email in rows:
            ok = False
            try:
                ok = send_mail_safe(subject=subject, body=body, to=email)
            except Exception:
                ok = False
            if ok:
                sent_ids.append(notif_id)

        if sent_ids:
            cur.execute(
                "UPDATE inv.notificaciones SET sent_at = now() WHERE notif_id = ANY(%s)",
                (sent_ids,)
            )

    return (len(sent_ids), sent_ids)
