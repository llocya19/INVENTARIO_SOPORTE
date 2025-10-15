# backend/app/config.py
import os
from dataclasses import dataclass

# Carga .env si está instalado python-dotenv (opcional, no rompe si no está)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

@dataclass(frozen=True)
class Settings:
    # --- Base de datos ---
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/inventario_pro",
    )

    # --- CORS ---
    CORS_ORIGINS: str = (
        os.getenv("API_CORS_ORIGINS")
        or os.getenv("CORS_ORIGINS")
        or "http://localhost:5173,http://127.0.0.1:5173"
    )

    # --- Mail ---
    MAIL_HOST: str = os.getenv("MAIL_HOST", "")
    MAIL_PORT: int = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USERNAME: str = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD", "")
    MAIL_FROM: str = os.getenv("MAIL_FROM", "")
    MAIL_ADMIN_TO: str = os.getenv("MAIL_ADMIN_TO", "")
    MAIL_USE_TLS: bool = os.getenv("MAIL_USE_TLS", "true").lower() in ("1", "true", "yes", "y")
    MAIL_USE_SSL: bool = os.getenv("MAIL_USE_SSL", "false").lower() in ("1", "true", "yes", "y")

    @staticmethod
    def cors_list() -> list[str]:
        raw = (
            os.getenv("API_CORS_ORIGINS")
            or os.getenv("CORS_ORIGINS")
            or "http://localhost:5173,http://127.0.0.1:5173"
        )
        return [o.strip() for o in raw.split(",") if o.strip()]

    def normalized(self):
        """
        Devuelve una copia con TLS/SSL consistentes:
        - Si MAIL_USE_SSL es True, fuerza puerto 465 y desactiva TLS.
        - En caso contrario, usa TLS (puerto 587).
        """
        use_ssl = self.MAIL_USE_SSL
        port = self.MAIL_PORT
        use_tls = self.MAIL_USE_TLS

        if use_ssl:
            port = 465
            use_tls = False
        else:
            if port == 465:  # si alguien puso 465 pero sin SSL, lo pasamos a 587 con TLS
                port = 587
            use_tls = True

        # Retorna un dict simple para leerlo fácil desde otros módulos
        return {
            "MAIL_HOST": self.MAIL_HOST,
            "MAIL_PORT": port,
            "MAIL_USERNAME": self.MAIL_USERNAME,
            "MAIL_PASSWORD": self.MAIL_PASSWORD,
            "MAIL_FROM": self.MAIL_FROM or self.MAIL_USERNAME,
            "MAIL_ADMIN_TO": self.MAIL_ADMIN_TO or self.MAIL_USERNAME,
            "MAIL_USE_TLS": use_tls,
            "MAIL_USE_SSL": use_ssl,
        }

# Instancia global práctica (opcional)
settings = Settings()
