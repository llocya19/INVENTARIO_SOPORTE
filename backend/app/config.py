import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/inventario_pro",
    )

    CORS_ORIGINS: str = (
        os.getenv("API_CORS_ORIGINS")
        or os.getenv("CORS_ORIGINS")
        or "http://localhost:5173,http://127.0.0.1:5173"
    )

    @staticmethod
    def cors_list() -> list[str]:
        raw = (
            os.getenv("API_CORS_ORIGINS")
            or os.getenv("CORS_ORIGINS")
            or "http://localhost:5173,http://127.0.0.1:5173"
        )
        return [o.strip() for o in raw.split(",") if o.strip()]
