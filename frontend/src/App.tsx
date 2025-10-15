// src/App.tsx
import { Routes, Route, Link, NavLink } from "react-router-dom";
import { useState } from "react";
import Login from "./pages/Login";
import Users from "./pages/Users";
import Areas from "./pages/Areas";
import AreaView from "./pages/AreaView";
import ItemDetailPage from "./pages/ItemDetail";
import ProtectedRoute from "./routes/ProtectedRoute";
import { getUser, logout } from "./services/authService";

// Equipos
import EquipoNuevo from "./pages/EquipoNuevo";
import EquipoDetalle from "./pages/EquipoDetalle";
// 👇 import corregido (el archivo se llama EquipoNuevoUso.tsx)
import EquipoNuevoUso from "./pages/EquipoNuevoEnUso";
import Auditorias from "./pages/Auditorias";

// Incidencias & Perfil
import IncidenciasAdmin from "./pages/IncidenciasAdmin";
import MisIncidencias from "./pages/MisIncidencias";
import Profile from "./pages/Profile";

/* ========== Tokens UI (Crema + Blanco) ========== */
const BG_APP = "bg-[#FFFDF8]";
const TEXT = "text-slate-800";
const NAV_SHADOW = "shadow-[0_1px_0_rgba(0,0,0,0.04)]";
const CONTAINER = "mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6";

function HomeSwitch() {
  const u = getUser();
  if (u?.rol === "USUARIO") return <MisIncidencias />;
  return <Areas />;
}

/* ========== Brand Logo (simple) ========== */
function HospitalLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 5v4h4v2h-4v4h-2v-4H7v-2h4V7h2Z" />
    </svg>
  );
}

/* ========== Top Nav ========== */
function Nav() {
  const u = getUser();
  const [open, setOpen] = useState(false);

  const linkBase =
    "inline-flex items-center h-10 rounded-lg px-3 text-sm font-medium transition whitespace-nowrap";
  const linkIdle = "text-slate-600 hover:text-slate-900 hover:bg-slate-100";
  const linkActive = "text-slate-900 bg-slate-100 ring-1 ring-slate-200";

  return (
    <header
      className={`sticky top-0 z-40 bg-white/95 backdrop-blur ${NAV_SHADOW} border-b border-slate-200`}
      role="banner"
    >
      <div className={`${CONTAINER} h-16 flex items-center justify-between`}>
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
              <HospitalLogo />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold text-slate-900">Inventario</div>
              <div className="text-[12px] text-slate-500">Hospital · Soporte TI</div>
            </div>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Principal">
          {u?.rol !== "USUARIO" && (
            <NavLink
              to="/areas"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
            >
              Áreas
            </NavLink>
          )}

          {u?.rol === "ADMIN" ? (
            <NavLink
              to="/incidencias"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
            >
              Incidencias
            </NavLink>
          ) : (
            <NavLink
              to="/mis-incidencias"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
            >
              Mis incidencias
            </NavLink>
          )}

          {u?.rol === "ADMIN" && (
            <>
              <NavLink
                to="/auditorias"
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
              >
                Auditorías
              </NavLink>
              <NavLink
                to="/users"
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
              >
                Usuarios
              </NavLink>
            </>
          )}
        </nav>

        {/* Perfil / Auth */}
        <div className="hidden md:flex items-center gap-3">
          {u ? (
            <>
              <NavLink
                to="/profile"
                className="inline-flex items-center h-10 rounded-full px-3 text-sm bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 transition"
                title="Perfil"
              >
                {u.username} · {u.rol}
              </NavLink>
              <button
                className="inline-flex items-center h-10 rounded-xl px-4 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition"
                onClick={() => {
                  logout();
                  location.href = "/login";
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center h-10 rounded-xl px-4 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2">
          {u && (
            <Link
              to="/profile"
              className="inline-flex items-center h-9 rounded-full px-3 text-xs bg-slate-100 text-slate-700 ring-1 ring-slate-200"
              title="Perfil"
            >
              {u.username}
            </Link>
          )}
          <button
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100"
            onClick={() => setOpen((s) => !s)}
            aria-label="Abrir menú"
            aria-expanded={open}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className={`${CONTAINER} md:hidden pb-3`}>
          <nav className="grid gap-2 pt-2" aria-label="Principal móvil">
            {u?.rol !== "USUARIO" && (
              <NavLink
                to="/areas"
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-3 text-sm ${
                    isActive ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                Áreas
              </NavLink>
            )}

            {u?.rol === "ADMIN" ? (
              <NavLink
                to="/incidencias"
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-3 text-sm ${
                    isActive ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                Incidencias
              </NavLink>
            ) : (
              <NavLink
                to="/mis-incidencias"
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-3 text-sm ${
                    isActive ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                Mis incidencias
              </NavLink>
            )}

            {u?.rol === "ADMIN" && (
              <>
                <NavLink
                  to="/auditorias"
                  className={({ isActive }) =>
                    `block rounded-xl px-3 py-3 text-sm ${
                      isActive ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200" : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                  onClick={() => setOpen(false)}
                >
                  Auditorías
                </NavLink>
                <NavLink
                  to="/users"
                  className={({ isActive }) =>
                    `block rounded-xl px-3 py-3 text-sm ${
                      isActive ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200" : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                  onClick={() => setOpen(false)}
                >
                  Usuarios
                </NavLink>
              </>
            )}

            <div className="mt-2 flex items-center gap-2">
              {u ? (
                <>
                  <NavLink
                    to="/profile"
                    className="flex-1 inline-flex items-center justify-center h-10 rounded-xl bg-slate-100 text-slate-800 ring-1 ring-slate-200"
                    onClick={() => setOpen(false)}
                  >
                    {u.username} · {u.rol}
                  </NavLink>
                  <button
                    className="inline-flex items-center h-10 rounded-xl px-4 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition"
                    onClick={() => {
                      logout();
                      location.href = "/login";
                    }}
                  >
                    Salir
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex-1 inline-flex items-center justify-center h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
                  onClick={() => setOpen(false)}
                >
                  Entrar
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export default function App() {
  return (
    <div className={`${BG_APP} ${TEXT} min-h-screen`}>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* HOME -> cambia según rol */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomeSwitch />
            </ProtectedRoute>
          }
        />

        {/* Áreas */}
        <Route
          path="/areas"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <Areas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/areas/:id"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <AreaView />
            </ProtectedRoute>
          }
        />

        {/* Equipos */}
        <Route
          path="/items/:id"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <ItemDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/areas/:areaId/equipos/nuevo"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <EquipoNuevo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/equipos/:id"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <EquipoDetalle />
            </ProtectedRoute>
          }
        />
        {/* crear equipo en USO */}
        <Route
          path="/areas/:areaId/equipos/nuevo-uso"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <EquipoNuevoUso />
            </ProtectedRoute>
          }
        />
        {/* 👇 NUEVA RUTA: agregar ítems EN USO a un equipo existente */}
        <Route
          path="/equipos/:equipoId/agregar-en-uso"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <EquipoNuevoUso />
            </ProtectedRoute>
          }
        />

        {/* Auditorías */}
        <Route
          path="/auditorias"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Auditorias />
            </ProtectedRoute>
          }
        />

        {/* Incidencias */}
        <Route
          path="/incidencias"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <IncidenciasAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-incidencias"
          element={
            <ProtectedRoute roles={["USUARIO", "PRACTICANTE", "ADMIN"]}>
              <MisIncidencias />
            </ProtectedRoute>
          }
        />

        {/* Perfil */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Users />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={<div className={`${CONTAINER} py-6`}>Página no encontrada</div>}
        />
      </Routes>
    </div>
  );
}
