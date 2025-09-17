from app.db import get_conn

def add_media(app_user: str, item_id: int, path: str, es_principal: bool, orden: int|None):
    with get_conn(app_user) as (conn, cur):
        cur.execute("CALL inv.sp_item_agregar_foto(%s,%s,%s,%s)",
                    (str(item_id), path, es_principal, orden))
