# backend/app/models/equipo_model.py
from typing import List, Dict, Any, Optional, Tuple
from app.db import get_conn

# ---------------------------------------------------
# Listado simple (compatibilidad)
# ---------------------------------------------------
def list_area_equipos(app_user: str, area_id: int) -> List[Dict[str, Any]]:
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
    out: List[Dict[str, Any]] = []
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
# Listado con filtros y paginación
# ---------------------------------------------------
def list_area_equipos_paged(
    app_user: str,
    area_id: int,
    estado: Optional[str] = None,      # USO | ALMACEN | ... | None (todos)
    fecha_desde: Optional[str] = None, # 'YYYY-MM-DD'
    fecha_hasta: Optional[str] = None, # 'YYYY-MM-DD'
    page: int = 1,
    size: int = 10,
) -> Dict[str, Any]:
    p = max(1, int(page or 1))
    s = min(100, max(1, int(size or 10)))
    off = (p - 1) * s

    sql = """
      SELECT
        e.equipo_id,
        e.equipo_codigo,
        e.equipo_nombre,
        e.equipo_estado,
        e.equipo_usuario_final,
        e.created_at,
        e.updated_at,
        COUNT(*) OVER() AS total_rows
      FROM inv.equipos e
      WHERE e.equipo_area_id = %s
    """
    params: List[Any] = [area_id]

    if estado and estado.upper() != "TODOS":
        sql += " AND e.equipo_estado = %s"
        params.append(estado.upper())

    if fecha_desde:
        sql += " AND e.created_at::date >= %s::date"
        params.append(fecha_desde)

    if fecha_hasta:
        sql += " AND e.created_at::date <= %s::date"
        params.append(fecha_hasta)

    sql += """
      ORDER BY e.created_at DESC, lower(e.equipo_codigo)
      LIMIT %s OFFSET %s
    """
    params.extend([s, off])

    with get_conn(app_user) as (conn, cur):
        cur.execute(sql, params)
        rows = cur.fetchall()

    total = 0
    items: List[Dict[str, Any]] = []
    for r in rows:
        total = r[7]
        items.append({
            "equipo_id": r[0],
            "equipo_codigo": r[1],
            "equipo_nombre": r[2],
            "estado": r[3],
            "usuario_final": r[4],
            "created_at": r[5],
            "updated_at": r[6],
        })
    return {"items": items, "total": int(total or 0), "page": p, "size": s}


# ---------------------------------------------------
# Detalle
# ---------------------------------------------------
def get_equipo_header(app_user: str, equipo_id: int) -> Optional[Dict[str, Any]]:
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


def get_equipo_detalle(app_user: str, equipo_id: int) -> Optional[Dict[str, Any]]:
    SQL = """
      SELECT i.item_id, i.item_codigo, it.clase, it.nombre AS tipo, i.estado
      FROM inv.equipo_items ei
      JOIN inv.items i       ON i.item_id = ei.item_id
      JOIN inv.item_tipos it ON it.item_tipo_id = i.item_tipo_id
      WHERE ei.equipo_id = %s
      ORDER BY CASE WHEN it.clase='COMPONENTE' THEN 0 ELSE 1 END,
               lower(it.nombre), lower(i.item_codigo)
    """
    header = get_equipo_header(app_user, equipo_id)
    if not header:
        return None
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
# Ítems disponibles (para "desde almacén")
# ---------------------------------------------------
def list_items_disponibles(
    app_user: str,
    area_id: int,
    clase: str,
    page: int = 1,
    size: int = 10,
    tipo_nombre: Optional[str] = None,
    q: Optional[str] = None,
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
# Crear equipo (con items preexistentes opcional)
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
    items: List[Dict[str, Any]],
) -> Tuple[Optional[int], Optional[str]]:
    with get_conn(app_user) as (conn, cur):
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

        for it in items:
            item_id = int(it.get("item_id"))
            slot = it.get("slot")

            cur.execute("SELECT area_id, estado FROM inv.items WHERE item_id=%s", (item_id,))
            r = cur.fetchone()
            if not r:
                return None, f"Item {item_id} no existe"
            if r[0] != area_id:
                return None, f"Item {item_id} pertenece a otra área"
            if r[1] != "ALMACEN":
                return None, f"Item {item_id} no está en ALMACEN (actual={r[1]})"

            # ¿Existe SP?
            try:
                cur.execute("""
                  SELECT 1
                    FROM pg_proc
                   WHERE proname='sp_asignar_item_a_equipo'
                     AND pronamespace = 'inv'::regnamespace
                """)
                exists = cur.fetchone() is not None
            except Exception:
                exists = False

            if exists:
                cur.execute("CALL inv.sp_asignar_item_a_equipo(%s,%s,%s)", (equipo_id, item_id, slot))
            else:
                cur.execute("""
                    INSERT INTO inv.equipo_items(equipo_id, item_id, slot_o_ubicacion)
                    VALUES (%s,%s,%s)
                """, (equipo_id, item_id, slot))
                cur.execute("UPDATE inv.items SET estado='EN_USO' WHERE item_id=%s", (item_id,))
                cur.execute("""
                  INSERT INTO inv.movimientos(
                    mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
                    mov_equipo_id, mov_usuario_app, mov_detalle
                  ) VALUES (
                    %s, 'ASIGNACION', %s, %s, %s,
                    current_setting('app.user', true),
                    %s
                  )
                """, (item_id, area_id, area_id, equipo_id, None if slot is None else {'slot': slot}))

        return equipo_id, None


# ---------------------------------------------------
# Asignar item a equipo (para /api/equipos/<id>/items)
# ---------------------------------------------------
def assign_item_to_equipo(
    app_user: str,
    equipo_id: int,
    item_id: int,
    slot: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Asigna item -> equipo usando PK compuesta (equipo_id, item_id).
    No usa columna 'updated_at' en inv.items.
    """
    with get_conn(app_user) as (conn, cur):
        # 1) Validar equipo y obtener su área
        cur.execute("SELECT equipo_area_id FROM inv.equipos WHERE equipo_id=%s", (equipo_id,))
        r = cur.fetchone()
        if not r:
            return False, "Equipo no encontrado"
        equipo_area_id = int(r[0])

        # 2) Validar ítem
        cur.execute("SELECT area_id, estado FROM inv.items WHERE item_id=%s", (item_id,))
        r = cur.fetchone()
        if not r:
            return False, "Item no encontrado"
        item_area_id, _estado_actual = r[0], r[1]

        if item_area_id is not None and equipo_area_id is not None and int(item_area_id) != int(equipo_area_id):
            return False, "El ítem pertenece a otra área"

        # 3) ¿Ya está asignado a algún equipo?
        cur.execute("""
            SELECT equipo_id, slot_o_ubicacion
              FROM inv.equipo_items
             WHERE item_id=%s
        """, (item_id,))
        rel = cur.fetchone()

        if rel:
            old_equipo_id = int(rel[0])
            if old_equipo_id == equipo_id:
                # idempotente: actualizar slot si cambió
                cur.execute("""
                    UPDATE inv.equipo_items
                       SET slot_o_ubicacion=%s
                     WHERE equipo_id=%s AND item_id=%s
                """, (slot, equipo_id, item_id))
            else:
                # mover: borrar relación anterior y crear la nueva
                cur.execute("DELETE FROM inv.equipo_items WHERE item_id=%s", (item_id,))
                cur.execute("""
                    INSERT INTO inv.equipo_items(equipo_id, item_id, slot_o_ubicacion)
                    VALUES (%s,%s,%s)
                """, (equipo_id, item_id, slot))
        else:
            # crear relación nueva
            cur.execute("""
                INSERT INTO inv.equipo_items(equipo_id, item_id, slot_o_ubicacion)
                VALUES (%s,%s,%s)
            """, (equipo_id, item_id, slot))

        # 4) Estado del ítem
        cur.execute("UPDATE inv.items SET estado='EN_USO' WHERE item_id=%s", (item_id,))

        # 5) Movimiento
        cur.execute("""
          INSERT INTO inv.movimientos(
            mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
            mov_equipo_id, mov_usuario_app, mov_detalle
          ) VALUES (
            %s, 'ASIGNACION', %s, %s, %s, current_setting('app.user', true),
            %s
          )
        """, (item_id, equipo_area_id, equipo_area_id, equipo_id, None if slot is None else {'slot': slot}))

        return True, None


# ---------------------------------------------------
# Retirar ítem del equipo
# ---------------------------------------------------
def unassign_item(app_user: str, equipo_id: int, item_id: int) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("DELETE FROM inv.equipo_items WHERE equipo_id=%s AND item_id=%s RETURNING 1",
                    (equipo_id, item_id))
        if not cur.fetchone():
            return "El item no estaba asignado"

        # Estado de vuelta a ALMACEN (sin updated_at)
        cur.execute("UPDATE inv.items SET estado='ALMACEN' WHERE item_id=%s", (item_id,))

        # Movimiento
        cur.execute("""
          INSERT INTO inv.movimientos(
            mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
            mov_equipo_id, mov_usuario_app, mov_motivo
          ) SELECT %s, 'RETIRO', e.equipo_area_id, e.equipo_area_id, %s,
                   current_setting('app.user', true), %s
            FROM inv.equipos e WHERE e.equipo_id=%s
        """, (item_id, equipo_id, None, equipo_id))
    return None


# ---------------------------------------------------
# Actualizar metadatos del equipo
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

    # Nota: no tocamos updated_at si tu tabla no lo tiene; si lo tienes,
    # puedes agregar ", updated_at=NOW()" aquí.
    sql = "UPDATE inv.equipos SET " + ", ".join(pieces) + " WHERE equipo_id=%s"
    params.append(equipo_id)
    with get_conn(app_user) as (conn, cur):
        cur.execute(sql, params)
    return None
