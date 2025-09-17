import axios, { AxiosError } from "axios";

const baseURL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:5000";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    "X-App-User": import.meta.env.VITE_APP_USER || "admin",
  },
  withCredentials: false,
});

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; status?: number; details?: any };
export type ApiResult<T> = ApiOk<T> | ApiErr;

function toApiErr(error: any): ApiErr {
  if (axios.isAxiosError(error)) {
    const e = error as AxiosError<any>;
    const status = e.response?.status;
    const data = e.response?.data;
    const msg =
      (typeof data === "object" && (data?.error || data?.message)) ||
      e.message ||
      "Error de red";
    return { ok: false, error: msg, status, details: data };
  }
  return { ok: false, error: String(error) };
}

export async function get<T>(url: string): Promise<ApiResult<T>> {
  try {
    const { data } = await api.get(url);
    if (data?.ok) return data as ApiOk<T>;
    return { ok: false, error: data?.error || "Respuesta inesperada", details: data, status: 200 };
  } catch (e) {
    return toApiErr(e);
  }
}

export async function post<T>(url: string, body?: any): Promise<ApiResult<T>> {
  try {
    const { data } = await api.post(url, body);
    if (data?.ok) return data as ApiOk<T>;
    return { ok: false, error: data?.error || "Respuesta inesperada", details: data, status: 200 };
  } catch (e) {
    return toApiErr(e);
  }
}
