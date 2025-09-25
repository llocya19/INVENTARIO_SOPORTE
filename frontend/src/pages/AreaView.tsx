// src/pages/AreaView.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http from "../api/http";

/* ---------- Tipos ---------- */
type Clase = "COMPONENTE" | "PERIFERICO";

type ItemRow = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string;
  created_at?: string | null;
  equipo?: { equipo_id: number; equipo_codigo: string; equipo_nombre: string } | null;
  ficha?: Record<string, any>;
};
type ItemsPage = { items: ItemRow[]; total: number; page: number; size: number };

type EquipoRow = {
  equipo_id: number;
  equipo_codigo: string;
  equipo_nombre: string;
  estado: string | null;
  usuario_final?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
type EquiposPage = { items: EquipoRow[]; total: number; page: number; size: number };

type ItemType = { id: number; clase: Clase; nombre: string };

type AreaInfo = {
  area: { id: number; nombre: string };
  ancestors: { id: number; nombre: string }[];
};

type Attr = {
  nombre: string;
  data_type: "text" | "int" | "numeric" | "bool" | "date";
  orden?: number | null;
};

/* ---------- Página ---------- */
export default function AreaView() {
  const { id } = useParams();
  const areaId = Number(id);

  const [tab, setTab] = useState<"COMPONENTE" | "PERIFERICO" | "EQUIPOS">("COMPONENTE");

  // paginación por pestaña (items)
  const [compPage, setCompPage] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });
  const [periPage, setPeriPage] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });

  // filtros por pestaña (items)
  const [compFilter, setCompFilter] = useState<{ tipo: string; desde: string; hasta: string }>({
    tipo: "",
    desde: "",
    hasta: "",
  });
  const [periFilter, setPeriFilter] = useState<{ tipo: string; desde: string; hasta: string }>({
    tipo: "",
    desde: "",
    hasta: "",
  });

  // Equipos: paginación y filtros
  const [eqPage, setEqPage] = useState<EquiposPage>({ items: [], total: 0, page: 1, size: 10 });
  const [eqFilter, setEqFilter] = useState<{ estado: string; desde: string; hasta: string }>({
    estado: "",
    desde: "",
    hasta: "",
  });

  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);
  const [info, setInfo] = useState<AreaInfo | null>(null);

  // Ficha dinámica
  const [schema, setSchema] = useState<Attr[]>([]);
  const claseActual: Clase = tab === "PERIFERICO" ? "PERIFERICO" : "COMPONENTE";

  // form crear item
  const [form, setForm] = useState<{ tipo_nombre: string; codigo: string; specs: { k: string; v: string }[] }>({
    tipo_nombre: "",
    codigo: "",
    specs: [],
  });

  // imágenes a subir (múltiples)
  const [files, setFiles] = useState<FileList | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // menú "+ Nuevo ▾"
  const [openMenu, setOpenMenu] = useState(false);

  // modal "Nuevo campo"
  const [showNewAttr, setShowNewAttr] = useState(false);
  const [newAttr, setNewAttr] = useState<{ nombre: string; data_type: Attr["data_type"] }>({
    nombre: "",
    data_type: "text",
  });

  // modal "Nuevo tipo"
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const typeOpts = claseActual === "COMPONENTE" ? typesC : typesP;

  /* ---------- Carga inicial (estático) ---------- */
  const loadStatic = async () => {
    setMsg(null);
    try {
      const [tC, tP, i] = await Promise.all([
        http.get<ItemType[]>(`/api/item-types?clase=COMPONENTE`),
        http.get<ItemType[]>(`/api/item-types?clase=PERIFERICO`),
        http.get<AreaInfo>(`/api/areas/${areaId}/info`),
      ]);
      setTypesC(tC.data || []);
      setTypesP(tP.data || []);
      setInfo(i.data || null);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar datos del área");
    }
  };

  /* ---------- Carga paginada (ítems) ---------- */
  const loadPagedItems = async (
    clase: Clase,
    page = 1,
    size = 10,
    filtro?: { tipo?: string; desde?: string; hasta?: string }
  ) => {
    const params: any = { clase, page, size };
    if (filtro?.tipo) params.tipo = filtro.tipo;
    if (filtro?.desde) params.desde = filtro.desde;
    if (filtro?.hasta) params.hasta = filtro.hasta;

    const r = await http.get<ItemsPage>(`/api/areas/${areaId}/items`, { params });
    const data: ItemsPage = r.data || { items: [], total: 0, page, size };
    if (clase === "COMPONENTE") setCompPage(data);
    else setPeriPage(data);
  };

  /* ---------- Carga paginada (equipos) ---------- */
  const loadPagedEquipos = async (
    page = 1,
    size = 10,
    filtro?: { estado?: string; desde?: string; hasta?: string }
  ) => {
    const params: any = { page, size };
    if (filtro?.estado) params.estado = filtro.estado;
    if (filtro?.desde) params.desde = filtro.desde;
    if (filtro?.hasta) params.hasta = filtro.hasta;

    const r = await http.get<any>(`/api/areas/${areaId}/equipos`, { params });

    // Soporta formato nuevo paginado o lista simple
    let data: EquiposPage;
    if (Array.isArray(r.data)) {
      data = { items: r.data, total: r.data.length, page, size };
    } else {
      const d = r.data || {};
      data = {
        items: d.items || [],
        total: Number(d.total || 0),
        page: Number(d.page || page),
        size: Number(d.size || size),
      };
    }
    setEqPage(data);
  };

  useEffect(() => {
    if (!Number.isFinite(areaId) || areaId <= 0) return;
    loadStatic();
    // primeras páginas
    loadPagedItems("COMPONENTE", 1, compPage.size, compFilter);
    loadPagedItems("PERIFERICO", 1, periPage.size, periFilter);
    loadPagedEquipos(1, eqPage.size, eqFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  /* ---------- Ficha dinámica ---------- */
  async function loadSchema(tipo: string) {
    if (!tipo) {
      setSchema([]);
      setForm((f) => ({ ...f, specs: [] }));
      return;
    }
    const r = await http.get<Attr[]>(`/api/spec/attrs`, { params: { clase: claseActual, tipo } });
    setSchema(r.data || []);
    setForm((f) => ({
      ...f,
      specs: (r.data || []).length ? (r.data || []).map((a) => ({ k: a.nombre, v: "" })) : [],
    }));
  }

  // pedir código sugerido cuando seleccionan tipo
  async function onChangeTipo(tipo: string) {
    setForm((f) => ({ ...f, tipo_nombre: tipo, codigo: "" }));
    await loadSchema(tipo);
    if (!tipo) return;
    try {
      const r = await http.get<{ next_code: string }>(`/api/items/next-code`, {
        params: { clase: claseActual, tipo, area_id: areaId },
      });
      setForm((f) => ({ ...f, codigo: r.data?.next_code || "" }));
    } catch {
      /* ignore */
    }
  }

  // Valida y normaliza según data_type
  function buildValidatedSpecs(): Record<string, any> | string {
    const out: Record<string, any> = {};
    for (const { k, v } of form.specs) {
      const key = (k ?? "").trim();
      if (!key) continue;
      const dt = schema.find((s) => s.nombre.toLowerCase() === key.toLowerCase())?.data_type || "text";

      if (dt === "int") {
        const n = Number.parseInt((v ?? "").toString().replace(/[^\d-]/g, ""), 10);
        if (Number.isNaN(n)) return `El campo ${key} debe ser entero`;
        out[key] = n;
      } else if (dt === "numeric") {
        const norm = (v ?? "").toString().replace(",", ".").replace(/[^0-9.\-]/g, "");
        const x = Number.parseFloat(norm);
        if (Number.isNaN(x)) return `El campo ${key} debe ser decimal`;
        out[key] = x;
      } else if (dt === "bool") {
        const s = (v ?? "").toString().toLowerCase();
        if (!["true", "false", "1", "0", "sí", "si", "no", "t", "f", "yes", "y", "n"].includes(s)) {
          return `El campo ${key} debe ser Sí/No`;
        }
        out[key] = ["true", "1", "sí", "si", "t", "yes", "y"].includes(s);
      } else if (dt === "date") {
        out[key] = v;
      } else {
        out[key] = v ?? "";
      }
    }
    return out;
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOk(null);
    if (!form.tipo_nombre) { setMsg("Selecciona un tipo"); return; }
    if (!form.codigo.trim()) { setMsg("Completa el código"); return; }

    const specsOrError = buildValidatedSpecs();
    if (typeof specsOrError === "string") { setMsg(specsOrError); return; }

    try {
      const r = await http.post<{ item_id: number }>("/api/items", {
        codigo: form.codigo.trim(),
        clase: claseActual,
        tipo_nombre: form.tipo_nombre,
        area_id: areaId,
        specs: specsOrError,
      });
      const itemId = r.data.item_id;

      if (files && files.length > 0) {
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append("files", f));
        await http.post(`/api/items/${itemId}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }

      setOk(`${claseActual === "COMPONENTE" ? "Componente" : "Periférico"} creado`);
      setForm({ tipo_nombre: form.tipo_nombre, codigo: "", specs: form.specs });
      setFiles(null);

      if (claseActual === "COMPONENTE") {
        await loadPagedItems("COMPONENTE", compPage.page, compPage.size, compFilter);
      } else {
        await loadPagedItems("PERIFERICO", periPage.page, periPage.size, periFilter);
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo crear");
    }
  }

  // Crear / eliminar campos y tipos
  async function createAttr() {
    if (!form.tipo_nombre || !newAttr.nombre.trim()) return;
    try {
      await http.post("/api/spec/attrs", {
        clase: claseActual,
        tipo_nombre: form.tipo_nombre,
        nombre_attr: newAttr.nombre.trim(),
        data_type: newAttr.data_type,
      });
      setShowNewAttr(false);
      const createdName = newAttr.nombre;
      setNewAttr({ nombre: "", data_type: "text" });
      await loadSchema(form.tipo_nombre);
      setOk(`Campo "${createdName}" creado para ${form.tipo_nombre}`);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo crear el campo");
    }
  }

  async function deleteAttrGlobal(attrName: string) {
    if (!form.tipo_nombre) return;
    const nombre_attr = attrName.trim();
    if (!nombre_attr) return;
    if (!confirm(`¿Eliminar el campo "${nombre_attr}" del tipo ${form.tipo_nombre} de forma GLOBAL?`)) return;

    setMsg(null); setOk(null);
    try {
      await http.delete("/api/spec/attrs", { data: { clase: claseActual, tipo_nombre: form.tipo_nombre, nombre_attr } });
      await loadSchema(form.tipo_nombre);
      setOk(`Campo "${nombre_attr}" eliminado del tipo ${form.tipo_nombre}`);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.response?.data?.error || "No se pudo eliminar el campo");
    }
  }

  function removePairAt(idx: number) {
    setForm((f) => {
      const copy = [...f.specs];
      copy.splice(idx, 1);
      return { ...f, specs: copy };
    });
  }

  async function createType() {
    const name = newTypeName.trim();
    if (!name) return;
    try {
      const res = await http.post<{ id: number; clase: string; nombre: string }>("/api/item-types", {
        clase: claseActual, nombre: name
      });
      const list = await http.get<ItemType[]>(`/api/item-types?clase=${claseActual}`);
      if (claseActual === "COMPONENTE") setTypesC(list.data || []); else setTypesP(list.data || []);
      setShowNewType(false); setNewTypeName("");
      await onChangeTipo(res.data.nombre);
      setOk(`Tipo "${res.data.nombre}" creado`);
    } catch (e: any) { setMsg(e?.response?.data?.error || "No se pudo crear el tipo"); }
  }

  // Helpers paginación
  const onChangePageItems = async (cls: Clase, page: number) => {
    const size = cls === "COMPONENTE" ? compPage.size : periPage.size;
    const filt = cls === "COMPONENTE" ? compFilter : periFilter;
    await loadPagedItems(cls, page, size, filt);
  };
  const onChangeSizeItems = async (cls: Clase, size: number) => {
    const filt = cls === "COMPONENTE" ? compFilter : periFilter;
    await loadPagedItems(cls, 1, size, filt);
    if (cls === "COMPONENTE") setCompPage((p) => ({ ...p, size })); else setPeriPage((p) => ({ ...p, size }));
  };
  const applyFiltersItems = async (cls: Clase) => {
    const filt = cls === "COMPONENTE" ? compFilter : periFilter;
    await loadPagedItems(cls, 1, cls === "COMPONENTE" ? compPage.size : periPage.size, filt);
  };

  // Equipos
  const onChangePageEquipos = async (page: number) => {
    await loadPagedEquipos(page, eqPage.size, eqFilter);
  };
  const onChangeSizeEquipos = async (size: number) => {
    await loadPagedEquipos(1, size, eqFilter);
    setEqPage((p) => ({ ...p, size }));
  };
  const applyFiltersEquipos = async () => {
    await loadPagedEquipos(1, eqPage.size, eqFilter);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">{info?.area?.nombre || "Área"}</div>
          {info && (
            <div className="text-sm text-slate-500 flex flex-wrap gap-1">
              {info.ancestors.length === 0 ? (
                <span>Raíz</span>
              ) : (
                <>
                  <span>Subárea de:</span>
                  {info.ancestors.map((a) => (
                    <span key={a.id} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
                      {a.nombre}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Equipos + menú “+ Nuevo ▾” */}
        <div className="relative">
          <span className="inline-flex rounded-lg">
            <button
              onClick={() => {
                setTab("EQUIPOS");
                setForm({ tipo_nombre: "", codigo: "", specs: [] });
                setSchema([]); setFiles(null);
              }}
              className={`px-4 py-2 ${tab === "EQUIPOS" ? "bg-slate-900 text-white" : "bg-white border border-slate-300"}`}
              style={tab === "EQUIPOS" ? {} : { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}
            >
              Equipos
            </button>
            <button
              onClick={() => setOpenMenu(v => !v)}
              className={`px-3 py-2 ${tab === "EQUIPOS"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-white border border-slate-300 hover:bg-slate-50"}`}
              style={tab === "EQUIPOS" ? {} : { borderTopRightRadius: 8, borderBottomRightRadius: 8 }}
              title="Crear nuevo equipo"
            >
              + Nuevo ▾
            </button>
          </span>

          {openMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-white border rounded-lg shadow-lg z-20">
              <Link
                to={`/areas/${areaId}/equipos/nuevo`}
                className="block px-3 py-2 hover:bg-slate-50"
                onClick={() => setOpenMenu(false)}
              >
                Crear desde ALMACÉN
              </Link>
              <Link
                to={`/areas/${areaId}/equipos/nuevo-uso`}
                className="block px-3 py-2 hover:bg-slate-50"
                onClick={() => setOpenMenu(false)}
              >
                Crear en USO (con nuevos ítems)
              </Link>
            </div>
          )}
        </div>
      </div>

      {msg && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Tabs arriba (items) */}
      <div className="flex gap-2">
        {(["COMPONENTE", "PERIFERICO"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setForm({ tipo_nombre: "", codigo: "", specs: [] });
              setSchema([]); setFiles(null);
            }}
            className={`px-4 py-2 rounded-lg ${tab === t ? "bg-slate-900 text-white" : "bg-white border border-slate-300"}`}
          >
            {t === "COMPONENTE" ? "Componentes" : "Periféricos"}
          </button>
        ))}
      </div>

      {/* Filtros (arriba del listado de items) */}
      {tab !== "EQUIPOS" && (
        <div className="bg-white rounded-2xl shadow p-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-sm text-slate-600">Tipo</div>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={tab === "COMPONENTE" ? compFilter.tipo : periFilter.tipo}
              onChange={(e) =>
                tab === "COMPONENTE"
                  ? setCompFilter((f) => ({ ...f, tipo: e.target.value }))
                  : setPeriFilter((f) => ({ ...f, tipo: e.target.value }))
              }
            >
              <option value="">(Todos)</option>
              {(tab === "COMPONENTE" ? typesC : typesP).map((t) => (
                <option key={t.id} value={t.nombre}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm text-slate-600">Desde</div>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={tab === "COMPONENTE" ? compFilter.desde : periFilter.desde}
              onChange={(e) =>
                tab === "COMPONENTE"
                  ? setCompFilter((f) => ({ ...f, desde: e.target.value }))
                  : setPeriFilter((f) => ({ ...f, desde: e.target.value }))
              }
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Hasta</div>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={tab === "COMPONENTE" ? compFilter.hasta : periFilter.hasta}
              onChange={(e) =>
                tab === "COMPONENTE"
                  ? setCompFilter((f) => ({ ...f, hasta: e.target.value }))
                  : setPeriFilter((f) => ({ ...f, hasta: e.target.value }))
              }
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
              onClick={() => applyFiltersItems(tab === "COMPONENTE" ? "COMPONENTE" : "PERIFERICO")}
            >
              Aplicar
            </button>
            <button
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
              onClick={async () => {
                if (tab === "COMPONENTE") setCompFilter({ tipo: "", desde: "", hasta: "" });
                else setPeriFilter({ tipo: "", desde: "", hasta: "" });
                await applyFiltersItems(tab === "COMPONENTE" ? "COMPONENTE" : "PERIFERICO");
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Formulario crear (Componentes/Periféricos) */}
      {tab !== "EQUIPOS" && (
        <form onSubmit={createItem} className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <div className="text-sm text-slate-600">
                Tipo <span className="text-slate-400">({claseActual})</span>
              </div>
              <div className="flex gap-2">
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.tipo_nombre}
                  onChange={(e) => onChangeTipo(e.target.value)}
                >
                  <option value="">Seleccione…</option>
                  {typeOpts.map((t) => (
                    <option key={t.id} value={t.nombre}>{t.nombre}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewType(true)}
                  className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
                  title="Crear nuevo tipo"
                >
                  + Nuevo tipo
                </button>
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-600">Código</div>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Se sugiere al elegir tipo"
              />
            </div>

            <div className="flex items-end sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowNewAttr(true)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
                disabled={!form.tipo_nombre}
                title={!form.tipo_nombre ? "Seleccione un tipo primero" : ""}
              >
                + Nuevo campo
              </button>
            </div>
          </div>

          {/* Subida múltiple de imágenes */}
          {form.tipo_nombre && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-slate-600">Imágenes (múltiples)</div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  onChange={(e) => setFiles(e.target.files)}
                />
                <div className="text-xs text-slate-500 mt-1">
                  Se adjuntarán después de crear el {claseActual === "COMPONENTE" ? "componente" : "periférico"}.
                </div>
              </div>
            </div>
          )}

          {/* Campos de ficha dinámica */}
          <div>
            <div className="text-sm text-slate-600 mb-1">Ficha (pares clave/valor)</div>
            {!form.tipo_nombre ? (
              <div className="p-3 rounded-lg bg-slate-50 text-slate-600 text-sm">
                Selecciona un tipo para ver sus campos.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {form.specs.map((row, idx) => {
                    const dt = schema.find((s) => s.nombre.toLowerCase() === row.k.toLowerCase())?.data_type || "text";
                    const isSchemaField = schema.some((s) => s.nombre.toLowerCase() === row.k.toLowerCase());
                    return (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
                        <div className="flex gap-2">
                          <input
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="Atributo (ej. MARCA)"
                            value={row.k}
                            onChange={(e) => {
                              const copy = [...form.specs];
                              copy[idx].k = e.target.value;
                              setForm({ ...form, specs: copy });
                            }}
                          />
                          {isSchemaField ? (
                            <button
                              type="button"
                              className="px-2 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs"
                              title="Eliminar este campo del TIPO (GLOBAL)"
                              onClick={() => deleteAttrGlobal(row.k)}
                            >
                              Eliminar del tipo
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="px-2 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs"
                              title="Quitar este par del formulario"
                              onClick={() => removePairAt(idx)}
                            >
                              Quitar par
                            </button>
                          )}
                        </div>

                        {dt === "bool" ? (
                          <select
                            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2"
                            value={row.v}
                            onChange={(e) => {
                              const copy = [...form.specs];
                              copy[idx].v = e.target.value;
                              setForm({ ...form, specs: copy });
                            }}
                          >
                            <option value="">--</option>
                            <option value="true">Sí</option>
                            <option value="false">No</option>
                          </select>
                        ) : dt === "date" ? (
                          <input
                            type="date"
                            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2"
                            value={row.v}
                            onChange={(e) => {
                              const copy = [...form.specs];
                              copy[idx].v = e.target.value;
                              setForm({ ...form, specs: copy });
                            }}
                          />
                        ) : (
                          <input
                            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2"
                            placeholder={dt === "int" ? "número entero" : dt === "numeric" ? "número decimal" : "texto"}
                            value={row.v}
                            onChange={(e) => {
                              const copy = [...form.specs];
                              copy[idx].v = e.target.value;
                              setForm({ ...form, specs: copy });
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, specs: [...form.specs, { k: "", v: "" }] })}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
                  >
                    + Agregar par
                  </button>
                </div>
              </>
            )}
          </div>

          <div>
            <button className="px-4 py-2 rounded-lg bg-slate-900 text-white">
              Crear {claseActual === "COMPONENTE" ? "componente" : "periférico"}
            </button>
          </div>
        </form>
      )}

      {/* Listas paginadas de Ítems */}
      {tab === "COMPONENTE" && (
        <ItemsTable
          page={compPage}
          onPage={(p) => onChangePageItems("COMPONENTE", p)}
          onSize={(s) => onChangeSizeItems("COMPONENTE", s)}
        />
      )}
      {tab === "PERIFERICO" && (
        <ItemsTable
          page={periPage}
          onPage={(p) => onChangePageItems("PERIFERICO", p)}
          onSize={(s) => onChangeSizeItems("PERIFERICO", s)}
        />
      )}

      {/* Equipos: filtros + lista paginada */}
      {tab === "EQUIPOS" && (
        <>
          <div className="bg-white rounded-2xl shadow p-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-sm text-slate-600">Estado</div>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={eqFilter.estado}
                onChange={(e) => setEqFilter((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="">(Todos)</option>
                <option value="USO">USO</option>
                <option value="ALMACEN">ALMACEN</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="BAJA">BAJA</option>
              </select>
            </div>
            <div>
              <div className="text-sm text-slate-600">Desde</div>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={eqFilter.desde}
                onChange={(e) => setEqFilter((f) => ({ ...f, desde: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-sm text-slate-600">Hasta</div>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={eqFilter.hasta}
                onChange={(e) => setEqFilter((f) => ({ ...f, hasta: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
                onClick={applyFiltersEquipos}
              >
                Aplicar
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
                onClick={async () => {
                  setEqFilter({ estado: "", desde: "", hasta: "" });
                  await applyFiltersEquipos();
                }}
              >
                Limpiar
              </button>
            </div>
          </div>

          <EquiposTable
            page={eqPage}
            onPage={onChangePageEquipos}
            onSize={onChangeSizeEquipos}
          />
        </>
      )}

      {/* Modal: nuevo campo */}
      {showNewAttr && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-md">
            <div className="text-lg font-semibold mb-2">Nuevo campo para {form.tipo_nombre || "tipo"}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-slate-600">Nombre del atributo</div>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={newAttr.nombre}
                  onChange={(e) => setNewAttr({ ...newAttr, nombre: e.target.value })}
                  placeholder="p. ej. CAPACIDAD_GB"
                />
              </div>
              <div>
                <div className="text-sm text-slate-600">Tipo de dato</div>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={newAttr.data_type}
                  onChange={(e) => setNewAttr({ ...newAttr, data_type: e.target.value as Attr["data_type"] })}
                >
                  <option value="text">text</option>
                  <option value="int">int</option>
                  <option value="numeric">numeric</option>
                  <option value="bool">bool</option>
                  <option value="date">date</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={() => setShowNewAttr(false)}>
                Cancelar
              </button>
              <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={createAttr}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: nuevo tipo */}
      {showNewType && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-md">
            <div className="text-lg font-semibold mb-2">
              Nuevo tipo ({claseActual === "COMPONENTE" ? "Componente" : "Periférico"})
            </div>
            <div>
              <div className="text-sm text-slate-600">Nombre del tipo</div>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="p. ej. DISCO, MEMORIA, TECLADO…"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={() => setShowNewType(false)}>
                Cancelar
              </button>
              <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={createType}>
                Crear tipo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Auxiliares: ItemsTable y EquiposTable ---------- */
function ItemsTable({
  page,
  onPage,
  onSize,
}: {
  page: ItemsPage;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((page.total || 0) / (page.size || 10)));
  return (
    <div className="bg-white rounded-2xl shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-600">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Registrado</th>
              <th className="px-3 py-2">En equipo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((r) => (
              <tr key={r.item_id} className="border-t">
                <td className="px-3 py-2">{r.item_codigo}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2">{r.estado}</td>
                <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">
                  {r.equipo ? `${r.equipo.equipo_codigo} · ${r.equipo.equipo_nombre}` : "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link to={`/items/${r.item_id}`} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm">
                    Ver ficha
                  </Link>
                </td>
              </tr>
            ))}
            {page.items.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={6}>
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between p-3">
        <div className="text-sm text-slate-600">Total: {page.total}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border"
            disabled={page.page <= 1}
            onClick={() => onPage(page.page - 1)}
          >
            ◀
          </button>
          <span className="text-sm">
            Página {page.page} / {totalPages}
          </span>
          <button
            type="button"
            className="px-3 py-1.5 rounded border"
            disabled={page.page >= totalPages}
            onClick={() => onPage(page.page + 1)}
          >
            ▶
          </button>
          <select
            className="ml-2 rounded border px-2 py-1 text-sm"
            value={page.size}
            onChange={(e) => onSize(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / pág
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function EquiposTable({
  page,
  onPage,
  onSize,
}: {
  page: EquiposPage;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((page.total || 0) / (page.size || 10)));
  const rows = Array.isArray(page.items) ? page.items : [];
  return (
    <div className="bg-white rounded-2xl shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-600">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Usuario final</th>
              <th className="px-3 py-2">Ingresó</th>
              <th className="px-3 py-2">Modificado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.equipo_id} className="border-t">
                <td className="px-3 py-2">{r.equipo_codigo}</td>
                <td className="px-3 py-2">{r.equipo_nombre}</td>
                <td className="px-3 py-2">{r.estado || "-"}</td>
                <td className="px-3 py-2">{r.usuario_final || "-"}</td>
                <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2 text-right">
                  <Link to={`/equipos/${r.equipo_id}`} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={7}>
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between p-3">
        <div className="text-sm text-slate-600">Total: {page.total}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border"
            disabled={page.page <= 1}
            onClick={() => onPage(page.page - 1)}
          >
            ◀
          </button>
          <span className="text-sm">
            Página {page.page} / {totalPages}
          </span>
          <button
            type="button"
            className="px-3 py-1.5 rounded border"
            disabled={page.page >= totalPages}
            onClick={() => onPage(page.page + 1)}
          >
            ▶
          </button>
          <select
            className="ml-2 rounded border px-2 py-1 text-sm"
            value={page.size}
            onChange={(e) => onSize(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / pág
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
