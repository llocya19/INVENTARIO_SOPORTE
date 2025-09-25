# backend/app/routes/equipos_routes.py
from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_admin
from app.models.equipo_model import (
    list_area_equipos,
    list_area_equipos_paged,
    get_equipo_detalle,
    list_items_disponibles,
    create_equipo_con_items,
    assign_item_to_equipo,
    unassign_item,
    update_equipo_meta,
)

bp = Blueprint("equipos", __name__, url_prefix="/api")

@bp.get("/equipos/<int:equipo_id>")
@require_auth
def equipo_detalle(equipo_id: int):
    data = get_equipo_detalle(request.claims["username"], equipo_id)
    if not data:
        return {"error": "No encontrado"}, 404
    return jsonify(data)


@bp.get("/areas/<int:area_id>/equipos")
@require_auth
def equipos_de_area(area_id: int):
    # filtros y paginación (opcionales)
    estado = request.args.get("estado")
    fdes = request.args.get("desde")
    fhas = request.args.get("hasta")
    page = request.args.get("page", type=int, default=1)
    size = request.args.get("size", type=int, default=10)

    # Si quieres forzar siempre paginado, deja esto así:
    data = list_area_equipos_paged(
        request.claims["username"], area_id, estado, fdes, fhas, page, size
    )
    return jsonify(data)

    # Si en algún momento quieres devolver el listado simple cuando no haya filtros,
    # sustituye lo anterior por:
    # if not estado and not fdes and not fhas and page == 1 and size == 10:
    #     return jsonify(list_area_equipos(request.claims["username"], area_id))
    # else:
    #     data = list_area_equipos_paged(
    #         request.claims["username"], area_id, estado, fdes, fhas, page, size
    #     )
    #     return jsonify(data)


@bp.get("/areas/<int:area_id>/items-disponibles")
@bp.get("/areas/<int:area_id>/items_disponibles")
@require_auth
def items_disponibles(area_id: int):
    clase = (request.args.get("clase") or "").upper()
    if clase not in ("COMPONENTE", "PERIFERICO"):
        return {"error": "clase inválida"}, 400
    page = request.args.get("page", type=int, default=1)
    size = request.args.get("size", type=int, default=10)
    tipo = request.args.get("tipo")
    q = request.args.get("q")
    data = list_items_disponibles(request.claims["username"], area_id, clase, page, size, tipo, q)
    return jsonify(data)


@bp.post("/areas/<int:area_id>/equipos")
@require_auth
@require_admin
def crear_equipo(area_id: int):
    d = request.get_json(force=True)
    codigo = (d.get("codigo") or "").strip()
    nombre = (d.get("nombre") or "").strip()
    estado = (d.get("estado") or "USO").strip().upper()
    usuario_final = (d.get("usuario_final") or "").strip() or None
    login = (d.get("login") or "").strip() or None
    password = (d.get("password") or "").strip() or None
    items = d.get("items") or []

    if not codigo or not nombre:
        return {"error": "codigo y nombre son requeridos"}, 400

    equipo_id, err = create_equipo_con_items(
        request.claims["username"], area_id, codigo, nombre, estado,
        usuario_final, login, password, items
    )
    if err:
        return {"error": err}, 400
    return {"equipo_id": equipo_id}


# --------- ASIGNAR ÍTEM A EQUIPO (para flujo "nuevo en uso") ----------
@bp.post("/equipos/<int:equipo_id>/items")
@require_auth
@require_admin
def asignar_item(equipo_id: int):
    d = request.get_json(force=True)
    item_id = d.get("item_id")
    slot = d.get("slot")
    if not item_id:
        return {"error": "item_id es requerido"}, 400

    ok, err = assign_item_to_equipo(request.claims["username"], equipo_id, int(item_id), slot)
    if err or not ok:
        return {"error": err or "No se pudo asignar"}, 400
    return {"ok": True}


@bp.delete("/equipos/<int:equipo_id>/items/<int:item_id>")
@require_auth
@require_admin
def retirar_item(equipo_id: int, item_id: int):
    err = unassign_item(request.claims["username"], equipo_id, item_id)
    if err:
        return {"error": err}, 400
    return {"ok": True}


@bp.patch("/equipos/<int:equipo_id>")
@require_auth
@require_admin
def editar_equipo(equipo_id: int):
    d = request.get_json(force=True)
    err = update_equipo_meta(
        request.claims["username"],
        equipo_id,
        nombre=d.get("equipo_nombre"),
        estado=d.get("equipo_estado"),
        usuario_final=d.get("equipo_usuario_final"),
        login=d.get("equipo_login"),
        password=d.get("equipo_password"),
    )
    if err:
        return {"error": err}, 400
    return {"ok": True}
