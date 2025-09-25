from flask import Blueprint, jsonify, request
from app.core.security import require_auth, require_admin
from app.models.area_model import (
    list_areas, list_root_areas, list_area_items,
    create_root_area, create_sub_area, get_area_info
)

bp = Blueprint("areas", __name__, url_prefix="/api/areas")

@bp.get("")
@require_auth
def get_areas():
    return jsonify(list_areas(request.claims["username"]))

@bp.get("/roots")
@require_auth
def get_roots():
    return jsonify(list_root_areas(request.claims["username"]))

@bp.get("/<int:area_id>/items")
@require_auth
def get_area_items(area_id: int):
    clase = request.args.get("clase")           # COMPONENTE | PERIFERICO | None
    estado = request.args.get("estado")         # ALMACEN | EN_USO | ...
    page  = request.args.get("page", type=int, default=1)
    size  = request.args.get("size", type=int, default=10)
    tipo  = request.args.get("tipo")            # nombre del tipo (p.ej. DISCO)
    fdes  = request.args.get("desde")           # YYYY-MM-DD
    fhas  = request.args.get("hasta")           # YYYY-MM-DD

    data = list_area_items(
        request.claims["username"],
        area_id, clase, estado, page, size, tipo, fdes, fhas
    )
    return jsonify(data)

# ⚠️ IMPORTANTE: eliminamos el endpoint duplicado de equipos aquí
# @bp.get("/<int:area_id>/equipos")  ← eliminado

@bp.get("/<int:area_id>/info")
@require_auth
def area_info(area_id: int):
    info = get_area_info(request.claims["username"], area_id)
    if not info:
        return {"error": "Área no encontrada"}, 404
    return jsonify(info)

@bp.post("/root")
@require_auth
@require_admin
def create_root():
    d = request.get_json(force=True)
    nombre = (d.get("nombre") or "").strip()
    if not nombre:
        return {"error": "Nombre requerido"}, 400
    new_id = create_root_area(request.claims["username"], nombre)
    return {"id": new_id, "nombre": nombre}

@bp.post("/sub")
@require_auth
@require_admin
def create_sub():
    d = request.get_json(force=True)
    nombre = (d.get("nombre") or "").strip()
    padre_id = d.get("padre_id")
    if not nombre or not padre_id:
        return {"error": "Nombre y padre_id requeridos"}, 400
    new_id = create_sub_area(request.claims["username"], nombre, int(padre_id))
    return {"id": new_id, "nombre": nombre, "padre_id": int(padre_id)}
