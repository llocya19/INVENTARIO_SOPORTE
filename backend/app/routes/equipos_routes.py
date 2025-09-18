# backend/app/routes/equipos_routes.py
from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_admin
from app.models.equipo_model import (
  list_area_equipos, create_equipo, get_equipo_detalle,
  assign_items, unassign_item, update_equipo_meta
)

bp = Blueprint("equipos", __name__, url_prefix="/api")

@bp.get("/areas/<int:area_id>/equipos")  # mantiene la URL que ya usa el front
@require_auth
def area_equipos(area_id: int):
  rows = list_area_equipos(request.claims["username"], area_id)
  return jsonify(rows)

@bp.post("/equipos")
@require_auth
@require_admin
def equipos_create():
  d = request.get_json(force=True)
  codigo = (d.get("codigo") or "").strip()
  nombre = (d.get("nombre") or "").strip()
  area_id = d.get("area_id")
  estado  = (d.get("estado") or "EN_USO").strip()
  usuario_final = d.get("usuario_final")
  if not codigo or not nombre or not area_id:
    return {"error":"codigo, nombre, area_id requeridos"}, 400
  eid = create_equipo(request.claims["username"], codigo, nombre, int(area_id), estado, usuario_final)
  return {"equipo_id": eid}

@bp.get("/equipos/<int:equipo_id>")
@require_auth
def equipos_detail(equipo_id: int):
  d = get_equipo_detalle(request.claims["username"], equipo_id)
  if not d: return {"error":"No encontrado"}, 404
  return jsonify(d)

@bp.post("/equipos/<int:equipo_id>/assign")
@require_auth
@require_admin
def equipos_assign(equipo_id: int):
  d = request.get_json(force=True)
  item_ids = d.get("item_ids") or []
  if not isinstance(item_ids, list) or not item_ids:
    return {"error":"item_ids[] requerido"}, 400
  assign_items(request.claims["username"], equipo_id, [int(i) for i in item_ids])
  return {"ok": True}

@bp.post("/equipos/<int:equipo_id>/unassign")
@require_auth
@require_admin
def equipos_unassign(equipo_id: int):
  d = request.get_json(force=True)
  item_id = d.get("item_id")
  if not item_id: return {"error":"item_id requerido"}, 400
  unassign_item(request.claims["username"], equipo_id, int(item_id))
  return {"ok": True}

@bp.patch("/equipos/<int:equipo_id>")
@require_auth
@require_admin
def equipos_update(equipo_id: int):
  d = request.get_json(force=True)
  update_equipo_meta(
    request.claims["username"],
    equipo_id,
    nombre = d.get("nombre"),
    estado = d.get("estado"),
    usuario_final = d.get("usuario_final")
  )
  return {"ok": True}
