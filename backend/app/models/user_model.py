# backend/app/models/user_model.py
from typing import Optional, Tuple, List, Dict
from app.db import get_conn

# ---------- util: mapeos de rol ----------
def _ui_to_db_role(rol_ui: str) -> str:
    """
    Roles visibles en UI: ADMIN | USUARIO | PRACTICANTE
    En BD: ADMIN | USUARIOS | PRACTICANTE
    """
    r = (rol_ui or "").strip().upper()
    if r == "USUARIO":
        return "USUARIOS"
    if r in ("ADMIN", "PRACTICANTE"):
        return r
    # por defecto no válido → lo retornamos tal cual
    return r

def _db_to_ui_role(rol_db: str) -> str:
    """
    ADMIN | USUARIOS | PRACTICANTE  ->  ADMIN | USUARIO | PRACTICANTE
    """
    r = (rol_db or "").strip().upper()
    if r == "USUARIOS":
        return "USUARIO"
    return r

def _role_id(cur, rol_nombre_ui: str) -> Optional[int]:
    rol_db = _ui_to_db_role(rol_nombre_ui)
    cur.execute("SELECT rol_id FROM inv.roles WHERE rol_nombre=%s", (rol_db,))
    row = cur.fetchone()
    return int(row[0]) if row else None

# ---------- LOGIN ----------
def login_and_check(username: str, password: str):
    """
    Permite login a cualquier usuario ACTIVO (ADMIN, PRACTICANTE, USUARIO).
    La autorización fina se aplica con decoradores por ruta.
    """
    with get_conn(username) as (conn, cur):
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

        user_id, uname, area_id, rol_db, activo, hashpwd = row

        # Verificar contraseña
        cur.execute("SELECT %s = crypt(%s, %s)", (hashpwd, password, hashpwd))
        ok_pwd = cur.fetchone()[0]
        if not ok_pwd:
            return None, "Contraseña incorrecta"

        if not activo:
            return None, "Usuario desactivado"

        rol_ui = _db_to_ui_role(rol_db)

        # Último login
        cur.execute("UPDATE inv.usuarios SET usuario_ultimo_login = now() WHERE usuario_id=%s", (user_id,))

    return {"id": user_id, "username": uname, "area_id": area_id, "rol": rol_ui}, None


# ---------- CRUD ----------
def list_users(app_user: str, q: Optional[str] = None) -> List[Dict]:
    where = []
    params: List = []
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
        "id": r[0],
        "username": r[1],
        "activo": r[2],
        "area_id": r[3],
        "rol": _db_to_ui_role(r[4]),
        "ultimo_login": r[5]
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
    if not r:
        return None
    return {
        "id": r[0],
        "username": r[1],
        "activo": r[2],
        "area_id": r[3],
        "rol": _db_to_ui_role(r[4]),
        "ultimo_login": r[5]
    }

def create_user(app_user: str, username: str, password: str, rol_ui: str, area_id: int) -> Tuple[Optional[int], Optional[str]]:
    with get_conn(app_user) as (conn, cur):
        rid = _role_id(cur, rol_ui)
        if not rid:
            return None, "Rol inexistente"

        try:
            cur.execute("""
              INSERT INTO inv.usuarios(usuario_username, usuario_password_bcrypt, rol_id, usuario_area_id, usuario_activo)
              VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, true)
              RETURNING usuario_id
            """, (username, password, rid, area_id))
            new_id = cur.fetchone()[0]
            return int(new_id), None
        except Exception as e:
            return None, f"No se pudo crear usuario: {e}"

def update_user(app_user: str, user_id: int, data: dict) -> Optional[str]:
    sets, params = [], []

    if "password" in data and data["password"]:
        sets.append("usuario_password_bcrypt = crypt(%s, gen_salt('bf'))")
        params.append(data["password"])

    if "rol" in data and data["rol"]:
        # viene en UI: ADMIN | USUARIO | PRACTICANTE
        rol_ui = str(data["rol"]).upper()
        with get_conn(app_user) as (conn, cur):
            rid = _role_id(cur, rol_ui)
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


# ---------- Auto-usuario de equipos (ROL BD = USUARIOS) ----------
def ensure_user_for_equipo(app_user: str,
                           username: Optional[str],
                           raw_password: Optional[str],
                           area_id: Optional[int]) -> None:
    """
    Crea/actualiza un usuario para un equipo con ROL BD = 'USUARIOS'.
    - Si username es vacío/None, no hace nada.
    - Si existe, actualiza password (si viene) y area_id (si viene) y fuerza rol 'USUARIOS'.
    - Si no existe, lo crea con rol 'USUARIOS'.
    """
    uname = (username or "").strip()
    if not uname:
        return

    with get_conn(app_user) as (conn, cur):
        # Asegurar rol BD = USUARIOS (¡OJO! no 'USUARIO')
        cur.execute("SELECT rol_id FROM inv.roles WHERE rol_nombre = 'USUARIOS'")
        r = cur.fetchone()
        if not r:
            # Respeta el CHECK de roles (ADMIN,PRACTICANTE,USUARIOS)
            cur.execute("INSERT INTO inv.roles(rol_nombre) VALUES ('USUARIOS') RETURNING rol_id")
            rid = int(cur.fetchone()[0])
        else:
            rid = int(r[0])

        # ¿existe el usuario?
        cur.execute("SELECT usuario_id FROM inv.usuarios WHERE usuario_username = %s", (uname,))
        row = cur.fetchone()

        if row:
            uid = int(row[0])
            sets = ["rol_id=%s"]
            params: List = [rid]

            if raw_password:
                sets.append("usuario_password_bcrypt = crypt(%s, gen_salt('bf'))")
                params.append(raw_password)

            if area_id is not None:
                sets.append("usuario_area_id = %s")
                params.append(int(area_id))

            params.append(uid)
            cur.execute(f"UPDATE inv.usuarios SET {', '.join(sets)} WHERE usuario_id=%s", params)
        else:
            cur.execute("""
              INSERT INTO inv.usuarios(
                usuario_username, usuario_password_bcrypt, rol_id, usuario_area_id, usuario_activo
              ) VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, true)
            """, (uname, raw_password or uname, rid, int(area_id) if area_id is not None else None))
