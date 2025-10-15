from typing import List, Dict, Any, Optional, Tuple
from json import dumps
from app.db import get_conn
from app.models.user_model import ensure_user_for_equipo  # crea/actualiza usuario rol USUARIO

# ============================================================
# LISTADOS DE EQUIPOS (compatibilidad + paginado)
# ============================================================
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


# ============================================================
# DETALLE DE EQUIPO
# ============================================================
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


# ============================================================
# ÍTEMS DISPONIBLES (ALMACÉN)
# ============================================================
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


# ============================================================
# CREAR EQUIPO (con items) — asegura usuario rol USUARIO
# ============================================================
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
        cur.execute("SELECT set_config('app.proc', %s, true)", ('equipos.create_con_items',))
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

        # === usuario de equipo (rol USUARIO, sin duplicar) ===
        ensure_user_for_equipo(app_user, login, password, area_id)

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

            # si existe SP, usarlo; si no, fallback
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
                """, (item_id, area_id, area_id, equipo_id,
                      None if slot is None else {'slot': slot}))

        return equipo_id, None


# ============================================================
# ASIGNAR / RETIRAR ITEM DEL EQUIPO
# ============================================================
def assign_item_to_equipo(
    app_user: str,
    equipo_id: int,
    item_id: int,
    slot: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("SELECT set_config('app.proc', %s, true)", ('equipos.assign_item',))

        cur.execute("SELECT equipo_area_id FROM inv.equipos WHERE equipo_id=%s", (equipo_id,))
        r = cur.fetchone()
        if not r:
            return False, "Equipo no encontrado"
        equipo_area_id = int(r[0])

        cur.execute("SELECT area_id, estado FROM inv.items WHERE item_id=%s", (item_id,))
        r = cur.fetchone()
        if not r:
            return False, "Item no encontrado"

        cur.execute("SELECT equipo_id FROM inv.equipo_items WHERE item_id=%s", (item_id,))
        prev = cur.fetchone()
        if prev:
            cur.execute("DELETE FROM inv.equipo_items WHERE item_id=%s", (item_id,))

        cur.execute("""
            INSERT INTO inv.equipo_items(equipo_id, item_id, slot_o_ubicacion)
            VALUES (%s,%s,%s)
        """, (equipo_id, item_id, slot))

        active = _get_active_loan(cur, item_id)
        if active is not None and active[1] == equipo_area_id:
            cur.execute("UPDATE inv.items SET estado='EN_USO_PRESTADO' WHERE item_id=%s", (item_id,))
        else:
            cur.execute("UPDATE inv.items SET estado='EN_USO' WHERE item_id=%s", (item_id,))

        cur.execute("""
          INSERT INTO inv.movimientos(
            mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
            mov_equipo_id, mov_usuario_app, mov_detalle
          ) VALUES (
            %s, 'ASIGNACION', %s, %s, %s, current_setting('app.user', true),
            %s
          )
        """, (item_id, equipo_area_id, equipo_area_id, equipo_id,
              None if slot is None else {'slot': slot}))

        return True, None


def unassign_item(app_user: str, equipo_id: int, item_id: int) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("SELECT set_config('app.proc', %s, true)", ('equipos.unassign_item',))

        cur.execute("DELETE FROM inv.equipo_items WHERE equipo_id=%s AND item_id=%s RETURNING 1",
                    (equipo_id, item_id))
        if not cur.fetchone():
            return "El item no estaba asignado"

        active = _get_active_loan(cur, item_id)
        if active is not None:
            cur.execute("UPDATE inv.items SET estado='PRESTAMO' WHERE item_id=%s", (item_id,))
        else:
            cur.execute("UPDATE inv.items SET estado='ALMACEN' WHERE item_id=%s", (item_id,))

        cur.execute("""
          INSERT INTO inv.movimientos(
            mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
            mov_equipo_id, mov_usuario_app
          ) SELECT %s, 'RETIRO', e.equipo_area_id, e.equipo_area_id, %s,
                   current_setting('app.user', true)
            FROM inv.equipos e WHERE e.equipo_id=%s
        """, (item_id, equipo_id, equipo_id))
    return None


# ============================================================
# HELPERS PRÉSTAMO + BI-VISTA DE ÍTEMS POR ÁREA
# ============================================================
def _get_active_loan(cur, item_id: int):
    """
    Devuelve (origen_area_id, destino_area_id, mov_id) del último TRASLADO
    cuyo mov_detalle->>'es_prestamo' = 'true'. None si no hay préstamo activo.
    """
    cur.execute("""
        SELECT m.mov_id, m.mov_origen_area_id, m.mov_destino_area_id,
               COALESCE((m.mov_detalle->>'es_prestamo')::boolean, false) AS es_prestamo
        FROM inv.movimientos m
        WHERE m.mov_item_id = %s AND m.mov_tipo = 'TRASLADO'
        ORDER BY m.mov_id DESC
        LIMIT 1
    """, (item_id,))
    r = cur.fetchone()
    if not r:
        return None
    mov_id, org, dst, es_prestamo = int(r[0]), r[1], r[2], bool(r[3])
    if es_prestamo:
        return (int(org) if org is not None else None,
                int(dst) if dst is not None else None,
                mov_id)
    return None


def list_area_items_biview(
    app_user: str,
    area_id: int,
    clase: Optional[str] = None,
    page: int = 1,
    size: int = 10,
) -> Dict[str, Any]:
    p = max(1, int(page or 1))
    s = min(200, max(1, int(size or 10)))
    off = (p - 1) * s

    SQL = """
    WITH last_tr AS (
       SELECT DISTINCT ON (m.mov_item_id)
              m.mov_item_id,
              m.mov_origen_area_id,
              m.mov_destino_area_id,
              COALESCE((m.mov_detalle->>'es_prestamo')::boolean, false) as es_prestamo
       FROM inv.movimientos m
       WHERE m.mov_tipo='TRASLADO'
       ORDER BY m.mov_item_id, m.mov_id DESC
    ),
    base AS (
      SELECT
        i.item_id,
        i.item_codigo,
        it.clase,
        it.nombre AS tipo,
        i.estado,
        i.area_id     AS dueno_area_id,
        l.mov_origen_area_id AS loan_origen_area_id,
        l.mov_destino_area_id AS loan_destino_area_id,
        l.es_prestamo,
        ei.equipo_id,
        e.equipo_codigo,
        e.equipo_nombre
      FROM inv.items i
      JOIN inv.item_tipos it ON it.item_tipo_id = i.item_tipo_id
      LEFT JOIN last_tr l     ON l.mov_item_id = i.item_id
      LEFT JOIN inv.equipo_items ei ON ei.item_id = i.item_id
      LEFT JOIN inv.equipos e       ON e.equipo_id = ei.equipo_id
      WHERE (%(by_clase)s IS NULL OR it.clase = %(by_clase)s)
    ),
    view_origin AS (
      SELECT b.*, b.dueno_area_id AS vista_area_id, b.loan_destino_area_id AS otra_area_id, 'ORIGEN'::text AS vista
      FROM base b
      WHERE b.dueno_area_id = %(area_id)s
    ),
    view_dest AS (
      SELECT b.*, %(area_id)s AS vista_area_id, b.loan_origen_area_id AS otra_area_id, 'DESTINO'::text AS vista
      FROM base b
      WHERE b.es_prestamo IS TRUE AND b.loan_destino_area_id = %(area_id)s
            AND (b.dueno_area_id IS NULL OR b.dueno_area_id <> %(area_id)s)
    ),
    unioned AS ( SELECT * FROM view_origin UNION ALL SELECT * FROM view_dest )
    SELECT
      u.item_id, u.item_codigo, u.clase, u.tipo, u.estado, u.vista,
      u.dueno_area_id, u.loan_origen_area_id, u.loan_destino_area_id, u.es_prestamo,
      u.equipo_id, u.equipo_codigo, u.equipo_nombre,
      ao.area_nombre AS origen_area_nombre,
      ad.area_nombre AS destino_area_nombre,
      COUNT(*) OVER() AS total_rows
    FROM unioned u
    LEFT JOIN inv.areas ao ON ao.area_id = u.loan_origen_area_id
    LEFT JOIN inv.areas ad ON ad.area_id = u.loan_destino_area_id
    ORDER BY lower(u.tipo), lower(u.item_codigo)
    LIMIT %(limit)s OFFSET %(offset)s
    """
    params = {
        "area_id": area_id,
        "by_clase": clase if clase in ("COMPONENTE", "PERIFERICO") else None,
        "limit": s,
        "offset": off,
    }
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, params)
        rows = cur.fetchall()

    total = 0
    out = []
    for r in rows:
        total = r[15]
        vista = r[5]  # 'ORIGEN' | 'DESTINO'
        estado = (r[4] or "").upper()
        es_prestamo = bool(r[9])
        loan_origen = r[7]
        loan_dest   = r[8]
        origen_nom  = r[13]
        destino_nom = r[14]

        if vista == "ORIGEN" and es_prestamo and loan_dest and loan_dest != r[6]:
            view_estado = "EN_USO_PRESTADO"
        elif vista == "DESTINO" and es_prestamo and loan_dest == area_id:
            view_estado = "PRESTAMO"
        else:
            view_estado = estado

        out.append({
            "item_id": r[0],
            "item_codigo": r[1],
            "clase": r[2],
            "tipo": r[3],
            "estado": estado,
            "view_estado": view_estado,
            "equipo": ({"equipo_id": r[10], "equipo_codigo": r[11], "equipo_nombre": r[12]}
                       if r[10] is not None else None),
            "prestamo_origen_area_id": loan_origen,
            "prestamo_origen_area_nombre": origen_nom,
            "prestamo_destino_area_id": loan_dest,
            "prestamo_destino_area_nombre": destino_nom,
        })
    return {"items": out, "total": int(total or 0), "page": p, "size": s}


# ============================================================
# PRESTAR / DEVOLVER
# ============================================================
def prestar_item(
    app_user: str,
    item_id: int,
    destino_area_id: int,
    detalle: Optional[Dict[str, Any]] = None,
    mov_equipo_id: Optional[int] = None,
) -> Tuple[bool, Optional[str]]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("SELECT set_config('app.proc', %s, true)", ('items.prestar',))

        cur.execute("SELECT area_id FROM inv.items WHERE item_id=%s", (item_id,))
        r = cur.fetchone()
        if not r:
            return False, "Item no existe"
        origen_area_id = int(r[0]) if r[0] is not None else None

        if destino_area_id == origen_area_id:
            return False, "Destino no puede ser el mismo que el origen"

        det = (detalle or {}).copy()
        det["es_prestamo"] = True
        det_json = dumps(det)

        cur.execute("""
          INSERT INTO inv.movimientos(
            mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
            mov_equipo_id, mov_usuario_app, mov_detalle
          ) VALUES (
            %s, 'TRASLADO', %s, %s, %s, current_setting('app.user', true), %s::jsonb
          )
        """, (item_id, origen_area_id, destino_area_id, mov_equipo_id, det_json))

        cur.execute("UPDATE inv.items SET estado='PRESTAMO' WHERE item_id=%s", (item_id,))
        return True, None


def devolver_item(
    app_user: str,
    item_id: int,
    detalle: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Optional[str]]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("SELECT set_config('app.proc', %s, true)", ('items.devolver',))

        active = _get_active_loan(cur, item_id)
        if not active:
            return False, "El ítem no tiene préstamo activo"
        origen_area_id, destino_area_id, _ = active

        det = (detalle or {}).copy()
        det["es_prestamo"] = False
        det["devolucion"]   = True
        det_json = dumps(det)

        cur.execute("""
          INSERT INTO inv.movimientos(
            mov_item_id, mov_tipo, mov_origen_area_id, mov_destino_area_id,
            mov_usuario_app, mov_detalle
          ) VALUES (
            %s, 'TRASLADO', %s, %s, current_setting('app.user', true), %s::jsonb
          )
        """, (item_id, destino_area_id, origen_area_id, det_json))

        cur.execute("DELETE FROM inv.equipo_items WHERE item_id=%s", (item_id,))
        cur.execute("UPDATE inv.items SET estado='ALMACEN' WHERE item_id=%s", (item_id,))

        return True, None


# ============================================================
# ACTUALIZAR META DEL EQUIPO — asegura usuario rol USUARIO
# ============================================================
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

    params.append(equipo_id)
    sql = "UPDATE inv.equipos SET " + ", ".join(pieces) + " WHERE equipo_id=%s"
    with get_conn(app_user) as (conn, cur):
        cur.execute("SELECT set_config('app.proc', %s, true)", ('equipos.update_meta',))
        cur.execute(sql, params)

        # asegurar/actualizar usuario de equipo (sin duplicar)
        cur.execute("SELECT equipo_area_id, equipo_login, equipo_password FROM inv.equipos WHERE equipo_id=%s", (equipo_id,))
        a = cur.fetchone()
        if a:
            area_id = int(a[0]) if a[0] is not None else None
            el = (login if login is not None else a[1])
            ep = (password if password is not None else a[2])
            ensure_user_for_equipo(app_user, el, ep, area_id)
    return None


# ============================================================
# SUGERIR CÓDIGO DE EQUIPO POR ÁREA
# ============================================================
def get_next_equipo_code(
    app_user: str,
    area_id: int,
    prefix: Optional[str] = None,
    pad: int = 3,
) -> str:
    """
    Genera el siguiente código de equipo por área buscando el mayor sufijo numérico
    de los códigos que comienzan con <prefix>.
    Ej: prefix='PC-' -> PC-001, PC-002, ...
    """
    pref = (prefix or "PC-").strip()
    if pref == "":
        pref = "PC-"

    SQL = """
      SELECT COALESCE(MAX( (regexp_replace(equipo_codigo, '[^0-9]+', '', 'g'))::int ), 0) AS max_num
        FROM inv.equipos
       WHERE equipo_area_id = %s
         AND equipo_codigo ILIKE %s
         AND equipo_codigo ~ '\\d+$'
    """
    params = [area_id, f"{pref}%"]
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, params)
        r = cur.fetchone()
        max_num = int(r[0] or 0)

    nxt = max_num + 1
    suf = str(nxt).zfill(max(1, int(pad or 3)))
    return f"{pref}{suf}"
