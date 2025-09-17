import { api, safe } from "../utils/api";

// ===== Tipos públicos que consumirán tus páginas =====
export type Clase = "COMPONENTE" | "PERIFERICO";
export type DataType = "text" | "int" | "numeric" | "bool" | "date";

export interface TipoRow {
  item_tipo_id: number;
  clase: Clase;
  nombre: string;
}

export interface AtributoRow {
  attr_id: number;
  nombre_attr: string;
  data_type: DataType;
  orden: number | null;
}

// ===== Llamadas al backend con tipado en data =====
export const getTipos = (clase?: Clase) =>
  safe<TipoRow[]>(api.get("/api/tipos/list", { params: { clase } }));

export const getAtributos = (clase: Clase, nombre: string) =>
  safe<AtributoRow[]>(api.get("/api/tipos/attrs", { params: { clase, nombre } }));

export const postTipo = (clase: Clase, nombre: string) =>
  safe<{ definido: boolean }>(api.post("/api/tipos/definir", { clase, nombre }));

export const postAtributo = (
  clase: Clase,
  tipo_nombre: string,
  nombre_attr: string,
  data_type: DataType,
  orden?: number
) =>
  safe<{ definido: boolean }>(
    api.post("/api/tipos/attrs/definir", { clase, tipo_nombre, nombre_attr, data_type, orden })
  );
