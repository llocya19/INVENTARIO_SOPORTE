// src/api/loans.ts
import http from "./http";

/** Registra el préstamo de un ítem hacia un área destino. */
export async function prestarItem(
  itemId: number,
  destinoAreaId: number,
  detalle: Record<string, any> = {}
) {
  const { data } = await http.post(`/api/items/${itemId}/prestar`, {
    destino_area_id: destinoAreaId,
    detalle,
  });
  // Backend devuelve { ok: true } o { error: "..." }
  if (data?.ok === true) return true;
  throw new Error(data?.error || "No se pudo registrar el préstamo");
}

/** Registra la devolución del préstamo de un ítem. */
export async function devolverItem(itemId: number, detalle: Record<string, any> = {}) {
  const { data } = await http.post(`/api/items/${itemId}/devolver`, { detalle });
  if (data?.ok === true) return true;
  throw new Error(data?.error || "No se pudo registrar la devolución");
}

/** Lista préstamos de un área (activos=true por defecto). */
export async function listarPrestamosDeArea(areaId: number, activos = true, page = 1, size = 10) {
  const { data } = await http.get(`/api/areas/${areaId}/prestamos`, {
    params: { activos, page, size },
  });
  return data;
}
