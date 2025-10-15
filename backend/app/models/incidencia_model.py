# app/models/incidencia_model.py
from typing import Optional, Tuple, Dict, Any, List
from app.db import get_conn

# ============================================================
# CREAR
# ============================================================
def create_incidencia(
    app_user: str,
    titulo: str,
    descripcion: str,
    equipo_id: Optional[int] = None,
    reportado_email: Optional[str] = None,   # se guarda en reportado_nombre
) -> Tuple[Optional[int], Optional[str]]:
    """
    Inserta en inv.incidencias (tu tabla real):
      columnas: inc_id, equipo_id, area_id, reportado_por, reportado_nombre, titulo, descripcion, estado, ...
    - reportado_por     : username (NOT NULL)
    - reportado_nombre  : email de contacto o username (compatibilidad)
    - area_id           : del equipo si hay; si no, del usuario (inv.usuarios.area_id) si existe
    """
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("SELECT set_config('app.proc', %s, true)", ('incidencias.create',))

            # 1) Derivar area_id
            area_id = None
            if equipo_id is not None:
                cur.execute("SELECT equipo_area_id FROM inv.equipos WHERE equipo_id=%s", (equipo_id,))
                r = cur.fetchone()
                if not r:
                    return None, "El equipo no existe"
                area_id = int(r[0])

            if area_id is None:
                # Si existe inv.usuarios.area_id, úsalo como fallback
                cur.execute("""
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema='inv' AND table_name='usuarios' AND column_name='area_id'
                """)
                if cur.fetchone():
                    cur.execute("SELECT area_id FROM inv.usuarios WHERE username=%s", (app_user,))
                    a = cur.fetchone()
                    if a and a[0] is not None:
                        area_id = int(a[0])

            # 2) Campos de reporter
            reportado_por = app_user
            reportado_nombre = (reportado_email or app_user)

            # 3) INSERT
            cur.execute("""
              INSERT INTO inv.incidencias(
                equipo_id, area_id, reportado_por, reportado_nombre, titulo, descripcion, estado
              ) VALUES (%s,%s,%s,%s,%s,%s,'ABIERTA')
              RETURNING inc_id
            """, (equipo_id, area_id, reportado_por, reportado_nombre, titulo, descripcion))

            inc_id = int(cur.fetchone()[0])
            return inc_id, None
        except Exception as e:
            conn.rollback()
            return None, f"No se pudo crear la incidencia: {e}"

# ============================================================
# LISTAR (admin/practicante ven todo; usuario solo las suyas)
# ============================================================
def list_incidencias(
    app_user: str,
    mine: bool = False,
    estado: Optional[str] = None,
    page: int = 1,
    size: int = 10,
    q: Optional[str] = None,
    area_id: Optional[int] = None,
) -> Dict[str, Any]:
    p = max(1, int(page or 1))
    s = min(100, max(1, int(size or 10)))
    off = (p - 1) * s

    with get_conn(app_user) as (conn, cur):
        sql = """
          SELECT
            i.inc_id,
            i.titulo,
            i.descripcion,
            i.estado,
            i.reportado_por AS usuario,
            i.equipo_id,
            e.equipo_codigo,
            i.area_id,
            a.area_nombre,
            i.created_at,
            COUNT(*) OVER() AS total_rows
          FROM inv.incidencias i
          LEFT JOIN inv.equipos e ON e.equipo_id = i.equipo_id
          LEFT JOIN inv.areas   a ON a.area_id   = i.area_id
          WHERE 1=1
        """
        params: List[Any] = []

        if mine:
            sql += " AND i.reportado_por = %s"
            params.append(app_user)

        if estado:
            sql += " AND i.estado = %s"
            params.append(estado)

        if area_id is not None:
            sql += " AND i.area_id = %s"
            params.append(area_id)

        if q:
            like = f"%{q.lower()}%"
            sql += " AND (LOWER(i.titulo) LIKE %s OR LOWER(i.descripcion) LIKE %s OR LOWER(COALESCE(e.equipo_codigo,'')) LIKE %s)"
            params.extend([like, like, like])

        sql += " ORDER BY i.inc_id DESC LIMIT %s OFFSET %s"
        params.extend([s, off])

        cur.execute(sql, params)
        rows = cur.fetchall()

    items: List[Dict[str, Any]] = []
    total = 0
    for r in rows:
        total = r[10]
        items.append({
            "inc_id": r[0],
            "titulo": r[1],
            "descripcion": r[2],
            "estado": r[3],
            "usuario": r[4],
            "equipo_id": r[5],
            "equipo_codigo": r[6],
            "area_id": r[7],
            "area_nombre": r[8],
            "created_at": r[9],
        })
    return {"items": items, "total": int(total or 0), "page": p, "size": s}

# ============================================================
# DETALLE
# ============================================================
def get_incidencia(app_user: str, inc_id: int) -> Optional[Dict[str, Any]]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("""
          SELECT
            i.inc_id, i.titulo, i.descripcion, i.estado,
            i.reportado_por AS usuario,
            i.equipo_id, e.equipo_codigo,
            i.area_id,  a.area_nombre,
            i.created_at
          FROM inv.incidencias i
          LEFT JOIN inv.equipos e ON e.equipo_id = i.equipo_id
          LEFT JOIN inv.areas   a ON a.area_id   = i.area_id
          WHERE i.inc_id=%s
        """, (inc_id,))
        h = cur.fetchone()
        if not h:
            return None

        cur.execute("""
          SELECT mensaje, usuario, created_at
          FROM inv.incidencia_mensajes
          WHERE inc_id=%s
          ORDER BY created_at ASC
        """, (inc_id,))
        ms = cur.fetchall()

    return {
        "inc_id": h[0],
        "titulo": h[1],
        "descripcion": h[2],
        "estado": h[3],
        "usuario": h[4],
        "equipo_id": h[5],
        "equipo_codigo": h[6],
        "area_id": h[7],
        "area_nombre": h[8],
        "created_at": h[9],
        "mensajes": [{"mensaje": m[0], "usuario": m[1], "created_at": m[2]} for m in ms],
    }

# ============================================================
# MENSAJE
# ============================================================
def add_mensaje(app_user: str, inc_id: int, cuerpo: str) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("""
              INSERT INTO inv.incidencia_mensajes(inc_id, usuario, mensaje)
              VALUES (%s,%s,%s)
            """, (inc_id, app_user, cuerpo))
            return None
        except Exception as e:
            conn.rollback()
            return f"No se pudo agregar el mensaje: {e}"

# ============================================================
# ASIGNAR / ESTADO
# ============================================================
def asignar_incidencia(app_user: str, inc_id: int, username: str) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("UPDATE inv.incidencias SET asignado_a=%s WHERE inc_id=%s", (username, inc_id))
            return None
        except Exception as e:
            conn.rollback()
            return f"No se pudo asignar: {e}"

def set_estado(app_user: str, inc_id: int, estado: str) -> Optional[str]:
    estado = (estado or "").upper()
    if estado not in ("ABIERTA", "EN_PROCESO", "CERRADA"):
        return "Estado inválido"
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("UPDATE inv.incidencias SET estado=%s WHERE inc_id=%s", (estado, inc_id))
            return None
        except Exception as e:
            conn.rollback()
            return f"No se pudo cambiar estado: {e}"
