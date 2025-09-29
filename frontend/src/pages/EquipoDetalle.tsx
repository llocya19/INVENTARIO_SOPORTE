// src/pages/EquipoDetalle.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import http from "../api/http";

/* ---------- Tipos del backend (alineados) ---------- */
type Clase = "COMPONENTE" | "PERIFERICO";

type EquipoHeaderAPI = {
  equipo_id: number;
  equipo_codigo: string;
  equipo_nombre: string;
  area_id: number;
  estado: string;                 // backend: estado
  usuario_final: string | null;   // backend: usuario_final
  login: string | null;           // backend: login
  password: string | null;        // backend: password
  created_at?: string | null;
  updated_at?: string | null;
  items?: EquipoItemAPI[];
};

type EquipoItemAPI = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string;
};

type ItemDisponible = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string; // ALMACEN
  created_at?: string | null;
};

type ItemsPage = { items: ItemDisponible[]; total: number; page: number; size: number };
type ItemType = { id: number; clase: Clase; nombre: string };

/* ---------- Página ---------- */
export default function EquipoDetalle() {
  const { id } = useParams();
  const equipoId = Number(id);

  const [header, setHeader] = useState<EquipoHeaderAPI | null>(null);
  const [componentes, setComponentes] = useState<EquipoItemAPI[]>([]);
  const [perifericos, setPerifericos] = useState<EquipoItemAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // edición metadatos
  const [edit, setEdit] = useState({
    nombre: "",
    estado: "USO",
    usuario_final: "",
    login: "",
    password: "",
  });

  // panel agregar desde almacén
  const [openAdd, setOpenAdd] = useState(false);
  const [addClase, setAddClase] = useState<Clase>("COMPONENTE");
  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);
  const addTypeOpts = addClase === "COMPONENTE" ? typesC : typesP;

  const [addFilter, setAddFilter] = useState<{ tipo: string; q: string }>({ tipo: "", q: "" });
  const [addPage, setAddPage] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });

  const areaId = useMemo(() => header?.area_id ?? 0, [header]);

  /* ---------- Helpers estado ---------- */
  const isEnUso = ((header?.estado || edit.estado) ?? "").toUpperCase() === "USO";

  /* ---------- Cargas ---------- */
  async function loadDetalle(showOk?: string) {
    setLoading(true);
    setMsg(null);
    try {
      const r = await http.get<EquipoHeaderAPI>(`/api/equipos/${equipoId}`);
      const h = r.data;
      setHeader(h);

      const items = Array.isArray(h.items) ? h.items : [];
      setComponentes(items.filter((i) => i.clase === "COMPONENTE"));
      setPerifericos(items.filter((i) => i.clase === "PERIFERICO"));

      setEdit({
        nombre: h.equipo_nombre || "",
        estado: (h.estado || "USO").toUpperCase(),
        usuario_final: h.usuario_final || "",
        login: h.login || "",
        password: h.password || "",
      });

      if (showOk) setOk(showOk);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar el equipo");
    } finally {
      setLoading(false);
    }
  }

  async function loadStatic() {
    try {
      const [tc, tp] = await Promise.all([
        http.get<ItemType[]>("/api/item-types?clase=COMPONENTE"),
        http.get<ItemType[]>("/api/item-types?clase=PERIFERICO"),
      ]);
      setTypesC(tc.data || []);
      setTypesP(tp.data || []);
    } catch {
      /* ignore */
    }
  }

  async function loadDisponibles(page = 1, size = addPage.size) {
    if (!areaId) return;
    const params: any = { clase: addClase, page, size };
    if (addFilter.tipo) params.tipo = addFilter.tipo;
    if (addFilter.q) params.q = addFilter.q;

    const r = await http.get<ItemsPage>(`/api/areas/${areaId}/items-disponibles`, { params });
    setAddPage(r.data || { items: [], total: 0, page, size });
  }

  useEffect(() => {
    if (!Number.isFinite(equipoId) || equipoId <= 0) {
      setMsg("ID de equipo inválido");
      return;
    }
    loadDetalle();
    loadStatic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId]);

  useEffect(() => {
    if (openAdd && areaId) loadDisponibles(1, addPage.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAdd, addClase, areaId]);

  /* ---------- Acciones ---------- */
  const onPatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setOk(null);
    try {
      await http.patch(`/api/equipos/${equipoId}`, {
        equipo_nombre: edit.nombre?.trim(),
        equipo_estado: edit.estado?.toUpperCase(),
        equipo_usuario_final: edit.usuario_final?.trim() || null,
        equipo_login: edit.login?.trim() || null,
        equipo_password: edit.password?.trim() || null,
      });
      await loadDetalle("Equipo actualizado");
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo actualizar");
    }
  };

  const onAddItem = async (it: ItemDisponible) => {
    setMsg(null);
    setOk(null);
    try {
      await http.post(`/api/equipos/${equipoId}/items`, { item_id: it.item_id, slot: null });
      await loadDetalle("Item asignado");
      await loadDisponibles(addPage.page, addPage.size);
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo asignar el item");
    }
  };

  const onRemoveItem = async (it: EquipoItemAPI) => {
    if (!confirm(`¿Retirar ${it.item_codigo} (${it.tipo}) de este equipo?`)) return;
    setMsg(null);
    setOk(null);
    try {
      await http.delete(`/api/equipos/${equipoId}/items/${it.item_id}`);
      await loadDetalle("Item retirado");
      if (openAdd) await loadDisponibles(addPage.page, addPage.size);
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo retirar el item");
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">Equipo</div>
          {header && (
            <div className="text-sm text-slate-600">
              Área ID: <span className="font-medium">{header.area_id}</span> · Código:{" "}
              <span className="font-mono">{header.equipo_codigo}</span>
            </div>
          )}
        </div>
        {header && (
          <Link to={`/areas/${header.area_id}`} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm">
            Volver al área
          </Link>
        )}
      </div>

      {msg && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Metadatos equipo */}
      <form onSubmit={onPatch} className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-slate-600">Nombre</div>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={edit.nombre}
              onChange={(e) => setEdit((s) => ({ ...s, nombre: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Estado</div>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={edit.estado}
              onChange={(e) => setEdit((s) => ({ ...s, estado: e.target.value }))}
            >
              <option value="ALMACEN">ALMACEN</option>
              <option value="USO">USO</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
              <option value="BAJA">BAJA</option>
            </select>
          </div>
          <div>
            <div className="text-sm text-slate-600">Usuario final</div>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={edit.usuario_final}
              onChange={(e) => setEdit((s) => ({ ...s, usuario_final: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Login</div>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={edit.login}
              onChange={(e) => setEdit((s) => ({ ...s, login: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Password</div>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={edit.password}
              onChange={(e) => setEdit((s) => ({ ...s, password: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div className="text-sm text-slate-600">
            Ingresó:{" "}
            <span className="text-slate-800">
              {header?.created_at ? new Date(header.created_at).toLocaleString() : "-"}
            </span>
            <br />
            Modificado:{" "}
            <span className="text-slate-800">
              {header?.updated_at ? new Date(header.updated_at).toLocaleString() : "-"}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white">Guardar cambios</button>
        </div>
      </form>

      {/* Aviso si no está en USO */}
      {header && !isEnUso && (
        <div className="p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm">
          Para agregar ítems <b>en USO</b>, cambia el estado del equipo a <b>USO</b> y guarda.
        </div>
      )}

      {/* Listados asignados + acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-lg font-semibold">Componentes & Periféricos asignados</div>
        <div className="flex items-center gap-2">
          {/* Agregar desde ALMACÉN (siempre disponible; si quieres condicionarlo, me dices) */}
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            onClick={() => setOpenAdd(true)}
            disabled={!header}
            title="Asignar ítems existentes en ALMACÉN"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5l9 4-9 4-9-4 9-4zm0 6l9 4-9 4-9-4 9-4z" />
            </svg>
            Agregar (ALMACÉN)
          </button>

          {/* NUEVO: Agregar EN USO — solo si está en USO */}
          {header && isEnUso && (
            <Link
              to={`/equipos/${header.equipo_id}/agregar-en-uso`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-300 transition-all shadow-sm"
              title="Crear y asignar nuevos ítems en USO a este equipo"
            >
              {/* ícono plus dentro de un chip */}
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-white/15">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
                </svg>
              </span>
              Agregar ítems (EN USO)
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ItemsAsignados title="Componentes" rows={componentes} onRemove={onRemoveItem} />
        <ItemsAsignados title="Periféricos" rows={perifericos} onRemove={onRemoveItem} />
      </div>

      {/* Panel Agregar desde ALMACÉN */}
      {openAdd && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-lg p-4 space-y-3 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Agregar ítems desde almacén</div>
              <button className="text-slate-600 hover:text-slate-900" onClick={() => setOpenAdd(false)}>
                Cerrar
              </button>
            </div>

            {/* Tabs clase */}
            <div className="flex gap-2">
              {(["COMPONENTE", "PERIFERICO"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setAddClase(c);
                    setAddFilter({ tipo: "", q: "" });
                  }}
                  className={`px-3 py-1.5 rounded-lg ${
                    addClase === c ? "bg-slate-900 text-white" : "bg-white border border-slate-300"
                  }`}
                >
                  {c === "COMPONENTE" ? "Componentes" : "Periféricos"}
                </button>
              ))}
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <div className="text-sm text-slate-600">Tipo</div>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={addFilter.tipo}
                  onChange={(e) => setAddFilter((f) => ({ ...f, tipo: e.target.value }))}
                >
                  <option value="">(Todos)</option>
                  {addTypeOpts.map((t) => (
                    <option key={`${t.clase}-${t.id}`} value={t.nombre}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="text-sm text-slate-600">Buscar (código)</div>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Ej. PC-001"
                  value={addFilter.q}
                  onChange={(e) => setAddFilter((f) => ({ ...f, q: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-4">
                <button
                  className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
                  onClick={() => loadDisponibles(1, addPage.size)}
                  disabled={!areaId}
                >
                  Aplicar filtros
                </button>
              </div>
            </div>

            {/* Tabla disponibles */}
            <div className="bg-white rounded-xl border overflow-hidden flex-1 flex flex-col">
              <div className="overflow-auto">
                <table className="min-w-full table-auto">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-sm text-slate-600">
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Ingresó</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {addPage.items.map((r) => (
                      <tr key={r.item_id} className="border-t">
                        <td className="px-3 py-2 font-mono">{r.item_codigo}</td>
                        <td className="px-3 py-2">{r.tipo}</td>
                        <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm"
                            onClick={() => onAddItem(r)}
                          >
                            Agregar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {addPage.items.length === 0 && (
                      <tr>
                        <td className="px-3 py-6 text-slate-500" colSpan={4}>
                          No hay ítems disponibles en almacén para esta selección
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between p-3 border-t">
                <div className="text-sm text-slate-600">
                  Total: {addPage.total} · Página {addPage.page}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    value={addPage.size}
                    onChange={async (e) => {
                      const s = Number(e.target.value);
                      await loadDisponibles(1, s);
                    }}
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} por página
                      </option>
                    ))}
                  </select>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    disabled={addPage.page <= 1}
                    onClick={() => loadDisponibles(addPage.page - 1, addPage.size)}
                  >
                    Anterior
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    disabled={addPage.page * addPage.size >= addPage.total}
                    onClick={() => loadDisponibles(addPage.page + 1, addPage.size)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="px-3 py-2 rounded-lg border border-slate-300" onClick={() => setOpenAdd(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-slate-500">Cargando…</div>}
    </div>
  );
}

/* ---------- Auxiliar: tabla asignados ---------- */
function ItemsAsignados({
  title,
  rows,
  onRemove,
}: {
  title: string;
  rows: { item_id: number; item_codigo: string; tipo: string; clase: Clase; estado: string }[];
  onRemove: (it: { item_id: number; item_codigo: string; tipo: string; clase: Clase; estado: string }) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow">
      <div className="p-3 border-b">
        <div className="font-semibold">{title}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-600">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item_id} className="border-t">
                <td className="px-3 py-2 font-mono">{r.item_codigo}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2">{r.estado}</td>
                <td className="px-3 py-2 text-right flex items-center gap-2 justify-end">
                  <Link
                    to={`/items/${r.item_id}`}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm"
                    title="Ver ficha técnica"
                  >
                    Ver ficha
                  </Link>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm"
                    onClick={() => onRemove(r)}
                  >
                    Retirar
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={4}>
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
