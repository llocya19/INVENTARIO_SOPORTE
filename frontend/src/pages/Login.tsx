import { useState } from "react";
import { login } from "../services/authService";
import { Link } from "react-router-dom";

export default function Login() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length >= 3 && password.length >= 4 && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMsg(null);
    try {
      await login(username.trim(), password);
      location.href = "/";
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panel ilustración / branding (se oculta en móvil si quieres) */}
        <div className="hidden lg:flex relative overflow-hidden rounded-2xl bg-slate-900 text-white">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-2xl" />
          <div className="relative p-10 flex flex-col justify-between">
            <div>
              <div className="text-2xl font-semibold">Inventario</div>
              <div className="mt-2 text-slate-300">
                Sistema de control de equipos, componentes y periféricos.
              </div>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li>• Acceso restringido a Soporte y Administradores</li>
              <li>• Auditoría automática por usuario</li>
              <li>• Reportes y panel general</li>
            </ul>
            <div className="mt-10 text-xs text-slate-400">
              © {new Date().getFullYear()} — IT Soporte
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow p-6 sm:p-8">
          <div className="mb-6">
            <div className="text-2xl font-semibold">Iniciar sesión</div>
            <div className="text-slate-500 text-sm mt-1">
              Ingresa con tu usuario y contraseña corporativa.
            </div>
          </div>

          {msg && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
              {msg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm text-slate-600">
                Usuario
              </label>
              <input
                id="username"
                autoFocus
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="ej. admin"
                value={username}
                onChange={(e) => setU(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-slate-600">
                Contraseña
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-12 outline-none focus:ring-2 focus:ring-slate-400"
                  value={password}
                  onChange={(e) => setP(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? "Ocultar" : "Ver"}
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Mínimo 4 caracteres.
              </div>
            </div>

            <button
              className="w-full inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Ingresando...
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

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
        </div>
      </div>
    </div>
  );
}
