# backend/app/models/equipo_model.py
from typing import List, Dict, Any, Optional
from app.db import get_conn

def list_area_equipos(app_user: str, area_id: int) -> List[Dict[str, Any]]:
    """
    Lista equipos del área con fechas (creado/actualizado).
    Si tu tabla inv.equipos no tiene 'estado' o 'updated_at', los calculamos en NULL-safe.
    """
    SQL = """
    SELECT
      e.equipo_id,
      e.equipo_codigo,
      e.equipo_nombre,
      COALESCE(e.estado, 'EN_USO') AS estado,
      e.usuario_final,
      e.created_at,
      e.updated_at
    FROM inv.equipos e
    WHERE e.area_id = %s
    ORDER BY lower(e.equipo_codigo)
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

def create_equipo(app_user: str, codigo: str, nombre: str, area_id: int,
                  estado: str = "EN_USO", usuario_final: Optional[str] = None) -> int:
    SQL = """
      INSERT INTO inv.equipos (equipo_codigo, equipo_nombre, area_id, estado, usuario_final)
      VALUES (%s,%s,%s,%s,%s)
      RETURNING equipo_id
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, (codigo, nombre, area_id, estado, usuario_final))
        row = cur.fetchone()
        return int(row[0])

def get_equipo_header(app_user: str, equipo_id: int) -> Optional[Dict[str, Any]]:
    SQL = """
      SELECT equipo_id, equipo_codigo, equipo_nombre, area_id, estado, usuario_final,
             created_at, updated_at
      FROM inv.equipos WHERE equipo_id=%s
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, (equipo_id,))
        r = cur.fetchone()
        if not r: return None
    return {
        "equipo_id": r[0], "equipo_codigo": r[1], "equipo_nombre": r[2], "area_id": r[3],
        "estado": r[4], "usuario_final": r[5], "created_at": r[6], "updated_at": r[7]
    }

def get_equipo_detalle(app_user: str, equipo_id: int) -> Optional[Dict[str, Any]]:
    """
    Devuelve equipo + items asignados (con clase, tipo, codigo, estado) para mostrar y gestionar.
    """
    header = get_equipo_header(app_user, equipo_id)
    if not header: return None

    SQL = """
      SELECT i.item_id, i.item_codigo, it.clase, it.nombre AS tipo, i.estado
      FROM inv.equipo_items ei
      JOIN inv.items i      ON i.item_id = ei.item_id
      JOIN inv.item_tipos it ON it.item_tipo_id = i.item_tipo_id
      WHERE ei.equipo_id = %s
      ORDER BY CASE WHEN it.clase='COMPONENTE' THEN 0 ELSE 1 END, lower(it.nombre), lower(i.item_codigo)
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

def assign_items(app_user: str, equipo_id: int, item_ids: List[int]):
    """
    Asigna varios items a un equipo.
    Si tienes SPs 'inv.sp_asignar_item_a_equipo', puedes llamarlos por item_codigo;
    aquí lo hacemos directo y además marcamos el estado del ítem como EN_USO.
    """
    with get_conn(app_user) as (conn, cur):
        # validar equipo
        cur.execute("SELECT equipo_codigo FROM inv.equipos WHERE equipo_id=%s", (equipo_id,))
        if not cur.fetchone():
            raise Exception("Equipo no existe")

        for iid in item_ids:
            # evitar duplicados
            cur.execute("SELECT 1 FROM inv.equipo_items WHERE equipo_id=%s AND item_id=%s", (equipo_id, iid))
            if cur.fetchone(): 
                continue
            cur.execute("INSERT INTO inv.equipo_items(equipo_id, item_id) VALUES (%s,%s)", (equipo_id, iid))
            # poner ítem en uso
            cur.execute("UPDATE inv.items SET estado='EN_USO', updated_at = NOW() WHERE item_id=%s", (iid,))

def unassign_item(app_user: str, equipo_id: int, item_id: int):
    with get_conn(app_user) as (conn, cur):
        cur.execute("DELETE FROM inv.equipo_items WHERE equipo_id=%s AND item_id=%s", (equipo_id, item_id))
        # devolver a ALMACEN
        cur.execute("UPDATE inv.items SET estado='ALMACEN', updated_at = NOW() WHERE item_id=%s", (item_id,))

def update_equipo_meta(app_user: str, equipo_id: int,
                       nombre: Optional[str]=None,
                       estado: Optional[str]=None,
                       usuario_final: Optional[str]=None):
    pieces = []
    params = []
    if nombre is not None:
        pieces.append("equipo_nombre=%s"); params.append(nombre)
    if estado is not None:
        pieces.append("estado=%s"); params.append(estado)
    if usuario_final is not None:
        pieces.append("usuario_final=%s"); params.append(usuario_final)
    if not pieces: return
    sql = "UPDATE inv.equipos SET " + ", ".join(pieces) + ", updated_at=NOW() WHERE equipo_id=%s"
    params.append(equipo_id)
    with get_conn(app_user) as (conn, cur):
        cur.execute(sql, params)
