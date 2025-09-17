# backend/app/routes/auth_routes.py
from flask import Blueprint, request, jsonify
from app.models.user_model import login_and_check
from app.core.security import make_token, require_auth

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@bp.post("/login")
def login():
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "Usuario/clave requeridos"}), 400

    user, err = login_and_check(username, password)
    if err:
        if err in ("Usuario no existe", "Contraseña incorrecta"):
            return jsonify({"error": err}), 401
        else:
            return jsonify({"error": err}), 403

    token = make_token({
        "sub": user["id"],
        "username": user["username"],
        "rol": user["rol"],
        "area_id": user["area_id"],
    })
    return jsonify({"token": token, "user": user})

@bp.get("/me")
@require_auth
def me():
    return jsonify(request.claims)
