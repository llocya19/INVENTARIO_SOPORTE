# backend/app/models/user_model.py
from typing import Optional, Tuple
from app.db import get_conn

SQL_LOGIN = """
SELECT u.usuario_id, u.usuario_username, u.usuario_area_id, r.rol_nombre
FROM inv.usuarios u
JOIN inv.roles r ON r.rol_id = u.rol_id
WHERE u.usuario_username = %s
  AND u.usuario_password_bcrypt = crypt(%s, u.usuario_password_bcrypt)
  AND COALESCE(u.usuario_activo, true) = true
"""

SQL_CHECK_SOPORTE_OR_ADMIN = """
WITH RECURSIVE anc AS (
  SELECT a.area_id, a.area_padre_id, a.area_nombre
  FROM inv.areas a WHERE a.area_id = %s
  UNION ALL
  SELECT p.area_id, p.area_padre_id, p.area_nombre
  FROM inv.areas p JOIN anc ON p.area_id = anc.area_padre_id
)
SELECT (EXISTS (
  SELECT 1 FROM anc WHERE lower(area_nombre)='soporte' AND area_padre_id IS NULL
)) OR (%s = 'ADMIN') AS ok;
"""

def login_and_check(username: str, password: str):
    with get_conn() as (conn, cur):
        # 1) Traigo info del usuario por username (sin chequear activo/clave aún)
        cur.execute("""
          SELECT u.usuario_id, u.usuario_username, u.usuario_area_id, r.rol_nombre,
                 COALESCE(u.usuario_activo, true) AS activo,
                 u.usuario_password_bcrypt
          FROM inv.usuarios u
          JOIN inv.roles r ON r.rol_id = u.rol_id
          WHERE u.usuario_username = %s
        """, (username,))
        row = cur.fetchone()
        if not row:
            return None, "Usuario no existe"
        user_id, uname, area_id, rol, activo, hashpwd = row

        # 2) Verifico contraseña con crypt(hash)
        cur.execute("SELECT %s = crypt(%s, %s)", (hashpwd, password, hashpwd))
        ok_pwd = cur.fetchone()[0]
        if not ok_pwd:
            return None, "Contraseña incorrecta"

        # 3) Chequeo activo
        if not activo:
            return None, "Usuario desactivado"

        # 4) Permisos (Soporte raíz o ADMIN)
        cur.execute(SQL_CHECK_SOPORTE_OR_ADMIN, (area_id, rol))
        ok = cur.fetchone()[0]
        if not ok:
            return None, "Acceso permitido solo a Soporte o ADMIN"

        # 5) Último login
        cur.execute("UPDATE inv.usuarios SET usuario_ultimo_login = now() WHERE usuario_id=%s", (user_id,))
    return {"id": user_id, "username": uname, "area_id": area_id, "rol": rol}, None



# ---------- CRUD ----------

def list_users(app_user: str, q: Optional[str] = None) -> list:
    where = []
    params = []
    if q:
        where.append("(u.usuario_username ILIKE %s)")
        params.append(f"%{q}%")

    SQL = f"""
    SELECT u.usuario_id, u.usuario_username, u.usuario_activo, u.usuario_area_id,
           r.rol_nombre, u.usuario_ultimo_login
    FROM inv.usuarios u
    JOIN inv.roles r ON r.rol_id=u.rol_id
    {"WHERE " + " AND ".join(where) if where else ""}
    ORDER BY u.usuario_id DESC
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, params)
        rows = cur.fetchall()
    return [{
        "id": r[0], "username": r[1], "activo": r[2],
        "area_id": r[3], "rol": r[4], "ultimo_login": r[5]
    } for r in rows]

def get_user_by_id(app_user: str, user_id: int) -> Optional[dict]:
    SQL = """
    SELECT u.usuario_id, u.usuario_username, u.usuario_activo, u.usuario_area_id,
           r.rol_nombre, u.usuario_ultimo_login
    FROM inv.usuarios u
    JOIN inv.roles r ON r.rol_id=u.rol_id
    WHERE u.usuario_id=%s
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, (user_id,))
        r = cur.fetchone()
    if not r: return None
    return {
        "id": r[0], "username": r[1], "activo": r[2],
        "area_id": r[3], "rol": r[4], "ultimo_login": r[5]
    }

def _role_id(cur, rol_nombre: str) -> Optional[int]:
    cur.execute("SELECT rol_id FROM inv.roles WHERE rol_nombre=%s", (rol_nombre,))
    row = cur.fetchone()
    return row[0] if row else None

def create_user(app_user: str, username: str, password: str, rol: str, area_id: int) -> Tuple[Optional[int], Optional[str]]:
    with get_conn(app_user) as (conn, cur):
        rid = _role_id(cur, rol)
        if not rid:
            return None, "Rol inexistente"

        try:
            cur.execute("""
              INSERT INTO inv.usuarios(usuario_username, usuario_password_bcrypt, rol_id, usuario_area_id, usuario_activo)
              VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, true)
              RETURNING usuario_id
            """, (username, password, rid, area_id))
            new_id = cur.fetchone()[0]
            return new_id, None
        except Exception as e:
            # UNIQUE constraint u.usuario_username, FK de area, o check de bcrypt
            return None, f"No se pudo crear usuario: {e}"

def update_user(app_user: str, user_id: int, data: dict) -> Optional[str]:
    sets, params = [], []

    if "password" in data and data["password"]:
        sets.append("usuario_password_bcrypt = crypt(%s, gen_salt('bf'))")
        params.append(data["password"])

    if "rol" in data and data["rol"]:
        rol = str(data["rol"]).upper()
        with get_conn(app_user) as (conn, cur):
            rid = _role_id(cur, rol)
        if not rid:
            return "Rol inválido"
        sets.append("rol_id = %s")
        params.append(rid)

    if "area_id" in data and data["area_id"] is not None:
        sets.append("usuario_area_id = %s")
        params.append(int(data["area_id"]))

    if "activo" in data:
        sets.append("usuario_activo = %s")
        params.append(bool(data["activo"]))

    if not sets:
        return None

    params.append(user_id)
    SQL = "UPDATE inv.usuarios SET " + ", ".join(sets) + " WHERE usuario_id=%s"

    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute(SQL, params)
        except Exception as e:
            return f"No se pudo actualizar: {e}"
    return None

def delete_user(app_user: str, user_id: int) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("DELETE FROM inv.usuarios WHERE usuario_id=%s", (user_id,))
        except Exception as e:
            return f"No se pudo eliminar: {e}"
    return None
