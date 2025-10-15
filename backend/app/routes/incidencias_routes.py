# app/routes/incidencias_routes.py
from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_roles
from app.models.incidencia_model import (
    create_incidencia, list_incidencias, get_incidencia,
    add_mensaje, asignar_incidencia, set_estado
)
from app.utils.mailer import send_mail_safe

bp = Blueprint("incidencias", __name__, url_prefix="/api/incidencias")

# Crear (cualquier autenticado)
@bp.post("")
@require_auth
def crear():
    d = request.get_json(force=True) or {}
    titulo = (d.get("titulo") or "").strip()
    descripcion = (d.get("descripcion") or "").strip()
    equipo_id = d.get("equipo_id")
    email = (d.get("email") or d.get("reportado_email") or "").strip()

    if not titulo or not descripcion:
        return {"error": "titulo y descripcion requeridos"}, 400

    inc_id, err = create_incidencia(
        request.claims["username"],
        titulo, descripcion,
        int(equipo_id) if equipo_id else None,
        email or None,
    )
    if err:
        return {"error": err}, 400

    # Notifica por correo al administrador (no bloquea)
    try:
        send_mail_safe(
            subject=f"[INCIDENCIA #{inc_id}] {titulo}",
            body=f"Reportado por: {request.claims['username']}\nEmail: {email or 'no provisto'}\n\n{descripcion}",
            reply_to=email or None,
        )
    except Exception:
        pass

    return {"incidencia_id": inc_id}

# Listar
@bp.get("")
@require_auth
def listar():
    estado = request.args.get("estado")
    page = request.args.get("page", type=int, default=1)
    size = request.args.get("size", type=int, default=10)
    q = request.args.get("q")
    area_id = request.args.get("area_id", type=int)

    # 👇 usamos 'rol' (string) del token
    role = (request.claims.get("rol") or "").upper()
    is_staff = role in ("ADMIN", "PRACTICANTE")
    mine = not is_staff  # usuarios finales: sólo propias

    data = list_incidencias(
        request.claims["username"],
        mine=mine, estado=estado,
        page=page, size=size,
        q=q, area_id=area_id,
    )
    return jsonify(data)

# Detalle
@bp.get("/<int:incidencia_id>")
@require_auth
def detalle(incidencia_id: int):
    data = get_incidencia(request.claims["username"], incidencia_id)
    if not data:
        return {"error": "No encontrado"}, 404
    return jsonify(data)

# Mensaje en el hilo
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

# Asignar (sólo admin)
@bp.patch("/<int:incidencia_id>/asignar")
@require_roles(["ADMIN"])
def asignar(incidencia_id: int):
    d = request.get_json(force=True) or {}
    username = (d.get("username") or "").strip()
    if not username:
        return {"error": "username requerido"}, 400
    err = asignar_incidencia(request.claims["username"], incidencia_id, username)
    if err:
        return {"error": err}, 400
    return {"ok": True}

# Cambiar estado (admin o practicante)
@bp.patch("/<int:incidencia_id>")
@require_roles(["ADMIN", "PRACTICANTE"])
def estado(incidencia_id: int):
    d = request.get_json(force=True) or {}
    estado = (d.get("estado") or "").strip()
    err = set_estado(request.claims["username"], incidencia_id, estado)
    if err:
        return {"error": err}, 400
    return {"ok": True}
