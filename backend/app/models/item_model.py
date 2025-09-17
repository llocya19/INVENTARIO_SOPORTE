# backend/app/models/item_model.py
from typing import Optional, Dict, Any
from psycopg.types.json import Json 
from app.db import get_conn

def list_item_types(app_user: str, clase: Optional[str] = None):
    sql = "SELECT item_tipo_id, clase, nombre FROM inv.item_tipos"
    params = []
    if clase:
        sql += " WHERE clase = %s"
        params.append(clase)
    sql += " ORDER BY clase, lower(nombre)"
    with get_conn(app_user) as (conn, cur):
        cur.execute(sql, params)
        rows = cur.fetchall()
    return [{"id": r[0], "clase": r[1], "nombre": r[2]} for r in rows]

def create_item_with_specs(app_user: str, codigo: str, clase: str, tipo_nombre: str,
                           area_raiz_nombre: str, specs: dict) -> int:
    with get_conn(app_user) as (conn, cur):
        # 👇 nota el ::jsonb en el último placeholder
        cur.execute(
            "CALL inv.sp_crear_item_con_ficha(%s,%s,%s,%s,%s::jsonb)",
            (codigo, clase, tipo_nombre, area_raiz_nombre, Json(specs))
        )
        cur.execute("SELECT item_id FROM inv.items WHERE item_codigo=%s", (codigo,))
        row = cur.fetchone()
        if not row:
            raise Exception("No se pudo crear el ítem (no se encontró item_id)")
        return int(row[0])
def get_item_detail(app_user: str, item_id: int):
    sql = """
    SELECT item_id, item_codigo, clase, tipo, estado, area_id, area_nombre, ficha, fotos
    FROM inv.vw_items_con_ficha_y_fotos
    WHERE item_id = %s
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(sql, (item_id,))
        r = cur.fetchone()
        if not r: return None
    return {
        "item_id": r[0], "item_codigo": r[1], "clase": r[2], "tipo": r[3], "estado": r[4],
        "area_id": r[5], "area_nombre": r[6], "ficha": r[7] or {}, "fotos": r[8] or []
    }

def upsert_attribute_and_value(app_user: str, item_id: int, clase: str,
                               tipo_nombre: str, nombre_attr: str,
                               data_type: str, value: Any):
    """
    Asegura atributo con inv.sp_definir_atributo, luego inserta/actualiza en inv.spec_valores
    respetando el tipo de dato.
    """
    if data_type not in ("text","int","numeric","bool","date"):
        return "data_type inválido"
    with get_conn(app_user) as (conn, cur):
        # asegurar atributo
        cur.execute("CALL inv.sp_definir_atributo(%s,%s,%s,%s,NULL)",
                    (clase, tipo_nombre, nombre_attr, data_type))
        # obtener attr_id del tipo del item
        cur.execute("""
          SELECT sa.attr_id FROM inv.items i
          JOIN inv.item_tipos it ON it.item_tipo_id=i.item_tipo_id
          JOIN inv.spec_atributos sa ON sa.item_tipo_id=it.item_tipo_id
          WHERE i.item_id=%s AND lower(sa.nombre_attr)=lower(%s)
        """, (item_id, nombre_attr))
        row = cur.fetchone()
        if not row: return "No se obtuvo attr_id"
        attr_id = int(row[0])

        # upsert valor
        cur.execute("SELECT 1 FROM inv.spec_valores WHERE item_id=%s AND attr_id=%s", (item_id, attr_id))
        exists = cur.fetchone() is not None

        cols = {"text":"val_text","int":"val_int","numeric":"val_numeric","bool":"val_bool","date":"val_date"}[data_type]
        if exists:
            cur.execute(f"UPDATE inv.spec_valores SET {cols}=%s WHERE item_id=%s AND attr_id=%s", (value, item_id, attr_id))
        else:
            cur.execute(f"INSERT INTO inv.spec_valores(item_id, attr_id, {cols}) VALUES (%s,%s,%s)",
                        (item_id, attr_id, value))
    return None

def add_photo(app_user: str, item_id: int, url: str, es_principal: bool = False, orden: Optional[int] = None):
    with get_conn(app_user) as (conn, cur):
        cur.execute("SELECT item_codigo FROM inv.items WHERE item_id=%s", (item_id,))
        r = cur.fetchone()
        if not r: return "Item no existe"
        item_codigo = r[0]
        cur.execute("CALL inv.sp_item_agregar_foto(%s,%s,%s,%s)",
                    (item_codigo, url, es_principal, orden))
    return None


def suggest_next_code(app_user: str, clase: str, tipo_nombre: str, area_id: int) -> str:
    """
    Busca el último código para ese tipo en el área raíz y sugiere el siguiente.
    Formato: <TIPO><nnn> (p.ej. DISCO03). Si no hay números, empieza en 01.
    """
    with get_conn(app_user) as (conn, cur):
        # obtener área raíz por area_id
        cur.execute("""
          WITH RECURSIVE up AS (
            SELECT area_id, area_nombre, area_padre_id FROM inv.areas WHERE area_id=%s
            UNION ALL
            SELECT a.area_id, a.area_nombre, a.area_padre_id
            FROM inv.areas a JOIN up ON up.area_padre_id = a.area_id
          )
          SELECT area_nombre FROM up WHERE area_padre_id IS NULL LIMIT 1
        """, (area_id,))
        r = cur.fetchone()
        root_name = r[0] if r else None

        # id de tipo
        cur.execute("SELECT item_tipo_id FROM inv.item_tipos WHERE clase=%s AND lower(nombre)=lower(%s)",
                    (clase, tipo_nombre))
        t = cur.fetchone()
        if not t:
            # si el tipo no existe aún, sugerimos base
            return f"{tipo_nombre.upper()}01"
        tipo_id = int(t[0])

        # último código que empiece por el nombre del tipo
        prefix = tipo_nombre.upper()
        cur.execute("""
          SELECT i.item_codigo
          FROM inv.items i
          WHERE i.item_tipo_id=%s
          ORDER BY i.creado_en DESC
          LIMIT 50
        """, (tipo_id,))
        codes = [row[0] for row in cur.fetchall()]

    # extraer el último número visto tras el prefijo
    last_num = 0
    for c in codes:
        if c and c.upper().startswith(prefix):
            tail = c[len(prefix):]
            try:
                num = int("".join([ch for ch in tail if ch.isdigit()]) or "0")
                last_num = max(last_num, num)
            except ValueError:
                pass
    return f"{prefix}{last_num+1:02d}"
