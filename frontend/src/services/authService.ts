// src/services/auhtService.ts
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function login(username: string, password: string) {
  const { data } = await axios.post(`${API}/api/auth/login`, { username, password });
  // data.user DEBE ser un objeto; lo guardamos como JSON
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.user as { id:number; username:string; rol:"ADMIN"|"SOPORTE"|"PRACTICANTE"; area_id:number };
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getToken() {
  return localStorage.getItem("token") || "";
}

// 👇 versión tolerante a “basura” previa en localStorage
export function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // validamos estructura mínima
    if (parsed && typeof parsed === "object" && "username" in parsed && "rol" in parsed) {
      return parsed;
    }
    // si no tiene forma correcta, limpieza defensiva
    localStorage.removeItem("user");
    return null;
  } catch {
    // si era "admin" o cualquier cosa no-JSON
    localStorage.removeItem("user");
    return null;
  }
}
