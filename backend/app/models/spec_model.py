from app.db import get_conn

def get_attrs_for_type(app_user: str, clase: str, tipo_nombre: str):
    with get_conn(app_user) as (conn, cur):
        cur.execute("""
          SELECT sa.nombre_attr, sa.data_type, sa.orden
          FROM inv.spec_atributos sa
          JOIN inv.item_tipos it ON it.item_tipo_id = sa.item_tipo_id
          WHERE it.clase = %s AND lower(it.nombre)=lower(%s)
          ORDER BY sa.orden NULLS LAST, lower(sa.nombre_attr)
        """, (clase, tipo_nombre))
        rows = cur.fetchall()
        return [{"nombre": r[0], "data_type": r[1], "orden": r[2]} for r in rows]

def define_attr(app_user: str, clase: str, tipo_nombre: str, nombre_attr: str, data_type: str):
    with get_conn(app_user) as (conn, cur):
        cur.execute("CALL inv.sp_definir_atributo(%s,%s,%s,%s,NULL)",
                    (clase, tipo_nombre, nombre_attr, data_type))
