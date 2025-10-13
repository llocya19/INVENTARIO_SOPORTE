# app/models/area_model.py
from typing import Optional, Any, Dict, List
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
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
):
    """
    Devuelve:
      A) Ítems propios del área (v.area_id = area_id). Si están EN_USO_PRESTADO,
         arma 'prestamo_text' = 'a {destino} · PC-xxx' y puede_devolver = TRUE.
      B) Ítems prestados que este área está usando (estado PRESTAMO) detectados por
         equipos.equipo_area_id = area_id (destino). Arma 'prestamo_text' = 'de {origen} · PC-xxx'.
    """
    p = max(1, int(page or 1))
    s = min(100, max(1, int(size or 10)))
    off = (p - 1) * s

    filtros: List[str] = []
    params_common: List[Any] = []

    if clase:
        filtros.append("v.clase = %s")
        params_common.append(clase)

    if estado:
        filtros.append("v.estado = %s")
        params_common.append(estado)

    if tipo_nombre:
        filtros.append("lower(v.tipo) = lower(%s)")
        params_common.append(tipo_nombre)

    if fecha_desde:
        filtros.append("v.created_at::date >= %s::date")
        params_common.append(fecha_desde)

    if fecha_hasta:
        filtros.append("v.created_at::date <= %s::date")
        params_common.append(fecha_hasta)

    where_extra = (" AND " + " AND ".join(filtros)) if filtros else ""

    select_cols = """
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
      ao.area_id   AS origen_area_id,
      ao.area_nombre AS origen_area_nombre,
      ea.area_id   AS destino_area_id,
      ea.area_nombre AS destino_area_nombre
    """

    # 🔧 FIX: usar e.equipo_area_id (no existe e.area_id)
    from_joins = """
      FROM inv.vw_items_con_ficha_y_fotos v
      LEFT JOIN inv.equipo_items ei ON ei.item_id = v.item_id
      LEFT JOIN inv.equipos      e  ON e.equipo_id = ei.equipo_id
      LEFT JOIN inv.areas ao ON ao.area_id = v.area_id                -- dueño del ítem
      LEFT JOIN inv.areas ea ON ea.area_id = e.equipo_area_id         -- área del equipo (destino)
    """

    # A) Ítems propios del área
    sql_propios = f"""
      SELECT
        {select_cols},
        FALSE AS es_prestamo_recibido,
        CASE
          WHEN v.estado = 'EN_USO_PRESTADO' THEN
            CONCAT(
              'a ',
              COALESCE(ea.area_nombre, 'otra área'),
              COALESCE(CONCAT(' · ', e.equipo_codigo), '')
            )
          ELSE NULL
        END AS prestamo_text,
        CASE
          WHEN v.estado = 'EN_USO_PRESTADO' AND v.area_id = %s THEN TRUE
          ELSE FALSE
        END AS puede_devolver
      {from_joins}
      WHERE v.area_id = %s
      {where_extra}
    """
    params_propios = [area_id, area_id] + params_common

    # B) Ítems prestados que este área está usando
    # 🔧 FIX: condición por destino usando e.equipo_area_id
    sql_recibidos = f"""
      SELECT
        {select_cols},
        TRUE AS es_prestamo_recibido,
        CASE
          WHEN v.estado = 'PRESTAMO' THEN
            CONCAT(
              'de ',
              COALESCE(ao.area_nombre, 'otra área'),
              COALESCE(CONCAT(' · ', e.equipo_codigo), '')
            )
          ELSE NULL
        END AS prestamo_text,
        FALSE AS puede_devolver
      {from_joins}
      WHERE v.estado = 'PRESTAMO'
        AND e.equipo_area_id = %s
        AND v.area_id <> %s
      {where_extra}
    """
    params_recibidos = [area_id, area_id] + params_common

    sql_union = f"""
      WITH u AS (
        {sql_propios}
        UNION ALL
        {sql_recibidos}
      )
      SELECT
        *,
        COUNT(*) OVER() AS total_rows
      FROM u
      ORDER BY
        CASE estado
          WHEN 'EN_USO' THEN 0
          WHEN 'EN_USO_PRESTADO' THEN 1
          WHEN 'PRESTAMO' THEN 2
          ELSE 9
        END,
        lower(tipo),
        item_codigo
      LIMIT %s OFFSET %s
    """
    params = params_propios + params_recibidos + [s, off]

    with get_conn(app_user) as (conn, cur):
        cur.execute(sql_union, params)
        rows = cur.fetchall()

    IDX = {
        "item_id": 0, "item_codigo": 1, "clase": 2, "tipo": 3, "estado": 4, "created_at": 5,
        "equipo_id": 6, "equipo_codigo": 7, "equipo_nombre": 8, "ficha": 9,
        "origen_area_id":10, "origen_area_nombre":11, "destino_area_id":12, "destino_area_nombre":13,
        "es_prestamo_recibido":14, "prestamo_text":15, "puede_devolver":16, "total_rows":17
    }

    items: List[Dict[str, Any]] = []
    total = 0
    for r in rows:
        total = r[IDX["total_rows"]]
        items.append({
            "item_id": r[IDX["item_id"]],
            "item_codigo": r[IDX["item_codigo"]],
            "clase": r[IDX["clase"]],
            "tipo": r[IDX["tipo"]],
            "estado": r[IDX["estado"]],
            "created_at": r[IDX["created_at"]],
            "equipo": None if r[IDX["equipo_id"]] is None else {
                "equipo_id": r[IDX["equipo_id"]],
                "equipo_codigo": r[IDX["equipo_codigo"]],
                "equipo_nombre": r[IDX["equipo_nombre"]],
            },
            "ficha": r[IDX["ficha"]] or {},
            "prestamo_text": r[IDX["prestamo_text"]],
            "puede_devolver": bool(r[IDX["puede_devolver"]]),
            "es_prestamo_recibido": bool(r[IDX["es_prestamo_recibido"]]),
        })

    return {"items": items, "total": int(total or 0), "page": p, "size": s}


# -----------------------------------------
# Equipos (proxy al model de equipos)
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
    # Si no usas este proxy, puedes borrarlo. Lo dejo intacto por compatibilidad.
    from app.models.equipo_model import list_area_equipos_paged as _inner
    return _inner(app_user, area_id, estado, fdesde, fhasta, page, size)


# -----------------------------------------
# Altas de áreas
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
