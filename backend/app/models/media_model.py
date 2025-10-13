# app/models/media_model.py
from typing import Optional
from app.db import get_conn
from psycopg.types.json import Json  # por si tu driver lo requiere en otros módulos

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
    Elimina el registro de media del ítem.
    - Primero intenta en inv.item_fotos(foto_url)
    - Si no existe o no borra, intenta en inv.item_media(path)

    Devuelve None si OK; string de error en caso contrario.
    """
    with get_conn(app_user) as (conn, cur):
        # ¿Existe tabla item_fotos?
        try:
            cur.execute("""
                SELECT 1
                  FROM information_schema.tables
                 WHERE table_schema='inv' AND table_name='item_fotos'
            """)
            has_fotos = cur.fetchone() is not None
        except Exception:
            has_fotos = False

        if has_fotos:
            # Intenta borrar por foto_url
            cur.execute("""
                DELETE FROM inv.item_fotos
                 WHERE item_id=%s AND foto_url=%s
                 RETURNING 1
            """, (item_id, path))
            if cur.fetchone():
                return None  # borrado OK

        # ¿Existe tabla item_media?
        try:
            cur.execute("""
                SELECT 1
                  FROM information_schema.tables
                 WHERE table_schema='inv' AND table_name='item_media'
            """)
            has_media = cur.fetchone() is not None
        except Exception:
            has_media = False

        if has_media:
            cur.execute("""
                DELETE FROM inv.item_media
                 WHERE item_id=%s AND path=%s
                 RETURNING 1
            """, (item_id, path))
            if cur.fetchone():
                return None  # borrado OK

        # Si ninguna borró, reportar
        return "Imagen no encontrada o no se pudo eliminar"
