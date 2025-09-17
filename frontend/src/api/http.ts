// src/api/http.ts
import axios from "axios";
import { getToken } from "../services/authService";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

http.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default http;
