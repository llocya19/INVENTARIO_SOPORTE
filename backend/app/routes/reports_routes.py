# backend/app/routes/reports_routes.py
from flask import Blueprint, jsonify, request
from app.core.security import require_auth
from app.db import get_conn

bp = Blueprint("reports", __name__, url_prefix="/api/reports")

@bp.get("/counts")
@require_auth
def counts():
    # Pasamos el username para auditoría (aunque sea solo lectura)
    with get_conn(request.claims["username"]) as (conn, cur):
        cur.execute("SELECT COUNT(*) FROM inv.areas")
        areas = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM inv.equipos")
        equipos = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM inv.items WHERE clase='COMPONENTE'")
        componentes = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM inv.items WHERE clase='PERIFERICO'")
        perifericos = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM inv.items WHERE estado='ALMACEN'")
        en_almacen = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM inv.items WHERE estado='EN_USO'")
        en_uso = cur.fetchone()[0]
    return jsonify({
        "areas": areas,
        "equipos": equipos,
        "componentes": componentes,
        "perifericos": perifericos,
        "en_almacen": en_almacen,
        "en_uso": en_uso
    })
