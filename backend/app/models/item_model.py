# app/models/item_model.py
from typing import Optional, Any, Dict, List
from psycopg.types.json import Json
from app.db import get_conn

# =========================
# Tipos de ítem
# =========================
def list_item_types(app_user: str, clase: Optional[str] = None) -> List[Dict[str, Any]]:
    sql = "SELECT item_tipo_id, clase, nombre FROM inv.item_tipos"
    params: List[Any] = []
    if clase:
        sql += " WHERE clase = %s"
        params.append(clase)
    sql += " ORDER BY clase, lower(nombre)"
    with get_conn(app_user) as (conn, cur):
        cur.execute(sql, params)
        rows = cur.fetchall()
    return [{"id": r[0], "clase": r[1], "nombre": r[2]} for r in rows]


def create_item_type(app_user: str, clase: str, nombre: str) -> int:
    if clase not in ("COMPONENTE", "PERIFERICO"):
        raise ValueError("clase inválida")
    with get_conn(app_user) as (conn, cur):
        cur.execute(
            """
            INSERT INTO inv.item_tipos(clase, nombre)
            VALUES (%s, %s)
            ON CONFLICT (clase, lower(nombre))
            DO UPDATE SET nombre = EXCLUDED.nombre
            RETURNING item_tipo_id
            """,
            (clase, nombre),
        )
        row = cur.fetchone()
        return int(row[0])

# =========================
# Crear ítem EN subárea (usa la nueva SP por area_id)
# =========================
def create_item_with_specs(
    app_user: str,
    codigo: str,
    clase: str,             # 'COMPONENTE' | 'PERIFERICO'
    tipo_nombre: str,       # ej. 'DISCO'
    area_id: int,           # subárea o raíz EXACTA
    specs: Dict[str, Any],
) -> int:
    with get_conn(app_user) as (conn, cur):
        cur.execute(
            "CALL inv.sp_crear_item_con_ficha_en_area_id(%s,%s,%s,%s,%s::jsonb)",
            (codigo, clase, tipo_nombre, int(area_id), Json(specs)),
        )
        cur.execute("SELECT item_id FROM inv.items WHERE item_codigo=%s", (codigo,))
        row = cur.fetchone()
        if not row:
            raise Exception("No se pudo crear el ítem (no se encontró item_id)")
        return int(row[0])

# =========================
# Detalle de ítem (vista)
# =========================
def get_item_detail(app_user: str, item_id: int) -> Optional[Dict[str, Any]]:
    sql = """
    SELECT item_id, item_codigo, clase, tipo, estado,
           area_id, area_nombre, ficha, fotos, created_at
    FROM inv.vw_items_con_ficha_y_fotos
    WHERE item_id = %s
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(sql, (item_id,))
        r = cur.fetchone()
        if not r:
            return None

    # --- Normaliza fotos: acepta lista de strings o dicts con url/path ---
    raw_fotos = r[8] or []
    fotos_norm: List[Dict[str, Any]] = []
    if isinstance(raw_fotos, list):
        for f in raw_fotos:
            if isinstance(f, str):
                if f.strip():
                    fotos_norm.append({"path": f.strip(), "principal": False, "orden": None})
            elif isinstance(f, dict):
                p = (f.get("path") or f.get("url") or "").strip()
                if p:
                    fotos_norm.append({
                        "path": p,
                        "principal": bool(f.get("principal", False)),
                        "orden": f.get("orden"),
                        "created_at": f.get("created_at"),
                    })
    # ---------------------------------------------------------------------

    return {
        "item_id": r[0],
        "item_codigo": r[1],
        "clase": r[2],
        "tipo": r[3],
        "estado": r[4],
        "area_id": r[5],
        "area_nombre": r[6],
        "ficha": r[7] or {},
        "fotos": fotos_norm,
        "created_at": r[9],
    }

# =========================
# Specs: upsert atributo y valor
# =========================
def upsert_attribute_and_value(
    app_user: str,
    item_id: int,
    clase: str,
    tipo_nombre: str,
    nombre_attr: str,
    data_type: str,
    value: Any,
) -> Optional[str]:
    if data_type not in ("text", "int", "numeric", "bool", "date"):
        return "data_type inválido"
    with get_conn(app_user) as (conn, cur):
        cur.execute("CALL inv.sp_definir_atributo(%s,%s,%s,%s,NULL)",
                    (clase, tipo_nombre, nombre_attr, data_type))

        cur.execute(
            """
            SELECT sa.attr_id
            FROM inv.items i
            JOIN inv.item_tipos it ON it.item_tipo_id = i.item_tipo_id
            JOIN inv.spec_atributos sa ON sa.item_tipo_id = it.item_tipo_id
            WHERE i.item_id = %s AND lower(sa.nombre_attr) = lower(%s)
            """,
            (item_id, nombre_attr),
        )
        row = cur.fetchone()
        if not row:
            return "No se obtuvo attr_id"
        attr_id = int(row[0])

        cur.execute("SELECT 1 FROM inv.spec_valores WHERE item_id=%s AND attr_id=%s",
                    (item_id, attr_id))
        exists = cur.fetchone() is not None

        col = {
            "text": "val_text",
            "int": "val_int",
            "numeric": "val_numeric",
            "bool": "val_bool",
            "date": "val_date",
        }[data_type]

        if exists:
            cur.execute(
                f"UPDATE inv.spec_valores SET {col}=%s WHERE item_id=%s AND attr_id=%s",
                (value, item_id, attr_id),
            )
        else:
            cur.execute(
                f"INSERT INTO inv.spec_valores(item_id, attr_id, {col}) VALUES (%s,%s,%s)",
                (item_id, attr_id, value),
            )
    return None

# =========================
# Fotos (media) → vía SP que recibe item_codigo
# =========================
def add_photo(
    app_user: str,
    item_id: int,
    url: str,
    es_principal: bool = False,
    orden: Optional[int] = None,
) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("SELECT item_codigo FROM inv.items WHERE item_id=%s", (item_id,))
        r = cur.fetchone()
        if not r:
            return "Item no existe"
        item_codigo = r[0]
        try:
            cur.execute(
                "CALL inv.sp_item_agregar_foto(%s,%s,%s,%s)",
                (item_codigo, url, es_principal, orden),
            )
        except Exception as e:
            return f"No se pudo registrar la foto: {e}"
    return None

def remove_photo(app_user: str, item_id: int, url_or_path: str) -> Optional[str]:
    """
    Borra el registro de foto por URL/Path exacto. Soporta columnas url o path.
    """
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("""
                DELETE FROM inv.item_fotos
                WHERE item_id = %s AND (url = %s OR path = %s)
            """, (item_id, url_or_path, url_or_path))
        except Exception as e:
            return f"No se pudo eliminar la foto en BD: {e}"
    return None

# =========================
# Sugerencia de código
# =========================
def suggest_next_code(app_user: str, clase: str, tipo_nombre: str, area_id: int) -> str:
    """
    Sugerir el siguiente 'item_codigo' para el par (clase, tipo_nombre) dentro de un area_id.
    Ejemplo: tipo_nombre='DISCO' -> DISCO01, DISCO02, ...
    """
    prefix = (tipo_nombre or "").strip().upper()  # prefijo textual del tipo

    with get_conn(app_user) as (conn, cur):
        # 1) Resolver item_tipo_id a partir de clase + tipo_nombre (case-insensitive)
        cur.execute("""
            SELECT it.item_tipo_id
            FROM inv.item_tipos it
            WHERE it.clase = %s AND lower(it.nombre) = lower(%s)
            LIMIT 1
        """, (clase, tipo_nombre))
        row = cur.fetchone()
        if not row:
            # Si no existe el tipo, devolvemos prefijo NN empezando en 01
            return f"{prefix}01"

        item_tipo_id = int(row[0])

        # 2) Tomar últimos codigos existentes para ESE tipo y ESA area
        #    - Primero ordenamos por creado_en DESC si existe, y respaldo por item_id DESC
        #    - Limit 200 para no traer demasiados (suficiente para calcular el último número)
        cur.execute("""
            SELECT i.item_codigo
            FROM inv.items i
            WHERE i.item_tipo_id = %s
              AND i.area_id = %s
            ORDER BY i.creado_en DESC NULLS LAST, i.item_id DESC
            LIMIT 200
        """, (item_tipo_id, int(area_id)))
        rows = cur.fetchall()

    # 3) Buscar el mayor sufijo numérico para códigos que empiezan con el prefijo
    last_num = 0
    if rows:
        for (code,) in rows:
            if not code:
                continue
            c = str(code).strip().upper()
            if not c.startswith(prefix):
                continue
            tail = c[len(prefix):]  # lo que viene después del prefijo
            # Extraer solo dígitos del tail (p.ej. '001', '12', 'A12' -> '12')
            digits = "".join(ch for ch in tail if ch.isdigit())
            if not digits:
                continue
            try:
                n = int(digits)
                if n > last_num:
                    last_num = n
            except ValueError:
                pass

    # 4) Siguiente número, con 2 dígitos (ajusta a 3 o más si quieres)
    return f"{prefix}{last_num + 1:02d}"
