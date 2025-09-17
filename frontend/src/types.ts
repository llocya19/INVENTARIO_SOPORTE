// frontend/src/types.ts
export const CLASES = ["COMPONENTE", "PERIFERICO"] as const;
export type Clase = typeof CLASES[number];

// Modelos útiles (opcionales pero recomendados)
export type ItemAlmacen = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: "ALMACEN";
  area_id: number;
  area_nombre: string;
};

export type ItemUso = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: "EN_USO";
  equipo_codigo: string | null;
  slot_o_ubicacion: string | null;
  area_id: number;
  area_nombre: string;
};

export type FichaItem = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string;
  area: string;
  equipo_codigo: string | null;
  slot_o_ubicacion: string | null;
  ficha: Record<string, unknown> | null;
};
