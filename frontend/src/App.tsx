// src/App.tsx
import { Routes, Route, Link } from "react-router-dom";
import Login from "./pages/Login";
import Users from "./pages/Users";
import Areas from "./pages/Areas";
import AreaView from "./pages/AreaView";
import ItemDetailPage from "./pages/ItemDetail";
import ProtectedRoute from "./routes/ProtectedRoute";
import { getUser, logout } from "./services/authService";

// Equipos
import EquipoNuevo from "./pages/EquipoNuevo";        // crear equipo (PC) dentro de un área
import EquipoDetalle from "./pages/EquipoDetalle";    // ver detalle de un equipo
import EquipoNuevoUso from "./pages/EquipoNuevoEnUso";  // ✅ nombre correcto de archivo

function Nav() {
  const u = getUser();
  return (
    <nav className="w-full bg-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
        <Link to="/" className="font-semibold">Inventario</Link>

        <div className="flex-1 flex items-center gap-3">
          <Link to="/areas" className="text-slate-300 hover:text-white text-sm">
            Áreas
          </Link>
          {u?.rol === "ADMIN" && (
            <Link to="/users" className="text-slate-300 hover:text-white text-sm">
              Usuarios
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {u && <span className="text-slate-300 text-sm">{u.username} · {u.rol}</span>}
          {u ? (
            <button
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold"
              onClick={() => { logout(); location.href = "/login"; }}
            >
              Salir
            </button>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* HOME -> Áreas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Areas />
            </ProtectedRoute>
          }
        />

        {/* Áreas */}
        <Route
          path="/areas"
          element={
            <ProtectedRoute>
              <Areas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/areas/:id"
          element={
            <ProtectedRoute>
              <AreaView />
            </ProtectedRoute>
          }
        />

<Route path="/equipos/:equipoId/agregar-en-uso" element={<EquipoNuevoUso />} />
        {/* Ficha de ítem */}
        <Route
          path="/items/:id"
          element={
            <ProtectedRoute>
              <ItemDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Crear equipo (desde ALMACÉN) */}
        <Route
          path="/areas/:areaId/equipos/nuevo"
          element={
            <ProtectedRoute>
              <EquipoNuevo />
            </ProtectedRoute>
          }
        />

        {/* Detalle del equipo */}
        <Route
          path="/equipos/:id"
          element={
            <ProtectedRoute>
              <EquipoDetalle />
            </ProtectedRoute>
          }
        />

        {/* ✅ Crear equipo en USO (con nuevos ítems) — protegido y con import correcto */}
        <Route
          path="/areas/:areaId/equipos/nuevo-uso"
          element={
            <ProtectedRoute>
              <EquipoNuevoUso />
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
        <Route path="*" element={<div className="p-6">Página no encontrada</div>} />
      </Routes>
    </>
  );
}
