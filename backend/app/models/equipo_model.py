# backend/app/models/equipo_model.py
from typing import List, Dict, Any, Optional, Tuple
from app.db import get_conn

# ---------------------------------------------------
# Listado de equipos en un área
# ---------------------------------------------------
def list_area_equipos(app_user: str, area_id: int) -> List[Dict[str, Any]]:
    """
    Lista equipos del área con created_at/updated_at.
    Columnas usadas: equipo_id, equipo_codigo, equipo_nombre, equipo_area_id,
                     equipo_estado, equipo_usuario_final, created_at, updated_at
    """
    SQL = """
    SELECT
      e.equipo_id,
      e.equipo_codigo,
      e.equipo_nombre,
      e.equipo_estado,
      e.equipo_usuario_final,
      e.created_at,
      e.updated_at
    FROM inv.equipos e
    WHERE e.equipo_area_id = %s
    ORDER BY lower(e.equipo_codigo), e.equipo_id
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, (area_id,))
        rows = cur.fetchall()
    out = []
    for r in rows:
        out.append({
            "equipo_id": r[0],
            "equipo_codigo": r[1],
            "equipo_nombre": r[2],
            "estado": r[3],
            "usuario_final": r[4],
            "created_at": r[5],
            "updated_at": r[6],
        })
    return out


# ---------------------------------------------------
# Detalle de un equipo (cabecera)
# ---------------------------------------------------
def get_equipo_header(app_user: str, equipo_id: int) -> Optional[Dict[str, Any]]:
    """
    Trae la cabecera del equipo.
    Columnas usadas: equipo_id, equipo_codigo, equipo_nombre, equipo_area_id,
                     equipo_estado, equipo_usuario_final, equipo_login, equipo_password,
                     created_at, updated_at
    """
    SQL = """
      SELECT
        e.equipo_id,
        e.equipo_codigo,
        e.equipo_nombre,
        e.equipo_area_id AS area_id,
        e.equipo_estado,
        e.equipo_usuario_final,
        e.equipo_login,
        e.equipo_password,
        e.created_at,
        e.updated_at
      FROM inv.equipos e
      WHERE e.equipo_id=%s
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, (equipo_id,))
        r = cur.fetchone()
        if not r:
            return None
    return {
        "equipo_id": r[0],
        "equipo_codigo": r[1],
        "equipo_nombre": r[2],
        "area_id": r[3],
        "estado": r[4],
        "usuario_final": r[5],
        "login": r[6],
        "password": r[7],
        "created_at": r[8],
        "updated_at": r[9],
    }


# ---------------------------------------------------
# Detalle de un equipo (cabecera + items asignados)
# ---------------------------------------------------
def get_equipo_detalle(app_user: str, equipo_id: int) -> Optional[Dict[str, Any]]:
    """
    Devuelve equipo + items asignados (con clase, tipo, codigo, estado) para mostrar y gestionar.
    """
    header = get_equipo_header(app_user, equipo_id)
    if not header:
        return None

    SQL = """
      SELECT i.item_id, i.item_codigo, it.clase, it.nombre AS tipo, i.estado
      FROM inv.equipo_items ei
      JOIN inv.items i       ON i.item_id = ei.item_id
      JOIN inv.item_tipos it ON it.item_tipo_id = i.item_tipo_id
      WHERE ei.equipo_id = %s
      ORDER BY CASE WHEN it.clase='COMPONENTE' THEN 0 ELSE 1 END,
               lower(it.nombre), lower(i.item_codigo)
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, (equipo_id,))
        rows = cur.fetchall()

    items = []
    for r in rows:
        items.append({
            "item_id": r[0],
            "item_codigo": r[1],
            "clase": r[2],
            "tipo": r[3],
            "estado": r[4],
        })
    header["items"] = items
    return header


# ---------------------------------------------------
# Ítems disponibles (ALMACEN) por área con paginación/filtro
# ---------------------------------------------------
def list_items_disponibles(
    app_user: str,
    area_id: int,
    clase: str,               # COMPONENTE | PERIFERICO
    page: int = 1,
    size: int = 10,
    tipo_nombre: Optional[str] = None,
    q: Optional[str] = None,  # busca en item_codigo
) -> Dict[str, Any]:
    p = max(1, int(page or 1))
    s = min(100, max(1, int(size or 10)))
    off = (p - 1) * s

    SQL = """
      SELECT
        v.item_id,
        v.item_codigo,
        v.clase,
        v.tipo,
        v.estado,
        v.created_at,
        COUNT(*) OVER() AS total_rows
      FROM inv.vw_items_con_ficha_y_fotos v
      WHERE v.area_id = %s
        AND v.clase   = %s
        AND v.estado  = 'ALMACEN'
    """
    params = [area_id, clase]

    if tipo_nombre:
        SQL += " AND lower(v.tipo) = lower(%s)"
        params.append(tipo_nombre)

    if q:
        SQL += " AND v.item_codigo ILIKE %s"
        params.append(f"%{q}%")

    SQL += """
      ORDER BY lower(v.tipo), v.item_codigo
      LIMIT %s OFFSET %s
    """
    params.extend([s, off])

    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, params)
        rows = cur.fetchall()

    total = 0
    items = []
    for r in rows:
        total = r[6]
        items.append({
            "item_id": r[0],
            "item_codigo": r[1],
            "clase": r[2],
            "tipo": r[3],
            "estado": r[4],
            "created_at": r[5],
        })

    return {"items": items, "total": int(total or 0), "page": p, "size": s}


# ---------------------------------------------------
# Crear equipo + asignar items (usa SP de negocio si está disponible)
# ---------------------------------------------------
def create_equipo_con_items(
    app_user: str,
    area_id: int,
    codigo: str,
    nombre: str,
    estado: str,
    usuario_final: Optional[str],
    login: Optional[str],
    password: Optional[str],
    items: List[Dict[str, Any]],   # [{item_id, slot}]
) -> Tuple[Optional[int], Optional[str]]:
    """
    Crea un equipo y asigna items del área (solo ALMACEN).
    Se intenta usar inv.sp_asignar_item_a_equipo(equipo_id, item_id, slot);
    si no existe, hace inserción directa + UPDATE estado y registra movimiento básico.
    """
    with get_conn(app_user) as (conn, cur):
        # crear cabecera
        try:
            cur.execute("""
              INSERT INTO inv.equipos (
                equipo_codigo, equipo_nombre, equipo_area_id,
                equipo_estado, equipo_usuario_final, equipo_login, equipo_password
              )
              VALUES (%s,%s,%s,%s,%s,%s,%s)
              RETURNING equipo_id
            """, (codigo, nombre, area_id, estado, usuario_final, login, password))
        except Exception as e:
            return None, f"No se pudo crear el equipo: {e}"

        equipo_id = int(cur.fetchone()[0])

        # asignar items
        for it in items:
            item_id = int(it.get("item_id"))
            slot = it.get("slot")

            # Validaciones mínimas
            cur.execute("SELECT area_id, estado FROM inv.items WHERE item_id=%s", (item_id,))
            r = cur.fetchone()
            if not r:
                return None, f"Item {item_id} no existe"
            if r[0] != area_id:
                return None, f"Item {item_id} pertenece a otra área"
            if r[1] != "ALMACEN":
                return None, f"Item {item_id} no está en ALMACEN (actual={r[1]})"

            # Intentar SP de negocio (si existe)
            try:
                cur.execute("SELECT 1 FROM pg_proc WHERE proname='sp_asignar_item_a_equipo' AND pronamespace = 'inv'::regnamespace")
                exists = cur.fetchone() is not None
            except Exception:
                exists = False

            if exists:
                cur.execute("CALL inv.sp_asignar_item_a_equipo(%s,%s,%s)", (equipo_id, item_id, slot))
            else:
                # fallback directo: puente + estado
                cur.execute("""
                    INSERT INTO inv.equipo_items(equipo_id, item_id, slot_o_ubicacion)
                    VALUES (%s,%s,%s)
                """, (equipo_id, item_id, slot))
                cur.execute("""
                    UPDATE inv.items
                       SET estado='EN_USO', updated_at = NOW()
                     WHERE item_id=%s
                """, (item_id,))
                # movimiento mínimo
                cur.execute("""
                  INSERT INTO inv.movimientos(
                    mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
                    mov_equipo_id, mov_usuario_app, mov_detalle
                  ) VALUES (
                    %s, 'ASIGNACION', %s, %s, %s, current_setting('app.user', true), %s
                  )
                """, (item_id, area_id, area_id, equipo_id, None if slot is None else {'slot': slot}))

        return equipo_id, None


# ---------------------------------------------------
# Quitar un item del equipo (opcional para edición)
# ---------------------------------------------------
def unassign_item(app_user: str, equipo_id: int, item_id: int) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("DELETE FROM inv.equipo_items WHERE equipo_id=%s AND item_id=%s RETURNING 1",
                    (equipo_id, item_id))
        if not cur.fetchone():
            return "El item no estaba asignado"
        cur.execute("UPDATE inv.items SET estado='ALMACEN', updated_at = NOW() WHERE item_id=%s", (item_id,))
        # movimiento
        cur.execute("""
          INSERT INTO inv.movimientos(
            mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
            mov_equipo_id, mov_usuario_app, mov_motivo
          ) SELECT %s, 'RETIRO', e.equipo_area_id, e.equipo_area_id, %s, current_setting('app.user', true), %s
            FROM inv.equipos e WHERE e.equipo_id=%s
        """, (item_id, equipo_id, None, equipo_id))
    return None


# ---------------------------------------------------
# Editar metadatos del equipo
# ---------------------------------------------------
def update_equipo_meta(
    app_user: str,
    equipo_id: int,
    nombre: Optional[str] = None,
    estado: Optional[str] = None,
    usuario_final: Optional[str] = None,
    login: Optional[str] = None,
    password: Optional[str] = None,
) -> Optional[str]:
    pieces = []
    params: List[Any] = []
    if nombre is not None:
        pieces.append("equipo_nombre=%s"); params.append(nombre)
    if estado is not None:
        pieces.append("equipo_estado=%s"); params.append(estado)
    if usuario_final is not None:
        pieces.append("equipo_usuario_final=%s"); params.append(usuario_final)
    if login is not None:
        pieces.append("equipo_login=%s"); params.append(login)
    if password is not None:
        pieces.append("equipo_password=%s"); params.append(password)
    if not pieces:
        return None
    sql = "UPDATE inv.equipos SET " + ", ".join(pieces) + ", updated_at=NOW() WHERE equipo_id=%s"
    params.append(equipo_id)
    with get_conn(app_user) as (conn, cur):
        cur.execute(sql, params)
    return None
