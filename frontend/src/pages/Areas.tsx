// src/pages/Areas.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import http from "../api/http";
import { getUser } from "../services/authService";

/* =========================
   Tipos
========================= */
type Area = { id: number; nombre: string; padre_id: number | null };
type AreaInfo = {
  area: { id:number; nombre:string; padre_id:number|null };
  ancestors: { id:number; nombre:string; padre_id:number|null }[];
  children: { id:number; nombre:string }[];
};

/* =========================
   UI helpers
========================= */
const card = "bg-white rounded-2xl shadow-sm ring-1 ring-slate-200";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-400 transition";
const btnBase =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 active:bg-slate-100 transition";
const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm shadow-sm hover:opacity-95 active:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed";

function Badge({ kind }: { kind: "root" | "child" }) {
  return (
    <span
      className={
        "text-[11px] px-2 py-0.5 rounded-full " +
        (kind === "root" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700")
      }
    >
      {kind === "root" ? "Raíz" : "Subárea"}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className={card + " p-4 animate-pulse"}>
      <div className="h-5 w-1/2 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-24 bg-slate-200 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-slate-200 rounded" />
        <div className="h-8 w-20 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

/* =========================
   Página
========================= */
export default function Areas() {
  const u = getUser();
  const isAdmin = u?.rol === "ADMIN";

  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string|null>(null);
  const [ok, setOk]   = useState<string|null>(null);

  // forms
  const [rootForm, setRootForm] = useState({ nombre: "" });

  // subárea: ahora con selección por raíz
  const [subForm,  setSubForm]  = useState({ nombre: "", padre_id: "" });
  const [subRootId, setSubRootId] = useState<string>(""); // nueva: raíz para filtrar padres

  // UI
  const [q, setQ] = useState<string>("");
  const [showForms, setShowForms] = useState<boolean>(true);

  // modal info
  const [showInfo, setShowInfo] = useState(false);
  const [info, setInfo] = useState<AreaInfo | null>(null);

  // paginación principal
  const [page, setPage] = useState<number>(1);
  const [size, setSize] = useState<number>(9); // 3x3 por defecto

  // paginación subáreas (modal)
  const [subPage, setSubPage] = useState<number>(1);
  const [subSize, setSubSize] = useState<number>(8);

  async function load() {
    setMsg(null); setLoading(true);
    try {
      const r = await http.get<Area[]>("/api/areas");
      setAreas(r.data || []);
    } catch (e:any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar las áreas");
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ load(); }, []);

  // === Helpers jerarquía (cliente) ===
  const byParent = useMemo(() => {
    const map = new Map<number|null, Area[]>();
    for (const a of areas) {
      const key = a.padre_id as number | null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    // orden alfabético leve
    for (const arr of map.values()) {
      arr.sort((x,y)=> x.nombre.localeCompare(y.nombre));
    }
    return map;
  }, [areas]);

  const roots = useMemo(() => (byParent.get(null) || []), [byParent]);

  function getDescendantsFlatten(rootId: number) {
    // devuelve [{id, nombre, depth}] de root y todos sus descendientes
    const result: {id:number; nombre:string; depth:number}[] = [];
    function walk(id:number, depth:number) {
      const self = areas.find(a=>a.id===id);
      if (self) result.push({ id:self.id, nombre:self.nombre, depth });
      const children = byParent.get(id) || [];
      for (const c of children) walk(c.id, depth+1);
    }
    walk(rootId, 0);
    return result;
  }

  // crear raíz
  async function createRoot(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null); setOk(null);
    const nombre = rootForm.nombre.trim();
    if (!nombre) { setMsg("Nombre requerido"); return; }
    try{
      await http.post("/api/areas/root", { nombre });
      setOk(`Área raíz "${nombre}" creada`);
      setRootForm({ nombre: "" });
      setPage(1);
      load();
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo crear el área raíz");
    }
  }

  // crear subárea
  async function createSub(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null); setOk(null);
    const nombre = subForm.nombre.trim();
    const padre_id = Number(subForm.padre_id);
    if (!nombre || !padre_id) {
      setMsg("Completa nombre y padre"); return;
    }
    try{
      await http.post("/api/areas/sub", { nombre, padre_id });
      setOk(`Subárea "${nombre}" creada`);
      setSubForm({ nombre: "", padre_id: "" });
      // mantener la raíz elegida para seguir creando dentro de la misma rama
      setPage(1);
      load();
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo crear la subárea");
    }
  }

  async function openInfo(id:number) {
    setMsg(null); setInfo(null); setShowInfo(true);
    setSubPage(1);
    try{
      const r = await http.get<AreaInfo>(`/api/areas/${id}/info`);
      setInfo(r.data);
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo obtener la info");
    }
  }

  // filtro + paginación (client-side)
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return areas;
    return areas.filter(a =>
      a.nombre.toLowerCase().includes(term) ||
      String(a.id).includes(term)
    );
  }, [areas, q]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / size)),
    [filtered.length, size]
  );

  const pageItems = useMemo(() => {
    const start = (page - 1) * size;
    return filtered.slice(start, start + size);
  }, [filtered, page, size]);

  // paginación subáreas en modal
  const subTotalPages = useMemo(() => {
    const total = info?.children?.length || 0;
    return Math.max(1, Math.ceil(total / subSize));
  }, [info?.children, subSize]);

  const subPageItems = useMemo(() => {
    const all = info?.children || [];
    const start = (subPage - 1) * subSize;
    return all.slice(start, start + subSize);
  }, [info?.children, subPage, subSize]);

  // reset de página al cambiar búsqueda o tamaño
  useEffect(() => { setPage(1); }, [q, size]);

  // al cambiar la raíz elegida para subáreas, si el padre actual ya no pertenece, lo limpiamos
  useEffect(() => {
    if (!subRootId) return;
    const rid = Number(subRootId);
    const allowed = new Set(getDescendantsFlatten(rid).map(d => d.id));
    if (subForm.padre_id && !allowed.has(Number(subForm.padre_id))) {
      setSubForm(s => ({ ...s, padre_id: "" }));
    }
  }, [subRootId, areas]); // areas por si recargan

  // si el usuario selecciona manualmente un padre desde otra parte, autoselecciona su raíz
  useEffect(() => {
    if (!subForm.padre_id) return;
    const pid = Number(subForm.padre_id);
    // encontramos la raíz ascendiendo por padre_id
    let cur = areas.find(a=>a.id===pid) || null;
    while (cur && cur.padre_id !== null) {
      cur = areas.find(a=>a.id===cur!.padre_id) || null;
    }
    if (cur && String(cur.id) !== subRootId) {
      setSubRootId(String(cur.id));
    }
  }, [subForm.padre_id, areas]); // autoderivar raíz

  // opciones para "Padre" basado en la raíz elegida
  const padreOptions = useMemo(() => {
    if (!subRootId) return [] as {id:number; nombre:string; depth:number}[];
    return getDescendantsFlatten(Number(subRootId));
  }, [subRootId, areas]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Áreas</h1>
          <div className="text-sm text-slate-500">
            {filtered.length} {filtered.length === 1 ? "área" : "áreas"} · página {page} de {totalPages}
          </div>
        </div>
        <div className="w-full sm:w-auto flex items-center gap-2">
          <input
            className={fieldBase + " w-full sm:w-64"}
            placeholder="Buscar por nombre o ID…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
          />
          <button className={btnBase} onClick={()=>setQ("")} disabled={!q}>Limpiar</button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">{msg}</div>}
      {ok  && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{ok}</div>}

      {/* ADMIN: acordeón de creación */}
      {isAdmin && (
        <div className={card}>
          <button
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={()=>setShowForms(s => !s)}
          >
            <span className="font-medium">Crear áreas</span>
            <span className="text-slate-500 text-sm">{showForms ? "Ocultar" : "Mostrar"}</span>
          </button>
          {showForms && (
            <div className="border-t grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
              {/* raíz */}
              <form onSubmit={createRoot} className="p-4 rounded-2xl ring-1 ring-slate-200">
                <div className="text-base font-medium mb-3">Área raíz</div>
                <div className="grid gap-3">
                  <div>
                    <div className="text-xs text-slate-600 mb-1">Nombre</div>
                    <input
                      className={fieldBase}
                      placeholder='Ej. "Soporte"'
                      value={rootForm.nombre}
                      onChange={e=>setRootForm({ nombre: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button className={btnPrimary}>Crear área raíz</button>
                </div>
              </form>

              {/* subárea */}
              <form onSubmit={createSub} className="p-4 rounded-2xl ring-1 ring-slate-200">
                <div className="text-base font-medium mb-3">Subárea</div>

                {/* Paso 1: Seleccionar raíz */}
                <div className="grid gap-3">
                  <div>
                    <div className="text-xs text-slate-600 mb-1">Área raíz</div>
                    <select
                      className={fieldBase}
                      value={subRootId}
                      onChange={(e)=> setSubRootId(e.target.value)}
                    >
                      <option value="">Seleccione…</option>
                      {roots.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.nombre} (ID {r.id})
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Primero elige la raíz; luego podrás escoger el padre dentro de esa rama.
                    </div>
                  </div>
                </div>

                {/* Paso 2: Datos subárea + Padre dentro de esa raíz */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-xs text-slate-600 mb-1">Nombre</div>
                    <input
                      className={fieldBase}
                      placeholder='Ej. "Laboratorio"'
                      value={subForm.nombre}
                      onChange={e=>setSubForm({ ...subForm, nombre: e.target.value })}
                    />
                  </div>

                  <div>
                    <div className="text-xs text-slate-600 mb-1">Padre</div>
                    <select
                      className={fieldBase}
                      value={subForm.padre_id}
                      onChange={e=>setSubForm({ ...subForm, padre_id: e.target.value })}
                      disabled={!subRootId}
                    >
                      <option value="">{subRootId ? "Seleccione…" : "Elige una raíz primero"}</option>
                      {padreOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {`${"— ".repeat(opt.depth)}${opt.nombre}`} {opt.depth===0 ? "(raíz)" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Solo se muestran la raíz seleccionada y sus subáreas.
                    </div>
                  </div>
                </div>

                {/* Vista rápida de la rama seleccionada */}
                {subRootId && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-600 mb-2">Estructura de la raíz seleccionada</div>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {padreOptions.map(opt => (
                        <li key={`tree-${opt.id}`} className="font-normal">
                          <span className={opt.depth===0 ? "font-medium" : ""}>
                            {`${"— ".repeat(opt.depth)}${opt.nombre}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4">
                  <button className={btnPrimary} disabled={!subForm.nombre.trim() || !subForm.padre_id}>
                    Crear subárea
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Grid de áreas (paginada) */}
      <div className="space-y-3">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {loading && Array.from({ length: 6 }).map((_,i)=> <SkeletonCard key={i} />)}
          {!loading && pageItems.map(a => (
            <div key={a.id} className={card + " p-4"}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold flex items-center gap-2">
                    {a.nombre}
                    <Badge kind={a.padre_id ? "child" : "root"} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">ID {a.id}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={()=>openInfo(a.id)}
                    className={btnBase}
                    title="Ver información"
                  >
                    Info
                  </button>
                  <Link
                    to={`/areas/${a.id}`}
                    className={btnPrimary}
                    title="Abrir área"
                  >
                    Abrir
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {!loading && filtered.length===0 && (
            <div className={card + " p-8 col-span-full"}>
              <div className="text-center">
                <div className="text-slate-600">No hay áreas que coincidan</div>
                {q && <div className="text-sm text-slate-500 mt-1">Prueba limpiar la búsqueda o revisa la ortografía.</div>}
              </div>
            </div>
          )}
        </div>

        {/* Paginación principal */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              Mostrando {(page - 1) * size + 1}–{Math.min(page * size, filtered.length)} de {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                className={btnBase}
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ◀
              </button>
              <span className="text-sm">Página {page} / {totalPages}</span>
              <button
                className={btnBase}
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                ▶
              </button>
              <select
                className={fieldBase + " w-28 py-1"}
                value={size}
                onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}
              >
                {[6, 9, 12, 18].map(n => <option key={n} value={n}>{n} / pág</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Modal Info */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[min(96vw,720px)]">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Información del área</div>
              <button onClick={()=>setShowInfo(false)} className={btnBase}>Cerrar</button>
            </div>

            <div className="p-4 space-y-4">
              {!info ? (
                <div className="text-slate-500">Cargando…</div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl ring-1 ring-slate-200 p-3">
                      <div className="text-xs text-slate-600">Área</div>
                      <div className="font-medium flex items-center gap-2">
                        {info.area.nombre} <span className="text-xs text-slate-500">ID {info.area.id}</span>
                        <Badge kind={info.area.padre_id ? "child" : "root"} />
                      </div>
                    </div>
                    <div className="rounded-xl ring-1 ring-slate-200 p-3">
                      <div className="text-xs text-slate-600">Jerarquía (ancestros)</div>
                      {info.ancestors.length === 0 ? (
                        <div className="text-slate-700">— Es raíz —</div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {info.ancestors.map((p, i) => (
                            <span key={p.id} className="inline-flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">{p.nombre}</span>
                              {i < info.ancestors.length - 1 && <span className="text-slate-400">›</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl ring-1 ring-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-xs text-slate-600">Subáreas directas</div>
                      <div className="flex items-center gap-2">
                        <button
                          className={btnBase + " py-1"}
                          disabled={subPage <= 1}
                          onClick={() => setSubPage(p => Math.max(1, p - 1))}
                        >
                          ◀
                        </button>
                        <span className="text-xs text-slate-600">
                          Página {subPage} / {subTotalPages}
                        </span>
                        <button
                          className={btnBase + " py-1"}
                          disabled={subPage >= subTotalPages}
                          onClick={() => setSubPage(p => Math.min(subTotalPages, p + 1))}
                        >
                          ▶
                        </button>
                        <select
                          className={fieldBase + " py-1 w-24"}
                          value={subSize}
                          onChange={(e) => { setSubSize(Number(e.target.value)); setSubPage(1); }}
                        >
                          {[4, 8, 12, 16].map(n => <option key={n} value={n}>{n} / pág</option>)}
                        </select>
                      </div>
                    </div>

                    {info.children.length === 0 ? (
                      <div className="text-slate-700">— Sin subáreas —</div>
                    ) : (
                      <ul className="grid sm:grid-cols-2 gap-2">
                        {subPageItems.map(c => (
                          <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-slate-700">{c.nombre}</div>
                            <span className="text-xs text-slate-500">ID {c.id}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
