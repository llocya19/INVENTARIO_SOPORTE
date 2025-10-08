# app/routes/mov_routes.py
from flask import Blueprint, request, jsonify
from app.core.security import require_auth
from app.models.mov_model import list_auditoria_flexible

bp = Blueprint("mov", __name__, url_prefix="/api")

@bp.get("/movimientos")
@require_auth
def movimientos_list():
    page  = request.args.get("page", type=int, default=1)
    size  = request.args.get("size", type=int, default=20)

    # Acepta ?fuente=mov|audit|both o ?scope=...
    raw_fuente = request.args.get("fuente") or request.args.get("scope") or "mov"
    fuente = {"mov": "MOV", "audit": "AUDIT", "both": "MIX"}.get(str(raw_fuente).lower(), "MOV")

    tipo  = request.args.get("tipo")
    desde = request.args.get("desde")
    hasta = request.args.get("hasta")
    q     = request.args.get("q")
    item_id   = request.args.get("item_id", type=int)
    equipo_id = request.args.get("equipo_id", type=int)
    area_id   = request.args.get("area_id", type=int)

    data = list_auditoria_flexible(
        request.claims["username"],
        fuente=fuente,
        page=page, size=size,
        tipo=tipo, desde=desde, hasta=hasta, q=q,
        item_id=item_id, equipo_id=equipo_id, area_id=area_id
    )
    return jsonify(data)
