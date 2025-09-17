from dataclasses import dataclass
from typing import Optional, Dict, Any, Literal

Clase = Literal["COMPONENTE", "PERIFERICO"]

@dataclass
class ItemCrear:
    codigo: str
    clase: Clase
    tipo: str          # nombre del tipo ej: 'MEMORIA'
    area: str          # área raíz ej: 'Soporte'
    ficha: Dict[str, Any]

    def to_dict(self) -> dict:
        return {
            "codigo": self.codigo,
            "clase": self.clase,
            "tipo": self.tipo,
            "area": self.area,
            "ficha": self.ficha,
        }
