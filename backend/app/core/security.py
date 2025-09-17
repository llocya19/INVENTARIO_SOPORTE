# backend/app/core/security.py
import os, time, functools
import jwt
from flask import request, jsonify

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_EXP_SECONDS = int(os.getenv("JWT_EXP_SECONDS", "21600"))  # 6h

def make_token(payload: dict) -> str:
    data = dict(payload)
    # Aseguramos que 'sub' sea string (PyJWT exige str para 'sub')
    if "sub" in data:
        data["sub"] = str(data["sub"])
    data["exp"] = int(time.time()) + JWT_EXP_SECONDS
    return jwt.encode(data, JWT_SECRET, algorithm="HS256")

def decode_token_from_request():
    h = request.headers.get("Authorization", "")
    if not h.startswith("Bearer "):
        raise ValueError("Falta Bearer token")
    tok = h.split(" ", 1)[1].strip()
    # Puedes quitar options si ya emites sub como string
    return jwt.decode(tok, JWT_SECRET, algorithms=["HS256"])

def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            claims = decode_token_from_request()
        except Exception as e:
            # print("AUTH ERROR:", e)  # útil para debug
            return jsonify({"error": f"Token inválido: {e}"}), 401
        request.claims = claims
        return fn(*args, **kwargs)
    return wrapper

def require_admin(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        claims = getattr(request, "claims", {})
        if claims.get("rol") != "ADMIN":
            return jsonify({"error": "Solo ADMIN"}), 403
        return fn(*args, **kwargs)
    return wrapper
