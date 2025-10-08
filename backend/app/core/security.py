# backend/app/core/security.py
import os, time, functools
import jwt
from flask import request, jsonify

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_EXP_SECONDS = int(os.getenv("JWT_EXP_SECONDS", "21600"))  # 6h

def make_token(payload: dict) -> str:
    data = dict(payload)
    if "sub" in data:
        data["sub"] = str(data["sub"])
    data["exp"] = int(time.time()) + JWT_EXP_SECONDS
    return jwt.encode(data, JWT_SECRET, algorithm="HS256")

def decode_token_from_request():
    h = request.headers.get("Authorization", "")
    if not h.startswith("Bearer "):
        raise ValueError("Falta Bearer token")
    tok = h.split(" ", 1)[1].strip()
    return jwt.decode(tok, JWT_SECRET, algorithms=["HS256"])

def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            claims = decode_token_from_request()
        except Exception as e:
            return jsonify({"error": f"Token inválido: {e}"}), 401
        request.claims = claims
        return fn(*args, **kwargs)
    return wrapper

# ⬇️ NUEVO: decorador para permitir una lista de roles
def require_roles(roles: list[str]):
    allowed = {r.upper() for r in roles}

    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            claims = getattr(request, "claims", None)
            if not claims:
                # permite usarlo sin require_auth explícito
                try:
                    claims = decode_token_from_request()
                    request.claims = claims
                except Exception as e:
                    return jsonify({"error": f"Token inválido: {e}"}), 401
            rol = (claims.get("rol") or "").upper()
            if rol not in allowed:
                return jsonify({"error": f"Acceso denegado. Requiere rol: {', '.join(sorted(allowed))}"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return deco

# Mantén compatibilidad con el decorador actual
def require_admin(fn):
    return require_roles(["ADMIN"])(fn)
