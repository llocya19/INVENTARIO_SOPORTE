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
  area_id: number; // <- fixed
  estado: string;
  usuario_final: string | null;
  login: string | null;
  password: string | null;
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

/* ---------- UI helpers ---------- */
const card = "bg-white rounded-2xl shadow-sm ring-1 ring-slate-200";
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-400 transition";
const btn =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 active:bg-slate-100 transition";
const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm shadow-sm hover:opacity-95 active:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed";

function BadgeEstado({ estado }: { estado?: string }) {
  const e = (estado || "").toUpperCase();
  const map: Record<string, string> = {
    USO: "bg-emerald-100 text-emerald-700",
    ALMACEN: "bg-slate-100 text-slate-700",
    MANTENIMIENTO: "bg-amber-100 text-amber-800",
    BAJA: "bg-rose-100 text-rose-700",
  };
  const cls = map[e] || "bg-slate-100 text-slate-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{e || "—"}</span>;
}

function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="p-8 text-center">
      <div className="text-slate-700 font-medium">{title}</div>
      {desc && <div className="text-sm text-slate-500 mt-1">{desc}</div>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-3 py-3">
        <div className="h-4 w-28 bg-slate-200 rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-4 w-16 bg-slate-200 rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-8 w-24 bg-slate-200 rounded" />
      </td>
    </tr>
  );
}

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
  const onPatch = async (e: React.FormEvent<HTMLFormElement>) => {
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-semibold">{header?.equipo_nombre || "Equipo"}</h1>
            <BadgeEstado estado={header?.estado} />
          </div>
          {header && (
            <div className="text-sm text-slate-600 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Área ID {header.area_id}
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-mono">{header.equipo_codigo}</span>
              <span className="text-slate-500">·</span>
              <span>
                Creado:{" "}
                <b>{header?.created_at ? new Date(header.created_at).toLocaleString() : "-"}</b>
              </span>
              <span className="text-slate-500">·</span>
              <span>
                Modificado:{" "}
                <b>{header?.updated_at ? new Date(header.updated_at).toLocaleString() : "-"}</b>
              </span>
            </div>
          )}
        </div>
        {header && (
          <Link to={`/areas/${header.area_id}`} className={btnPrimary}>
            Volver al área
          </Link>
        )}
      </div>

      {msg && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">{msg}</div>}
      {ok && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{ok}</div>}

      {/* Metadatos equipo */}
      <form onSubmit={onPatch} className={card + " p-4 md:p-5"}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div>
            <div className="text-xs text-slate-600 mb-1">Nombre</div>
            <input className={field} value={edit.nombre} onChange={(e) => setEdit((s) => ({ ...s, nombre: e.target.value }))} />
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Estado</div>
            <select
              className={field}
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
            <div className="text-xs text-slate-600 mb-1">Usuario final</div>
            <input className={field} value={edit.usuario_final} onChange={(e) => setEdit((s) => ({ ...s, usuario_final: e.target.value }))} />
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Login</div>
            <input className={field} value={edit.login} onChange={(e) => setEdit((s) => ({ ...s, login: e.target.value }))} />
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Password</div>
            <input
              type="password"
              className={field}
              value={edit.password}
              onChange={(e) => setEdit((s) => ({ ...s, password: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div className="md:self-end">
            <button className={btnPrimary + " w-full md:w-auto"}>Guardar cambios</button>
          </div>
        </div>
      </form>

      {/* Aviso si no está en USO */}
      {header && !isEnUso && (
        <div className="p-3 rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-sm">
          Para agregar ítems <b>en USO</b>, cambia el estado del equipo a <b>USO</b> y guarda.
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-lg font-semibold">Componentes & Periféricos asignados</div>
        <div className="flex items-center gap-2">
          <button
            className={btn}
            onClick={() => setOpenAdd(true)}
            disabled={!header}
            title="Asignar ítems existentes en ALMACÉN"
          >
            📦 Agregar (ALMACÉN)
          </button>
          {header && isEnUso && (
            <Link
              to={`/equipos/${header.equipo_id}/agregar-en-uso`}
              className={btnPrimary}
              title="Crear y asignar nuevos ítems en USO a este equipo"
            >
              ➕ Agregar ítems (EN USO)
            </Link>
          )}
        </div>
      </div>

      {/* Tablas asignados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ItemsAsignados title="Componentes" rows={componentes} onRemove={onRemoveItem} loading={loading} />
        <ItemsAsignados title="Periféricos" rows={perifericos} onRemove={onRemoveItem} loading={loading} />
      </div>

      {/* Panel Agregar desde ALMACÉN */}
      {openAdd && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Agregar ítems desde almacén</div>
              <button className={btn} onClick={() => setOpenAdd(false)}>Cerrar</button>
            </div>

            <div className="p-4 space-y-4">
              {/* Tabs clase */}
              <div className="flex gap-2">
                {(["COMPONENTE", "PERIFERICO"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setAddClase(c);
                      setAddFilter({ tipo: "", q: "" });
                    }}
                    className={`px-3 py-1.5 rounded-xl ${
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
                  <div className="text-xs text-slate-600 mb-1">Tipo</div>
                  <select
                    className={field}
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
                  <div className="text-xs text-slate-600 mb-1">Buscar (código)</div>
                  <input
                    className={field}
                    placeholder="Ej. PC-001"
                    value={addFilter.q}
                    onChange={(e) => setAddFilter((f) => ({ ...f, q: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-4">
                  <button
                    className={btn}
                    onClick={() => loadDisponibles(1, addPage.size)}
                    disabled={!areaId}
                  >
                    Aplicar filtros
                  </button>
                </div>
              </div>

              {/* Tabla disponibles */}
              <div className={card + " overflow-hidden"}>
                <div className="overflow-auto max-h-[50vh]">
                  <table className="min-w-full table-auto">
                    <thead className="bg-slate-50 sticky top-0 z-10">
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
                            <button className={btnPrimary} onClick={() => onAddItem(r)}>
                              Agregar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {addPage.items.length === 0 && (
                        <tr>
                          <td className="px-3 py-6" colSpan={4}>
                            <EmptyState
                              title="No hay ítems disponibles"
                              desc="Ajusta los filtros o cambia la clase para revisar otros ítems."
                            />
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
                      className={field + " py-1 w-36"}
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
                      className={btn}
                      disabled={addPage.page <= 1}
                      onClick={() => loadDisponibles(addPage.page - 1, addPage.size)}
                    >
                      ◀
                    </button>
                    <button
                      className={btn}
                      disabled={addPage.page * addPage.size >= addPage.total}
                      onClick={() => loadDisponibles(addPage.page + 1, addPage.size)}
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button className={btn} onClick={() => setOpenAdd(false)}>
                  Cerrar
                </button>
              </div>
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
  loading,
}: {
  title: string;
  rows: { item_id: number; item_codigo: string; tipo: string; clase: Clase; estado: string }[];
  onRemove: (it: { item_id: number; item_codigo: string; tipo: string; clase: Clase; estado: string }) => void;
  loading?: boolean;
}) {
  return (
    <div className={card}>
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
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)}
            {!loading &&
              rows.map((r) => (
                <tr key={r.item_id} className="border-t">
                  <td className="px-3 py-2 font-mono">{r.item_codigo}</td>
                  <td className="px-3 py-2">{r.tipo}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        to={`/items/${r.item_id}`}
                        className={btnPrimary}
                        title="Ver ficha técnica"
                      >
                        Ver ficha
                      </Link>
                      <button
                        className="inline-flex items-center justify-center rounded-xl border border-rose-300 text-rose-700 px-3 py-2 text-sm hover:bg-rose-50 transition"
                        onClick={() => onRemove(r)}
                      >
                        Retirar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-6" colSpan={4}>
                  <EmptyState
                    title="Sin registros"
                    desc="Aún no hay ítems asignados a este equipo."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
