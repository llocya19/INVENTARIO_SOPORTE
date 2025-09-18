from app.db import get_conn

def add_media(app_user: str, item_id: int, path: str, es_principal: bool, orden: int | None):
    """
    Inserta media usando el SP que espera *item_codigo*.
    """
    with get_conn(app_user) as (conn, cur):
        # 1) obtener item_codigo a partir de item_id
        cur.execute("SELECT item_codigo FROM inv.items WHERE item_id=%s", (item_id,))
        r = cur.fetchone()
        if not r:
            raise Exception(f"Item {item_id} no existe")
        item_codigo = r[0]

        # 2) llamar al SP (firma: (p_item_codigo text, p_path text, p_principal bool, p_orden int))
        cur.execute(
            "CALL inv.sp_item_agregar_foto(%s,%s,%s,%s)",
            (item_codigo, path, es_principal, orden)
        )


def delete_media(app_user: str, item_id: int, path: str) -> str | None:
    with get_conn(app_user) as (conn, cur):
        cur.execute(
            "DELETE FROM inv.item_media WHERE item_id=%s AND path=%s RETURNING 1",
            (item_id, path)
        )
        row = cur.fetchone()
        if not row:
            return "Imagen no encontrada"
    return None
