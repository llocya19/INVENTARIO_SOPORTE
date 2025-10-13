from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_roles
from app.models.spec_model import get_attrs_for_type, define_attr

bp = Blueprint("spec", __name__, url_prefix="/api/spec")

@bp.get("/attrs")
@require_auth
def attrs_for_type():
    clase = (request.args.get("clase") or "").upper()
    tipo = (request.args.get("tipo") or "").strip()
    if clase not in ("COMPONENTE","PERIFERICO") or not tipo:
        return {"error":"Parámetros inválidos"}, 400
    return jsonify(get_attrs_for_type(request.claims["username"], clase, tipo))

@bp.post("/attrs")
@require_auth
@require_roles(["ADMIN", "PRACTICANTE"])
def create_attr():
    d = request.get_json(force=True)
    clase = (d.get("clase") or "").upper()
    tipo = (d.get("tipo_nombre") or "").strip()
    nombre_attr = (d.get("nombre_attr") or "").strip()
    data_type = (d.get("data_type") or "").lower()

    if clase not in ("COMPONENTE","PERIFERICO") or not tipo or not nombre_attr:
        return {"error":"Datos inválidos"}, 400
    if data_type not in ("text","int","numeric","bool","date"):
        return {"error":"data_type inválido"}, 400

    define_attr(request.claims["username"], clase, tipo, nombre_attr, data_type)
    return {"ok": True}
