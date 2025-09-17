import { api, safe } from "../utils/api";
import type { Clase } from "./tipos";

export interface ItemAlmacenRow {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string;
  area_id: number;
  area_nombre: string;
}

export const crearItem = (payload: {
  codigo: string;
  clase: Clase;
  tipo: string;
  area: string;              // área raíz
  ficha: Record<string, any>;
}) => safe<{ codigo: string }>(api.post("/api/items/crear", payload));

export const itemsAlmacen = () => safe<ItemAlmacenRow[]>(api.get("/api/items/almacen"));
export const itemsUso     = () => safe<any[]>(api.get("/api/items/uso"));
export const fichaItem    = (codigo: string) => safe<any>(api.get(`/api/items/ficha/${codigo}`));
