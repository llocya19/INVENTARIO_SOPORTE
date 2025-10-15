# app/models/media_model.py
from typing import Optional
from app.db import get_conn
from psycopg.types.json import Json  # si lo usas en otros módulos, no estorba aquí


def add_media(
    app_user: str,
    item_id: int,
    path: str,
    es_principal: bool = False,
    orden: Optional[int] = None
) -> Optional[str]:
    """
    Inserta media usando el SP que espera *item_codigo*:
      CALL inv.sp_item_agregar_foto(p_item_codigo, p_path, p_principal, p_orden)

    Devuelve None si OK, o string con el error.
    """
    with get_conn(app_user) as (conn, cur):
        # 1) obtener item_codigo
        cur.execute("SELECT item_codigo FROM inv.items WHERE item_id=%s", (item_id,))
        r = cur.fetchone()
        if not r:
            return f"Item {item_id} no existe"
        item_codigo = r[0]

        # 2) llamar al SP
        try:
            cur.execute(
                "CALL inv.sp_item_agregar_foto(%s,%s,%s,%s)",
                (item_codigo, path, es_principal, orden)
            )
        except Exception as e:
            return f"No se pudo registrar la imagen: {e}"
    return None


def delete_media(app_user: str, item_id: int, path: str) -> Optional[str]:
    """
    Elimina la imagen del item en inv.item_media usando la columna 'path'.
    Devuelve None si se eliminó; string con error si no se encontró o falló.
    """
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute(
                """
                DELETE FROM inv.item_media
                 WHERE item_id = %s
                   AND path    = %s
                 RETURNING 1
                """,
                (item_id, path),
            )
            row = cur.fetchone()
            if row:
                return None
            return "No se encontró la imagen para eliminar"
        except Exception as e:
            return f"Error al eliminar imagen: {e}"
