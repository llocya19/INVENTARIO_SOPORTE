# backend/app/models/area_model.py
from typing import Optional
from app.db import get_conn

# -------------------------
# Lecturas básicas de áreas
# -------------------------

def list_areas(app_user: Optional[str]):
    """
    Lista todas las áreas (raíz y subáreas).
    """
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
    """
    Lista solo áreas raíz (sin padre).
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute("""
            SELECT area_id, area_nombre
            FROM inv.areas
            WHERE area_padre_id IS NULL
            ORDER BY lower(area_nombre)
        """)
        rows = cur.fetchall()
    return [{"id": r[0], "nombre": r[1]} for r in rows]


def list_area_items(app_user: str, area_id: int, clase: Optional[str], estado: Optional[str]):
    """
    Lista ítems en ALMACEN por área (usa la vista vw_items_en_almacen).
    Puedes filtrar por clase (COMPONENTE | PERIFERICO) y estado.
    """
    base_sql = """
      SELECT item_id, item_codigo, clase, tipo, estado
      FROM inv.vw_items_en_almacen
      WHERE area_id = %s
    """
    params = [area_id]
    if clase:
        base_sql += " AND clase = %s"
        params.append(clase)
    if estado:
        base_sql += " AND estado = %s"
        params.append(estado)
    base_sql += " ORDER BY lower(tipo), item_codigo"

    with get_conn(app_user) as (conn, cur):
        cur.execute(base_sql, params)
        rows = cur.fetchall()

    return [
        {"item_id": r[0], "item_codigo": r[1], "clase": r[2], "tipo": r[3], "estado": r[4]}
        for r in rows
    ]


def list_area_equipos(app_user: str, area_id: int):
    """
    Lista equipos de un área.
    """
    SQL = """
    SELECT e.equipo_id, e.equipo_codigo, e.equipo_nombre, e.equipo_estado, e.equipo_usuario_final
    FROM inv.equipos e
    WHERE e.equipo_area_id = %s
    ORDER BY e.equipo_codigo
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, (area_id,))
        rows = cur.fetchall()

    return [{
        "equipo_id": r[0],
        "equipo_codigo": r[1],
        "equipo_nombre": r[2],
        "estado": r[3],
        "usuario_final": r[4],
    } for r in rows]

# -----------------------------------------
# Altas con SP flexible (raíz o cualquier padre)
# -----------------------------------------

def create_root_area(app_user: str, nombre: str) -> int:
    """
    Crea (o asegura) un área raíz con ese nombre usando inv.sp_area_upsert_any.
    """
    with get_conn(app_user) as (conn, cur):
        area_id = None
        cur.execute("CALL inv.sp_area_upsert_any(%s, %s, %s)", (area_id, nombre, None))
        # recuperamos id (por si el INOUT no vuelve populado)
        cur.execute("""
          SELECT area_id FROM inv.areas
          WHERE area_padre_id IS NULL AND lower(area_nombre)=lower(%s)
          ORDER BY area_id DESC LIMIT 1
        """, (nombre,))
        row = cur.fetchone()
    return int(row[0])


def create_sub_area(app_user: str, nombre: str, padre_id: int) -> int:
    """
    Crea (o asegura) una subárea bajo padre_id (padre puede ser raíz o subárea).
    """
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
    """
    Información de un área: datos, cadena de ancestros (hasta la raíz) y subáreas directas.
    """
    with get_conn(app_user) as (conn, cur):
        # área actual
        cur.execute("SELECT area_id, area_nombre, area_padre_id FROM inv.areas WHERE area_id=%s", (area_id,))
        a = cur.fetchone()
        if not a:
            return None
        area = {"id": a[0], "nombre": a[1], "padre_id": a[2]}

        # ancestros (padre -> ... -> raíz) con CTE recursivo
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
        ancestors = [{"id": r[0], "nombre": r[1], "padre_id": r[2]} for r in rows][::-1]  # raíz -> hoja

        # hijos directos
        cur.execute("""
          SELECT area_id, area_nombre FROM inv.areas
          WHERE area_padre_id = %s
          ORDER BY lower(area_nombre)
        """, (area_id,))
        children = [{"id": r[0], "nombre": r[1]} for r in cur.fetchall()]

    return {"area": area, "ancestors": ancestors, "children": children}
