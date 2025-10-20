from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_admin
from app.models import user_model

bp = Blueprint("users", __name__, url_prefix="/api/users")

@bp.get("")
@require_auth
@require_admin
def list_users():
    q = request.args.get("q")
    rol = request.args.get("rol")  # e.g. PRACTICANTE
    users = user_model.list_users(request.claims["username"], q, rol)
    return jsonify({"items": users})

@bp.get("/<int:user_id>")
@require_auth
@require_admin
def get_user(user_id):
    u = user_model.get_user_by_id(request.claims["username"], user_id)
    if not u: return {"error":"No encontrado"}, 404
    return jsonify(u)

@bp.post("")
@require_auth
@require_admin
def create_user():
    d = request.get_json(force=True)
    username = (d.get("username") or "").strip()
    password = d.get("password") or ""
    rol = (d.get("rol") or "").strip().upper()
    area_id = d.get("area_id")

    if not username or not password or rol not in ("ADMIN","PRACTICANTE","USUARIO") or not area_id:
        return {"error":"Datos inválidos"}, 400

    new_id, err = user_model.create_user(request.claims["username"], username, password, rol, int(area_id))
    if err: return {"error": err}, 400
    return {"id": new_id, "username": username, "rol": rol, "area_id": int(area_id)}

@bp.patch("/<int:user_id>")
@require_auth
@require_admin
def update_user(user_id):
    d = request.get_json(force=True)
    allow = {"password","rol","area_id","activo"}
    data = {k: v for k, v in d.items() if k in allow}
    err = user_model.update_user(request.claims["username"], user_id, data)
    if err: return {"error": err}, 400
    return {"ok": True}

@bp.delete("/<int:user_id>")
@require_auth
@require_admin
def delete_user(user_id):
    err = user_model.delete_user(request.claims["username"], user_id)
    if err: return {"error": err}, 400
    return {"ok": True}
