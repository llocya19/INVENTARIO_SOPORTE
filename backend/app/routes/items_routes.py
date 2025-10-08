# app/routes/items_routes.py
from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_admin, require_roles
from app.models.item_model import (
    list_item_types, create_item_type, create_item_with_specs, get_item_detail,
    upsert_attribute_and_value, add_photo, suggest_next_code
)
from app.models.area_model import get_area_info  # por si quieres validar que exista

bp = Blueprint("items", __name__, url_prefix="/api")

# =========================
# Tipos
# =========================
@bp.get("/item-types")
@require_auth
def item_types():
    clase = request.args.get("clase")
    return jsonify(list_item_types(request.claims["username"], clase))

@bp.post("/item-types")
@require_auth
@require_roles(["ADMIN", "PRACTICANTE"])
def create_item_type_route():
    d = request.get_json(force=True)
    clase = (d.get("clase") or "").strip().upper()
    nombre = (d.get("nombre") or "").strip()
    if clase not in ("COMPONENTE", "PERIFERICO") or not nombre:
        return {"error": "clase y nombre requeridos"}, 400
    tid = create_item_type(request.claims["username"], clase, nombre)
    return {"id": tid, "clase": clase, "nombre": nombre}

# =========================
# Crear ítem EN subárea
# =========================
@bp.post("/items")
@require_auth
@require_roles(["ADMIN", "PRACTICANTE"])
def create_item():
    d = request.get_json(force=True)
    codigo  = (d.get("codigo") or "").strip()
    clase   = (d.get("clase") or "").strip().upper()
    tipo    = (d.get("tipo_nombre") or "").strip()
    area_id = d.get("area_id")
    specs   = d.get("specs") or {}
    if not codigo or not clase or not tipo or not area_id:
        return {"error": "Datos requeridos: codigo, clase, tipo_nombre, area_id"}, 400

    # Validación opcional de existencia del área (incluye subáreas)
    info = get_area_info(request.claims["username"], int(area_id))
    if not info:
        return {"error": "Área no encontrada"}, 404

    try:
        item_id = create_item_with_specs(
            request.claims["username"], codigo, clase, tipo, int(area_id), specs
        )
        return {"item_id": item_id}
    except Exception as e:
        return {"error": str(e)}, 400

# =========================
# Detalle
# =========================
@bp.get("/items/<int:item_id>")
@require_auth
def item_detail(item_id: int):
    data = get_item_detail(request.claims["username"], item_id)
    if not data:
        return {"error": "No encontrado"}, 404
    return jsonify(data)

# =========================
# Specs (upsert)
# =========================
@bp.post("/items/<int:item_id>/specs")
@require_auth
@require_roles(["ADMIN", "PRACTICANTE"])
def item_upsert_spec(item_id: int):
    d = request.get_json(force=True)
    nombre_attr = (d.get("attr") or "").strip()
    data_type   = (d.get("data_type") or "").strip()
    value       = d.get("value")
    clase       = (d.get("clase") or "").strip().upper()
    tipo_nombre = (d.get("tipo_nombre") or "").strip()
    if not all([nombre_attr, data_type, clase, tipo_nombre]):
        return {"error": "attr, data_type, clase, tipo_nombre requeridos"}, 400
    err = upsert_attribute_and_value(
        request.claims["username"], item_id, clase, tipo_nombre, nombre_attr, data_type, value
    )
    if err:
        return {"error": err}, 400
    return {"ok": True}

# =========================
# Fotos
# =========================
@bp.post("/items/<int:item_id>/photos")
@require_auth
@require_roles(["ADMIN", "PRACTICANTE"])
def item_add_photo(item_id: int):
    d = request.get_json(force=True)
    url = (d.get("url") or "").strip()
    principal = bool(d.get("principal")) if d.get("principal") is not None else False
    orden = d.get("orden")
    if not url:
        return {"error": "url requerida"}, 400
    err = add_photo(request.claims["username"], item_id, url, principal, orden)
    if err:
        return {"error": err}, 400
    return {"ok": True}

# =========================
# Siguiente código sugerido
# =========================
@bp.get("/items/next-code")
@require_auth
def next_code():
    clase = (request.args.get("clase") or "").upper()
    tipo  = (request.args.get("tipo") or "")
    area_id = request.args.get("area_id")
    if not clase or not tipo or not area_id:
        return {"error": "clase, tipo, area_id requeridos"}, 400
    code = suggest_next_code(request.claims["username"], clase, tipo, int(area_id))
    return {"next_code": code}
