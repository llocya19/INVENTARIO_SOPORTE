# backend/app/db.py
from contextlib import contextmanager
from typing import Optional, Tuple
from psycopg_pool import ConnectionPool
from .config import Settings

# Pool (psycopg3)
pool = ConnectionPool(
    conninfo=Settings.DATABASE_URL,
    min_size=1,
    max_size=10,
    open=True,
)

def _set_app_user_local(cur, username: Optional[str]):
    """
    Deja app.user como LOCAL a la transacción actual.
    Usamos set_config(..., true) para scope local.
    """
    if username:
        cur.execute("SELECT set_config('app.user', %s, true);", (username,))
    else:
        # Si quisieras limpiar explícitamente:
        # cur.execute("SELECT set_config('app.user', '', true);")
        pass

@contextmanager
def get_conn(app_user: Optional[str] = None) -> Tuple:
    """
    Entrega (conn, cur) listo para usar. Maneja commit/rollback automáticamente.
    Si se pasa app_user, se setea 'app.user' LOCAL en la transacción para auditoría.
    """
    with pool.connection() as conn:
        cur = conn.cursor()
        try:
            if app_user:
                _set_app_user_local(cur, app_user)
            yield conn, cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
