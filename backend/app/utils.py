from functools import wraps
from flask import request, jsonify

def json_ok(data=None, **extra):
    out = {"ok": True}
    if data is not None:
        out["data"] = data
    out.update(extra)
    return jsonify(out)

def json_error(status: int, message: str, **extra):
    out = {"ok": False, "error": message}
    out.update(extra)
    return jsonify(out), status

def require_app_user(fn):
    """Exige header X-App-User (la BD lo requiere para guards/auditoría)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = request.headers.get("X-App-User", "").strip()
        if not user:
            return json_error(400, "Header 'X-App-User' es requerido (ej: admin).")
        return fn(*args, **kwargs)
    return wrapper
