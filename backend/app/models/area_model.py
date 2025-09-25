# app/models/area_model.py
from typing import Optional, Any, List, Dict
from app.db import get_conn

# -------------------------
# Lecturas básicas de áreas
# -------------------------

def list_areas(app_user: Optional[str]):
    SQL = """
    SELECT area_id, area_nombre, area_padre_id
    FROM inv.areas
    ORDER BY COALESCE(area_padre_id, 0), lower(area_nombre)
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL)
        rows = cur.fetchall()
    return [{"id": r[0], "nombre": r[1], "padre_id": r[2]} for r in rows]


def list_root_areas(app_user: Optional[str]):
    with get_conn(app_user) as (conn, cur):
        cur.execute("""
            SELECT area_id, area_nombre
            FROM inv.areas
            WHERE area_padre_id IS NULL
            ORDER BY lower(area_nombre)
        """)
        rows = cur.fetchall()
    return [{"id": r[0], "nombre": r[1]} for r in rows]


def list_area_items(
    app_user: str,
    area_id: int,
    clase: Optional[str],
    estado: Optional[str],
    page: int = 1,
    size: int = 10,
    tipo_nombre: Optional[str] = None,
    fecha_desde: Optional[str] = None,  # 'YYYY-MM-DD'
    fecha_hasta: Optional[str] = None,  # 'YYYY-MM-DD'
):
    p = max(1, int(page or 1))
    s = min(100, max(1, int(size or 10)))
    off = (p - 1) * s

    base_sql = """
      SELECT
        v.item_id,
        v.item_codigo,
        v.clase,
        v.tipo,
        v.estado,
        v.created_at,
        e.equipo_id,
        e.equipo_codigo,
        e.equipo_nombre,
        v.ficha,
        COUNT(*) OVER() AS total_rows
      FROM inv.vw_items_con_ficha_y_fotos v
      LEFT JOIN inv.equipo_items ei ON ei.item_id = v.item_id
      LEFT JOIN inv.equipos      e  ON e.equipo_id = ei.equipo_id
      WHERE v.area_id = %s
    """
    params = [area_id]

    if clase:
        base_sql += " AND v.clase = %s"
        params.append(clase)

    if estado:
        base_sql += " AND v.estado = %s"
        params.append(estado)

    if tipo_nombre:
        base_sql += " AND lower(v.tipo) = lower(%s)"
        params.append(tipo_nombre)

    if fecha_desde:
        base_sql += " AND v.created_at::date >= %s::date"
        params.append(fecha_desde)

    if fecha_hasta:
        base_sql += " AND v.created_at::date <= %s::date"
        params.append(fecha_hasta)

    base_sql += """
      ORDER BY
        CASE v.estado WHEN 'EN_USO' THEN 0 ELSE 1 END,
        lower(v.tipo),
        v.item_codigo
      LIMIT %s OFFSET %s
    """
    params.extend([s, off])

    with get_conn(app_user) as (conn, cur):
        cur.execute(base_sql, params)
        rows = cur.fetchall()

    items = []
    total = 0
    for r in rows:
        total = r[10]
        items.append({
            "item_id": r[0],
            "item_codigo": r[1],
            "clase": r[2],
            "tipo": r[3],
            "estado": r[4],
            "created_at": r[5],
            "equipo": None if r[6] is None else {
                "equipo_id": r[6],
                "equipo_codigo": r[7],
                "equipo_nombre": r[8],
            },
            "ficha": r[9] or {},
        })

    return {"items": items, "total": int(total or 0), "page": p, "size": s}


# -----------------------------------------
# Equipos (paginado + filtros para la vista del área)
# -----------------------------------------
def list_area_equipos_paged(
    app_user: str,
    area_id: int,
    estado: Optional[str],
    q: Optional[str],
    fdesde: Optional[str],
    fhasta: Optional[str],
    page: int = 1,
    size: int = 10,
    orden: Optional[str] = None,
) -> Dict[str, Any]:
    from app.models.equipo_model import list_area_equipos_paged as _inner
    return _inner(app_user, area_id, estado, q, fdesde, fhasta, page, size, orden)


# -----------------------------------------
# Altas
# -----------------------------------------

def create_root_area(app_user: str, nombre: str) -> int:
    with get_conn(app_user) as (conn, cur):
        area_id = None
        cur.execute("CALL inv.sp_area_upsert_any(%s, %s, %s)", (area_id, nombre, None))
        cur.execute("""
          SELECT area_id FROM inv.areas
          WHERE area_padre_id IS NULL AND lower(area_nombre)=lower(%s)
          ORDER BY area_id DESC LIMIT 1
        """, (nombre,))
        row = cur.fetchone()
    return int(row[0])


def create_sub_area(app_user: str, nombre: str, padre_id: int) -> int:
    with get_conn(app_user) as (conn, cur):
        area_id = None
        cur.execute("CALL inv.sp_area_upsert_any(%s, %s, %s)", (area_id, nombre, padre_id))
        cur.execute("""
          SELECT area_id FROM inv.areas
          WHERE area_padre_id IS NOT DISTINCT FROM %s
            AND lower(area_nombre)=lower(%s)
          ORDER BY area_id DESC LIMIT 1
        """, (padre_id, nombre))
        row = cur.fetchone()
    return int(row[0])


def get_area_info(app_user: str, area_id: int):
    with get_conn(app_user) as (conn, cur):
        cur.execute("SELECT area_id, area_nombre, area_padre_id FROM inv.areas WHERE area_id=%s", (area_id,))
        a = cur.fetchone()
        if not a:
            return None
        area = {"id": a[0], "nombre": a[1], "padre_id": a[2]}

        cur.execute("""
        WITH RECURSIVE anc AS (
          SELECT area_id, area_nombre, area_padre_id
          FROM inv.areas WHERE area_id=%s
          UNION ALL
          SELECT p.area_id, p.area_nombre, p.area_padre_id
          FROM inv.areas p
          JOIN anc ON anc.area_padre_id = p.area_id
        )
        SELECT area_id, area_nombre, area_padre_id
        FROM anc WHERE area_id <> %s
        """, (area_id, area_id))
        rows = cur.fetchall()
        ancestors = [{"id": r[0], "nombre": r[1], "padre_id": r[2]} for r in rows][::-1]

        cur.execute("""
          SELECT area_id, area_nombre FROM inv.areas
          WHERE area_padre_id = %s
          ORDER BY lower(area_nombre)
        """, (area_id,))
        children = [{"id": r[0], "nombre": r[1]} for r in cur.fetchall()]

    return {"area": area, "ancestors": ancestors, "children": children}
