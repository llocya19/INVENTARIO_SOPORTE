// frontend/src/utils/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: "http://127.0.0.1:5000",
  headers: { "X-App-User": "admin" },
});

// Unión discriminada para mejor narrowing
export type SafeResp<T> = { ok: true; data: T } | { ok: false; error: string };

export async function safe<T>(p: Promise<any>): Promise<SafeResp<T>> {
  try {
    const res = await p;
    // si tu backend ya envuelve como { ok, data }, ajusta aquí:
    const data = "data" in res ? res.data : res;
    return { ok: true, data: data.data ?? data }; // toma .data interna si existe
  } catch (e: any) {
    const msg = e?.response?.data?.error ?? e?.message ?? "Error";
    return { ok: false, error: msg };
  }
}
