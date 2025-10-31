# app/models/incidencia_model.py
from typing import Optional, Tuple, Dict, Any, List
from app.db import get_conn
from app.utils.mailer import send_mail_safe

# ---------- helpers internos ----------
def _get_user_email(cur, username: str) -> Optional[str]:
    cur.execute("""
        SELECT usuario_email
        FROM inv.usuarios
        WHERE usuario_username=%s
    """, (username,))
    r = cur.fetchone()
    return r[0] if r and r[0] else None

def _get_user_id(cur, username: str) -> Optional[int]:
    cur.execute("SELECT usuario_id FROM inv.usuarios WHERE usuario_username=%s", (username,))
    r = cur.fetchone()
    return int(r[0]) if r else None

def _get_equipo_area(cur, equipo_id: Optional[int]) -> tuple[Optional[str], Optional[int], Optional[str]]:
    """Devuelve (equipo_codigo, area_id, area_nombre) para pintar en mails."""
    if equipo_id is None:
        return None, None, None
    cur.execute("""
        SELECT e.equipo_codigo, e.equipo_area_id, a.area_nombre
        FROM inv.equipos e
        LEFT JOIN inv.areas a ON a.area_id = e.equipo_area_id
        WHERE e.equipo_id=%s
    """, (equipo_id,))
    r = cur.fetchone()
    if not r: 
        return None, None, None
    return r[0], r[1], r[2]

# ============================================================
# CREAR
# ============================================================
def create_incidencia(
    app_user: str,
    titulo: str,
    descripcion: str,
    equipo_id: Optional[int] = None,
    reportado_email: Optional[str] = None,   # opcional, se usará como Reply-To
) -> Tuple[Optional[int], Optional[str]]:
    """
    Inserta en inv.incidencias y notifica por email al ADMIN.
    """
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("SELECT set_config('app.proc', %s, true)", ('incidencias.create',))

            equipo_codigo, area_id_equipo, area_nombre_equipo = _get_equipo_area(cur, equipo_id)

            # Fallback a área del usuario si existe la columna y no vino área del equipo
            area_id = area_id_equipo
            cur.execute("""
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='inv' AND table_name='usuarios' AND column_name='usuario_area_id'
            """)
            if area_id is None and cur.fetchone():
                cur.execute("SELECT usuario_area_id FROM inv.usuarios WHERE usuario_username=%s", (app_user,))
                a = cur.fetchone()
                if a and a[0] is not None:
                    area_id = int(a[0])

            cur.execute("""
              INSERT INTO inv.incidencias(
                equipo_id, area_id, reportado_por, titulo, descripcion, estado
              ) VALUES (%s,%s,%s,%s,%s,'ABIERTA')
              RETURNING inc_id
            """, (equipo_id, area_id, app_user, titulo, descripcion))

            inc_id = int(cur.fetchone()[0])

            # --- EMAIL al administrador (con Reply-To del usuario si lo dio) ---
            cuerpo = [
                f"Incidencia #{inc_id}",
                f"Título: {titulo}",
                f"Descripción:\n{descripcion}",
                "",
                f"Reportado por: {app_user}",
                f"Email: {reportado_email or 'no provisto'}",
            ]
            if equipo_codigo:
                cuerpo += [f"Equipo: {equipo_codigo}"]
            if area_nombre_equipo:
                cuerpo += [f"Área: {area_nombre_equipo}"]
            send_mail_safe(
                subject=f"[INCIDENCIA #{inc_id}] {titulo}",
                body="\n".join(cuerpo),
                to=None,  # ADMIN_TO interno en mailer
                reply_to=reportado_email or None,
            )

            return inc_id, None
        except Exception as e:
            conn.rollback()
            return None, f"No se pudo crear la incidencia: {e}"

# ============================================================
# LISTAR
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
        # rol
        cur.execute("""
          SELECT r.rol_nombre
          FROM inv.usuarios u
          JOIN inv.roles r ON r.rol_id=u.rol_id
          WHERE u.usuario_username=%s
        """, (app_user,))
        r = cur.fetchone()
        rol_db = (r[0] if r else "").upper()

        sql = """
          SELECT
            i.inc_id, i.titulo, i.descripcion, i.estado,
            i.reportado_por AS usuario,
            i.equipo_id, e.equipo_codigo,
            i.area_id,  a.area_nombre,
            i.created_at,
            COUNT(*) OVER() AS total_rows
          FROM inv.incidencias i
          LEFT JOIN inv.equipos e ON e.equipo_id = i.equipo_id
          LEFT JOIN inv.areas   a ON a.area_id   = i.area_id
          WHERE 1=1
        """
        params: List[Any] = []

        # Filtro por rol:
        if rol_db == "USUARIOS":
            sql += " AND i.reportado_por = %s"
            params.append(app_user)
        elif rol_db == "PRACTICANTE":
            sql += " AND i.asignado_a = %s"
            params.append(app_user)
        else:
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
            i.created_at,
            i.asignado_a
          FROM inv.incidencias i
          LEFT JOIN inv.equipos e ON e.equipo_id = i.equipo_id
          LEFT JOIN inv.areas   a ON a.area_id   = i.area_id
          WHERE i.inc_id=%s
        """, (inc_id,))
        h = cur.fetchone()
        if not h:
            return None

        # ¿existe solo_staff?
        cur.execute("""
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='inv' AND table_name='incidencia_mensajes' AND column_name='solo_staff'
        """)
        has_solo = bool(cur.fetchone())

        if has_solo:
            cur.execute("""
              SELECT msg_id, mensaje, usuario, created_at, solo_staff
              FROM inv.incidencia_mensajes
              WHERE inc_id=%s
              ORDER BY created_at ASC
            """, (inc_id,))
            ms = cur.fetchall()
            mensajes = [
                {"msg_id": m[0], "mensaje": m[1], "usuario": m[2], "created_at": m[3], "solo_staff": bool(m[4])}
                for m in ms
            ]
        else:
            cur.execute("""
              SELECT mensaje, usuario, created_at
              FROM inv.incidencia_mensajes
              WHERE inc_id=%s
              ORDER BY created_at ASC
            """, (inc_id,))
            ms = cur.fetchall()
            mensajes = [{"mensaje": m[0], "usuario": m[1], "created_at": m[2]} for m in ms]

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
        "asignado_a": h[10],
        "mensajes": mensajes,
    }

# ============================================================
# MENSAJE (notifica y devuelve msg_id)
# ============================================================
def add_mensaje(app_user: str, inc_id: int, cuerpo: str, solo_staff: bool = False) -> Tuple[Optional[int], Optional[str]]:
    with get_conn(app_user) as (conn, cur):
        try:
            # ¿existe la columna solo_staff?
            cur.execute("""
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='inv' AND table_name='incidencia_mensajes' AND column_name='solo_staff'
            """)
            has_solo = bool(cur.fetchone())

            if has_solo:
                cur.execute("""
                  INSERT INTO inv.incidencia_mensajes(inc_id, usuario, mensaje, solo_staff)
                  VALUES (%s,%s,%s,%s)
                  RETURNING msg_id
                """, (inc_id, app_user, cuerpo, solo_staff))
            else:
                cur.execute("""
                  INSERT INTO inv.incidencia_mensajes(inc_id, usuario, mensaje)
                  VALUES (%s,%s,%s)
                  RETURNING msg_id
                """, (inc_id, app_user, cuerpo))
            msg_id = int(cur.fetchone()[0])

            # info de la incidencia para correos
            cur.execute("""
              SELECT i.titulo, i.reportado_por, i.asignado_a, e.equipo_codigo, a.area_nombre
              FROM inv.incidencias i
              LEFT JOIN inv.equipos e ON e.equipo_id = i.equipo_id
              LEFT JOIN inv.areas  a  ON a.area_id   = i.area_id
              WHERE i.inc_id=%s
            """, (inc_id,))
            row = cur.fetchone()
            if not row:
                return msg_id, None
            titulo, reportado_por, asignado_a, equipo_codigo, area_nombre = row

            email_reportado = _get_user_email(cur, reportado_por) if reportado_por else None
            email_asignado  = _get_user_email(cur, asignado_a) if asignado_a else None
            email_autor     = _get_user_email(cur, app_user)

            body_lines = [
                f"Incidencia #{inc_id} · {titulo}",
                f"De: {app_user}",
                f"Mensaje:\n{cuerpo}",
            ]
            meta = []
            if equipo_codigo: meta.append(f"Equipo: {equipo_codigo}")
            if area_nombre:  meta.append(f"Área: {area_nombre}")
            if meta:
                body_lines += ["", *meta]
            body = "\n".join(body_lines)

            # Destinatarios dependiendo de quién escribe y privacidad
            to_list: list[tuple[str, str|None]] = []
            if app_user == (reportado_por or ""):
                if email_asignado:
                    to_list.append((email_asignado, email_autor))
            else:
                if email_reportado and not solo_staff:  # si es privado no se avisa al usuario
                    to_list.append((email_reportado, email_autor))

            for to_addr, reply_to in to_list:
                send_mail_safe(
                    subject=f"[INCIDENCIA #{inc_id}] Nuevo mensaje",
                    body=body,
                    to=to_addr,
                    reply_to=reply_to or None,
                )

            return msg_id, None
        except Exception as e:
            conn.rollback()
            return None, f"No se pudo agregar el mensaje: {e}"

# ============================================================
# ASIGNAR
# ============================================================
def asignar_incidencia(app_user: str, inc_id: int, username: str) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        try:
            # validar usuario destino
            uid = _get_user_id(cur, username)
            if not uid:
                return "Usuario a asignar no existe"

            # asignar por username
            cur.execute("UPDATE inv.incidencias SET asignado_a=%s WHERE inc_id=%s", (username, inc_id))

            # armar notificación
            cur.execute("""
              SELECT titulo, reportado_por, estado, e.equipo_codigo, a.area_nombre
              FROM inv.incidencias i
              LEFT JOIN inv.equipos e ON e.equipo_id = i.equipo_id
              LEFT JOIN inv.areas  a  ON a.area_id   = i.area_id
              WHERE i.inc_id=%s
            """, (inc_id,))
            t = cur.fetchone()
            if not t:
                return None
            titulo, reportado_por, estado, equipo_codigo, area_nombre = t

            email_pract = _get_user_email(cur, username)
            email_rep   = _get_user_email(cur, reportado_por) if reportado_por else None

            cuerpo = [
                f"Incidencia #{inc_id} asignada",
                f"Título: {titulo}",
                f"Estado actual: {estado}",
                "",
                f"Asignado a: {username}",
            ]
            if equipo_codigo: cuerpo.append(f"Equipo: {equipo_codigo}")
            if area_nombre:  cuerpo.append(f"Área: {area_nombre}")
            cuerpo.append("")
            cuerpo.append("Por favor revise el sistema para atender el caso.")

            send_mail_safe(
                subject=f"[INCIDENCIA #{inc_id}] Asignada a {username}",
                body="\n".join(cuerpo),
                to=email_pract or None,
                reply_to=None,
                cc=[email_rep] if email_rep else None,
            )

            return None
        except Exception as e:
            conn.rollback()
            return f"No se pudo asignar: {e}"

# ============================================================
# ESTADO (bloquea cambios si ya está CERRADA; notifica cambios)
# ============================================================
def set_estado(app_user: str, inc_id: int, estado: str) -> Optional[str]:
    estado = (estado or "").upper()
    if estado not in ("ABIERTA", "EN_PROCESO", "CERRADA"):
        return "Estado inválido"
    with get_conn(app_user) as (conn, cur):
        try:
            # evitar cambios si ya está CERRADA
            cur.execute("SELECT estado, titulo, reportado_por, asignado_a FROM inv.incidencias WHERE inc_id=%s", (inc_id,))
            row = cur.fetchone()
            if not row:
                return "Incidencia no existe"
            estado_actual, titulo, reportado_por, asignado_a = row
            if (estado_actual or "").upper() == "CERRADA":
                return "La incidencia ya está CERRADA y no se puede cambiar."

            cur.execute("UPDATE inv.incidencias SET estado=%s WHERE inc_id=%s", (estado, inc_id))

            # notificación de cambio de estado
            email_rep = _get_user_email(cur, reportado_por) if reportado_por else None
            email_asg = _get_user_email(cur, asignado_a) if asignado_a else None

            body = f"Incidencia #{inc_id} · {titulo}\n\nNuevo estado: {estado}\nActualizado por: {app_user}"
            if email_rep:
                send_mail_safe(subject=f"[INCIDENCIA #{inc_id}] Estado: {estado}", body=body, to=email_rep)
            if email_asg:
                send_mail_safe(subject=f"[INCIDENCIA #{inc_id}] Estado: {estado}", body=body, to=email_asg)

            return None
        except Exception as e:
            conn.rollback()
            return f"No se pudo cambiar estado: {e}"

# ============================================================
# UPDATES (pull incremental rápido para tiempo “real”)
# ============================================================
def list_updates(app_user: str, since_id: Optional[int]) -> Dict[str, Any]:
    """
    Devuelve mensajes con msg_id > since_id visibles para app_user.
    Filtra por rol y privacidad (solo_staff).
    """
    with get_conn(app_user) as (conn, cur):
        # rol
        cur.execute("""
          SELECT UPPER(r.rol_nombre)
          FROM inv.usuarios u JOIN inv.roles r ON r.rol_id=u.rol_id
          WHERE u.usuario_username=%s
        """, (app_user,))
        r = cur.fetchone()
        rol = (r[0] if r else "USUARIOS").upper()

        # ¿hay columna solo_staff?
        cur.execute("""
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='inv' AND table_name='incidencia_mensajes' AND column_name='solo_staff'
        """)
        has_solo = bool(cur.fetchone())

        base = f"""
          SELECT m.msg_id, m.inc_id, m.mensaje, m.usuario, m.created_at,
                 {'m.solo_staff' if has_solo else 'FALSE'} AS solo_staff,
                 i.titulo, i.estado, i.reportado_por, i.asignado_a
          FROM inv.incidencia_mensajes m
          JOIN inv.incidencias i ON i.inc_id = m.inc_id
          WHERE m.msg_id > %s
            AND LOWER(m.usuario) <> LOWER(%s)
        """

        params: List[Any] = [int(since_id or 0), app_user]

        if rol == "USUARIOS":
            # solo incidencias propias y ocultar privados
            base += " AND i.reportado_por=%s"
            params.append(app_user)
            if has_solo:
                base += " AND COALESCE(m.solo_staff,false)=false"
        elif rol == "PRACTICANTE":
            # solo asignadas al practicante
            base += " AND i.asignado_a=%s"
            params.append(app_user)
        else:
            # ADMIN ve todo
            pass

        base += " ORDER BY m.msg_id ASC LIMIT 100"

        cur.execute(base, params)
        rows = cur.fetchall()

        items: List[Dict[str, Any]] = []
        last_id = since_id or 0
        for r in rows:
            last_id = max(last_id, int(r[0]))
            items.append({
                "msg_id": int(r[0]),
                "inc_id": int(r[1]),
                "mensaje": r[2],
                "usuario": r[3],
                "created_at": r[4],
                "solo_staff": bool(r[5]),
                "titulo": r[6],
                "estado": r[7],
            })

        # si no hay nuevos y es el primer arranque, fijar al tope actual
        if not rows and (since_id is None or since_id == 0):
            cur.execute("SELECT COALESCE(MAX(msg_id),0) FROM inv.incidencia_mensajes")
            last_id = int(cur.fetchone()[0] or 0)

        return {"items": items, "last_id": last_id}
