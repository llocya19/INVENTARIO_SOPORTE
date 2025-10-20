import http from "../api/http";

type Role = "ADMIN" | "USUARIO" | "PRACTICANTE";
type User = { id: number; username: string; rol: Role; area_id: number | null };

const TOKEN_KEY = "auth_token";
const USER_KEY  = "auth_user";

export async function login(username: string, password: string) {
  // usa el mismo baseURL que http (interceptor no mete token aún)
  const { data } = await http.post<{ token: string; user: User }>("/api/auth/login", { username, password });
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.username === "string" &&
      ["ADMIN", "USUARIO", "PRACTICANTE"].includes(parsed.rol)
    ) {
      return parsed as User;
    }
  } catch {
    /* ignore */
  }
  // si está corrupto, lo limpiamos
  localStorage.removeItem(USER_KEY);
  return null;
}
