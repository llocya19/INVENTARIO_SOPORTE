import axios, { AxiosHeaders } from "axios";
import { getToken, logout } from "../services/authService";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

http.interceptors.request.use((config) => {
  const t = getToken();

  // Asegura que headers sea una instancia válida
  if (!config.headers) {
    config.headers = new AxiosHeaders();
  } else if (!(config.headers instanceof AxiosHeaders)) {
    // si vino como objeto plano, envuélvelo
    config.headers = new AxiosHeaders(config.headers as any);
  }

  // Set / delete Authorization de forma segura
  const headers = config.headers as AxiosHeaders;
  if (t) {
    headers.set("Authorization", `Bearer ${t}`);
  } else {
    headers.delete("Authorization");
  }

  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      logout();
      if (location.pathname !== "/login") location.replace("/login");
    }
    return Promise.reject(err);
  }
);

export default http;
