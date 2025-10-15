// src/services/authService.ts
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function login(username: string, password: string) {
  const { data } = await axios.post(`${API}/api/auth/login`, { username, password });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  // Roles válidos: ADMIN | USUARIO | PRACTICANTE
  return data.user as { id: number; username: string; rol: "ADMIN" | "USUARIO" | "PRACTICANTE"; area_id: number };
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getToken() {
  return localStorage.getItem("token") || "";
}

// Parseo robusto del usuario en localStorage
export function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.username === "string" &&
      ["ADMIN", "USUARIO", "PRACTICANTE"].includes(parsed.rol)
    ) {
      return parsed as { id: number; username: string; rol: "ADMIN" | "USUARIO" | "PRACTICANTE"; area_id: number };
    }
  } catch {}
  localStorage.removeItem("user");
  return null;
}
