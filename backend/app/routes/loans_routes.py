# app/routes/loans_routes.py
from __future__ import annotations
from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_roles
from app.models.item_model import prestar_item, devolver_item

bp = Blueprint("loans", __name__, url_prefix="/api")

# =========================
# PRESTAR ÍTEM A UN ÁREA
# =========================
@bp.post("/items/<int:item_id>/prestar")
@require_auth
@require_roles(["ADMIN", "PRACTICANTE"])
def prestar_item_route(item_id: int):
    """
    Body JSON:
    {
      "destino_area_id": <int>,
      "detalle": { ... }  // opcional (p.ej: {"equipo_id": 123, "comentario": "..."}
    }
    """
    data = request.get_json(force=True)
    destino_area_id = data.get("destino_area_id")
    detalle = data.get("detalle") or {}

    if not destino_area_id:
        return {"error": "destino_area_id es requerido"}, 400

    err = prestar_item(
        request.claims["username"],
        item_id=item_id,
        destino_area_id=int(destino_area_id),
        detalle=detalle,
    )
    if err:
        return {"error": err}, 400

    return {"ok": True}

# =========================
# DEVOLVER ÍTEM (CERRAR PRÉSTAMO)
# =========================
@bp.post("/items/<int:item_id>/devolver")
@require_auth
@require_roles(["ADMIN", "PRACTICANTE"])
def devolver_item_route(item_id: int):
    """
    Cierra préstamo abierto (si existe) y deja el ítem en ALMACEN.
    """
    err = devolver_item(request.claims["username"], item_id)
    if err:
        return {"error": err}, 400
    return {"ok": True}
