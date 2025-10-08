// src/pages/Login.tsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { login } from "../services/authService";

export default function Login() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [caps, setCaps] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length >= 3 && password.length >= 4 && !loading;
  const userRef = useRef<HTMLInputElement | null>(null);
  const errRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Autofocus al usuario
    userRef.current?.focus();
    // Cargar último usuario (si dejaste algo en localStorage)
    const last = localStorage.getItem("last_user");
    if (last) setU(last);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMsg(null);
    try {
      await login(username.trim(), password);
      if (remember) localStorage.setItem("last_user", username.trim());
      else localStorage.removeItem("last_user");
      location.href = "/";
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Error de autenticación");
      // lleva el foco al bloque de error para lectores de pantalla
      setTimeout(() => errRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panel ilustración / branding */}
        <aside className="hidden lg:flex relative overflow-hidden rounded-3xl bg-slate-900 text-white ring-1 ring-black/10">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-2xl" />
          <div className="relative p-10 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-3xl font-semibold tracking-tight">Inventario TI</div>
              <div className="text-slate-300 leading-relaxed">
                Control centralizado de equipos, componentes y periféricos.
              </div>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <Dot /> Auditoría automática por usuario y acción
              </li>
              <li className="flex items-start gap-2">
                <Dot /> Reportes y panel ejecutivo en tiempo real
              </li>
              <li className="flex items-start gap-2">
                <Dot /> Flujos para alta, baja, asignación y mantenimiento
              </li>
            </ul>
            <div className="mt-10 text-xs text-slate-400">
              © {new Date().getFullYear()} · Mesa de Ayuda / IT
            </div>
          </div>
        </aside>

        {/* Formulario */}
        <main className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
          <header className="mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                {/* Logo simple */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l7 4v6c0 5-3 7-7 10-4-3-7-5-7-10V6l7-4z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-semibold leading-tight">Iniciar sesión</div>
                <div className="text-slate-500 text-sm">Usa tus credenciales corporativas</div>
              </div>
            </div>
          </header>

          {msg && (
            <div
              ref={errRef}
              tabIndex={-1}
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              role="alert"
              aria-live="assertive"
            >
              {msg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Usuario */}
            <div>
              <label htmlFor="username" className="block text-sm text-slate-700">
                Usuario
              </label>
              <input
                id="username"
                ref={userRef}
                inputMode="text"
                autoComplete="username"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400/60"
                placeholder="ej. jdoe"
                value={username}
                onChange={(e) => setU(e.target.value)}
                onKeyDown={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
                onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
              />
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm text-slate-700">
                  Contraseña
                </label>
                <span className="text-xs text-slate-500">mín. 4 caracteres</span>
              </div>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-11 text-sm outline-none focus:ring-2 focus:ring-slate-400/60"
                  value={password}
                  onChange={(e) => setP(e.target.value)}
                  onKeyDown={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
                  onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {caps && (
                <div className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                  Bloq Mayús está activado
                </div>
              )}
            </div>

            {/* Opciones */}
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Recordarme
              </label>
              <a className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4" href="mailto:soporte@empresa.com">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {/* Submit */}
            <button
              className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400/60 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Ingresando…
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Footer pequeño */}
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <div>
              ¿Problemas para ingresar? Contacta a{" "}
              <a className="text-slate-700 underline" href="mailto:soporte@empresa.com">
                Soporte
              </a>
            </div>
            <Link to="/" className="text-slate-700 underline">
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ====== íconos/mini componentes ====== */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function Dot() {
  return (
    <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-emerald-400" aria-hidden="true" />
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6A3.5 3.5 0 0012 15.5c1.9 0 3.5-1.6 3.5-3.5 0-.5-.1-1-.3-1.4M7.5 7.9C5 9 3 12 3 12s4 7 9 7c2 0 3.7-.6 5.1-1.5M16.4 7.6C15.3 7.2 13.9 7 12 7 5 7 1 12 1 12s1.1 2 3 3.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
