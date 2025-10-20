# backend/app/routes/incidencias_routes.py
from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_roles
from app.models.incidencia_model import (
    create_incidencia, list_incidencias, get_incidencia,
    add_mensaje, asignar_incidencia, set_estado
)
from app.utils.mailer import send_mail_safe
from app.db import get_conn  # 👈 para consultar correos en la BD

bp = Blueprint("incidencias", __name__, url_prefix="/api/incidencias")


# -------------------------------------------------
# Crear (cualquier autenticado)
# -------------------------------------------------
@bp.post("")
@require_auth
def crear():
    d = request.get_json(force=True) or {}
    titulo = (d.get("titulo") or "").strip()
    descripcion = (d.get("descripcion") or "").strip()
    equipo_id = d.get("equipo_id")
    email_form = (d.get("email") or d.get("reportado_email") or "").strip()

    if not titulo or not descripcion:
        return {"error": "titulo y descripcion requeridos"}, 400

    # Fallback: si el form no trae email, usamos el de su perfil
    username = request.claims["username"]
    email_db = ""
    try:
        with get_conn(username) as (conn, cur):
            cur.execute("""
                SELECT usuario_email
                  FROM inv.usuarios
                 WHERE usuario_username=%s
            """, (username,))
            row = cur.fetchone()
            email_db = (row[0] or "").strip() if row else ""
    except Exception:
        email_db = ""

    email_effective = email_form or email_db

    # Crear incidencia (guardamos email en reportado_nombre si existe)
    inc_id, err = create_incidencia(
        username,
        titulo,
        descripcion,
        int(equipo_id) if equipo_id else None,
        email_effective or None,
    )
    if err:
        return {"error": err}, 400

    # Notifica al administrador
    body_lines = [
        f"Incidencia #{inc_id}",
        f"Título: {titulo}",
        "Descripción:",
        descripcion,
        "",
        f"Reportado por: {username}",
        f"Email: {email_effective or 'no provisto'}",
    ]
    try:
        send_mail_safe(
            subject=f"[INCIDENCIA #{inc_id}] {titulo}",
            body="\n".join(body_lines),
            reply_to=email_effective or None,  # 👈 para que el admin pueda responder al usuario
        )
    except Exception:
        pass

    return {"incidencia_id": inc_id}


# -------------------------------------------------
# Listar
# - ADMIN / PRACTICANTE: listado general (tu modelo actual)
# - USUARIO: sólo propias (mine=True)
# -------------------------------------------------
@bp.get("")
@require_auth
def listar():
    estado = request.args.get("estado")
    page = request.args.get("page", type=int, default=1)
    size = request.args.get("size", type=int, default=10)
    q = request.args.get("q")
    area_id = request.args.get("area_id", type=int)

    role = (request.claims.get("rol") or "").upper()
    mine = (role == "USUARIO")  # usuarios finales: sólo sus incidencias

    data = list_incidencias(
        request.claims["username"],
        mine=mine,
        estado=estado,
        page=page,
        size=size,
        q=q,
        area_id=area_id,
    )
    return jsonify(data)


# -------------------------------------------------
# Detalle
# -------------------------------------------------
@bp.get("/<int:incidencia_id>")
@require_auth
def detalle(incidencia_id: int):
    data = get_incidencia(request.claims["username"], incidencia_id)
    if not data:
        return {"error": "No encontrado"}, 404
    return jsonify(data)


# -------------------------------------------------
# Mensaje en el hilo
# -------------------------------------------------
@bp.post("/<int:incidencia_id>/mensajes")
@require_auth
def mensaje(incidencia_id: int):
    d = request.get_json(force=True) or {}
    cuerpo = (d.get("cuerpo") or "").strip()
    if not cuerpo:
        return {"error": "cuerpo requerido"}, 400
    err = add_mensaje(request.claims["username"], incidencia_id, cuerpo)
    if err:
        return {"error": err}, 400
    return {"ok": True}


# -------------------------------------------------
# Asignar (sólo admin) + notificación por correo
# -------------------------------------------------
@bp.patch("/<int:incidencia_id>/asignar")
@require_roles(["ADMIN"])
def asignar(incidencia_id: int):
    d = request.get_json(force=True) or {}
    username = (d.get("username") or "").strip()  # 👈 nombre de usuario a asignar
    if not username:
        return {"error": "username requerido"}, 400

    err = asignar_incidencia(request.claims["username"], incidencia_id, username)
    if err:
        return {"error": err}, 400

    # Intentar notificar por correo
    try:
        # Datos incidencia (título, descripción…)
        inc = get_incidencia(request.claims["username"], incidencia_id) or {}

        # Correo del practicante asignado
        pract_email = ""
        reporter_email = ""
        with get_conn(request.claims["username"]) as (conn, cur):
            cur.execute("""
                SELECT usuario_email
                  FROM inv.usuarios
                 WHERE usuario_username=%s
            """, (username,))
            r1 = cur.fetchone()
            pract_email = (r1[0] or "").strip() if r1 else ""

            # correo del reportante de la incidencia
            if inc.get("usuario"):
                cur.execute("""
                    SELECT usuario_email
                      FROM inv.usuarios
                     WHERE usuario_username=%s
                """, (inc["usuario"],))
                r2 = cur.fetchone()
                reporter_email = (r2[0] or "").strip() if r2 else ""

        subj = f"[INCIDENCIA #{incidencia_id}] Asignada a {username}"
        body = "\n".join([
            f"Incidencia #{incidencia_id} asignada a: {username}",
            f"Título: {inc.get('titulo','')}",
            "",
            f"Descripción:",
            f"{inc.get('descripcion','')}",
        ])

        # Al practicante (si tenemos email)
        if pract_email:
            send_mail_safe(subject=subj, body=body, to=pract_email)

        # Al reportante (si tenemos email)
        if reporter_email:
            send_mail_safe(
                subject=f"[INCIDENCIA #{incidencia_id}] Tu caso fue asignado",
                body="\n".join([
                    f"Tu incidencia #{incidencia_id} fue asignada a: {username}.",
                    f"Título: {inc.get('titulo','')}",
                    "", "Te contactaremos por esta vía cuando haya novedades."
                ]),
                to=reporter_email
            )
    except Exception:
        # no bloquear por falla de correo
        pass

    return {"ok": True}


# -------------------------------------------------
# Cambiar estado (admin o practicante; reglas en el modelo)
# -------------------------------------------------
@bp.patch("/<int:incidencia_id>")
@require_roles(["ADMIN", "PRACTICANTE"])
def estado(incidencia_id: int):
    d = request.get_json(force=True) or {}
    estado = (d.get("estado") or "").strip()
    err = set_estado(request.claims["username"], incidencia_id, estado)
    if err:
        return {"error": err}, 400
    return {"ok": True}
