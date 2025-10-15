// src/api/incidencias.ts
import http from "./http";

export type Incidencia = {
  inc_id: number;
  titulo: string;
  descripcion: string;
  estado: "ABIERTA" | "EN_PROCESO" | "CERRADA";
  equipo_id?: number | null;
  equipo_codigo?: string | null;
  area_id?: number | null;
  area_nombre?: string | null;
  created_at?: string;
};

/* ---------- LISTADOS ---------- */

export async function listarIncidencias(params: {
  estado?: string;
  area_id?: number;
  q?: string;
  page?: number;
  size?: number;
}) {
  const { data } = await http.get("/api/incidencias", { params });
  return data as { items: Incidencia[]; total: number; page: number; size: number };
}

// “Mis incidencias” usa el mismo endpoint (el backend filtra según rol)
export async function listarMisIncidencias(params: { page: number; size: number }) {
  const { data } = await http.get("/api/incidencias", { params });
  return data as { items: Incidencia[]; total: number; page: number; size: number };
}

/* ---------- CRUD / ACCIONES ---------- */

export async function crearIncidencia(payload: {
  titulo: string;
  descripcion: string;
  equipo_id?: number;
  email?: string; // reply-to para el admin
}) {
  const { data } = await http.post("/api/incidencias", payload);
  return data as { incidencia_id: number };
}

export async function obtenerIncidencia(id: number) {
  const { data } = await http.get(`/api/incidencias/${id}`);
  return data as Incidencia & { mensajes: { mensaje: string; usuario: string; created_at: string }[] };
}

export async function agregarMensaje(inc_id: number, cuerpo: string) {
  const { data } = await http.post(`/api/incidencias/${inc_id}/mensajes`, { cuerpo });
  return data as { ok: true };
}

// ADMIN: asignar practicante por username
export async function asignarPracticante(inc_id: number, username: string) {
  const { data } = await http.patch(`/api/incidencias/${inc_id}/asignar`, { username });
  return data as { ok: true };
}

// ADMIN / PRACTICANTE: cambiar estado
export async function cambiarEstado(
  inc_id: number,
  estado: Incidencia["estado"]
) {
  const { data } = await http.patch(`/api/incidencias/${inc_id}`, { estado });
  return data as { ok: true };
}
