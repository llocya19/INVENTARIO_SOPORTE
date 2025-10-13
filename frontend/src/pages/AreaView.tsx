// src/pages/AreaView.tsx
import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  // nuevos
  prestamo_text?: string | null;
  puede_devolver?: boolean;
  es_prestamo_recibido?: boolean;
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

/* =========================================================
   UI helpers (botones / badges / vacíos)
========================================================= */
function Icon({ name, className = "h-4 w-4" }: { name: "back" | "plus" | "camera" | "chevL" | "chevR"; className?: string }) {
  if (name === "back")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  if (name === "plus")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  if (name === "camera")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M4 7h3l2-2h6l2 2h3v12H4V7z" stroke="currentColor" strokeWidth="2"/>
        <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2"/>
      </svg>
    );
  if (name === "chevL")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "subtle" | "danger" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition";
  const map = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50",
    secondary: "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-50",
    subtle: "bg-white/60 border border-slate-200 text-slate-700 hover:bg-white",
    danger: "bg-rose-600 text-white hover:bg-rose-700"
  };
  return (
    <button className={`${base} ${map[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "emerald" | "amber" | "sky" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    sky: "bg-sky-100 text-sky-700",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${map[tone]}`}>{children}</span>;
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-10">
      <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">—</div>
      <div className="font-medium text-slate-700">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

/* =========================================================
   Cámara embebida
========================================================= */
function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!open) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          (videoRef.current as any).srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        onClose();
      }
    }
    init();
    return () => {
      cancelled = true;
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, [open, onClose]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.9);
  }
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold">Cámara</div>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
        <div className="p-4 space-y-3">
          <video ref={videoRef} playsInline muted className="w-full rounded-lg bg-black aspect-video object-contain" />
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={takePhoto}><Icon name="camera" /> Capturar</Button>
            <Button variant="primary" onClick={onClose}>Listo</Button>
          </div>
          <div className="text-xs text-slate-500">Evita contraluz y acerca el equipo para una mejor lectura.</div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Página
========================================================= */
export default function AreaView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const areaId = Number(id);

  const [tab, setTab] = useState<"COMPONENTE" | "PERIFERICO" | "EQUIPOS">("COMPONENTE");

  // paginación por pestaña (items)
  const [compPage, setCompPage] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });
  const [periPage, setPeriPage] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });

  // filtros por pestaña (items)
  const [compFilter, setCompFilter] = useState<{ tipo: string; desde: string; hasta: string }>({ tipo: "", desde: "", hasta: "" });
  const [periFilter, setPeriFilter] = useState<{ tipo: string; desde: string; hasta: string }>({ tipo: "", desde: "", hasta: "" });

  // Equipos: paginación y filtros
  const [eqPage, setEqPage] = useState<EquiposPage>({ items: [], total: 0, page: 1, size: 10 });
  const [eqFilter, setEqFilter] = useState<{ estado: string; desde: string; hasta: string }>({ estado: "", desde: "", hasta: "" });

  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);
  const [info, setInfo] = useState<AreaInfo | null>(null);

  // Ficha dinámica
  const [schema, setSchema] = useState<Attr[]>([]);
  const claseActual: Clase = tab === "PERIFERICO" ? "PERIFERICO" : "COMPONENTE";

  // form crear item
  const [form, setForm] = useState<{ tipo_nombre: string; codigo: string; specs: { k: string; v: string }[] }>({ tipo_nombre: "", codigo: "", specs: [] });

  // imágenes
  const [files, setFiles] = useState<FileList | null>(null);
  const [captured, setCaptured] = useState<Blob[]>([]);
  const [showCam, setShowCam] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // menú “+ Nuevo”
  const [openMenu, setOpenMenu] = useState(false);

  // modal "Nuevo campo"
  const [showNewAttr, setShowNewAttr] = useState(false);
  const [newAttr, setNewAttr] = useState<{ nombre: string; data_type: Attr["data_type"] }>({ nombre: "", data_type: "text" });

  // modal "Nuevo tipo"
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const typeOpts = claseActual === "COMPONENTE" ? typesC : typesP;

  /* ---------- Carga inicial ---------- */
  const loadStatic = async () => {
    setMsg(null);
    try {
      const [tC, tP, i] = await Promise.all([
        http.get<ItemType[]>(`/api/item-types?clase=COMPONENTE`),
        http.get<ItemType[]>(`/api/item-types?clase=PERIFERICO`),
        http.get<AreaInfo>(`/api/areas/${areaId}/info`),
      ]);
      setTypesC(tC.data || []); setTypesP(tP.data || []); setInfo(i.data || null);
    } catch (e: any) { setMsg(e?.response?.data?.error || "No se pudo cargar datos del área"); }
  };

  const loadPagedItems = async (clase: Clase, page = 1, size = 10, filtro?: { tipo?: string; desde?: string; hasta?: string }) => {
    const params: any = { clase, page, size };
    if (filtro?.tipo) params.tipo = filtro.tipo;
    if (filtro?.desde) params.desde = filtro.desde;
    if (filtro?.hasta) params.hasta = filtro.hasta;
    const r = await http.get<ItemsPage>(`/api/areas/${areaId}/items`, { params });
    const data: ItemsPage = r.data || { items: [], total: 0, page, size };
    if (clase === "COMPONENTE") setCompPage(data); else setPeriPage(data);
  };

  const loadPagedEquipos = async (page = 1, size = 10, filtro?: { estado?: string; desde?: string; hasta?: string }) => {
    const params: any = { page, size };
    if (filtro?.estado) params.estado = filtro.estado;
    if (filtro?.desde) params.desde = filtro.desde;
    if (filtro?.hasta) params.hasta = filtro.hasta;
    const r = await http.get<any>(`/api/areas/${areaId}/equipos`, { params });
    let data: EquiposPage;
    if (Array.isArray(r.data)) data = { items: r.data, total: r.data.length, page, size };
    else {
      const d = r.data || {};
      data = { items: d.items || [], total: Number(d.total || 0), page: Number(d.page || page), size: Number(d.size || size) };
    }
    setEqPage(data);
  };

  useEffect(() => {
    if (!Number.isFinite(areaId) || areaId <= 0) return;
    loadStatic();
    loadPagedItems("COMPONENTE", 1, compPage.size, compFilter);
    loadPagedItems("PERIFERICO", 1, periPage.size, periFilter);
    loadPagedEquipos(1, eqPage.size, { estado: "", desde: "", hasta: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  /* ---------- Ficha dinámica ---------- */
  async function loadSchema(tipo: string) {
    if (!tipo) { setSchema([]); setForm((f) => ({ ...f, specs: [] })); return; }
    const r = await http.get<Attr[]>(`/api/spec/attrs`, { params: { clase: claseActual, tipo } });
    setSchema(r.data || []);
    setForm((f) => ({ ...f, specs: (r.data || []).length ? (r.data || []).map((a) => ({ k: a.nombre, v: "" })) : [] }));
  }

  async function onChangeTipo(tipo: string) {
    setForm((f) => ({ ...f, tipo_nombre: tipo, codigo: "" }));
    await loadSchema(tipo);
    if (!tipo) return;
    try {
      const r = await http.get<{ next_code: string }>(`/api/items/next-code`, { params: { clase: claseActual, tipo, area_id: areaId } });
      setForm((f) => ({ ...f, codigo: r.data?.next_code || "" }));
    } catch {}
  }

  function buildValidatedSpecs(): Record<string, any> | string {
    const out: Record<string, any> = {};
    for (const { k, v } of form.specs) {
      const key = (k ?? "").trim(); if (!key) continue;
      const dt = schema.find((s) => s.nombre.toLowerCase() === key.toLowerCase())?.data_type || "text";
      if (dt === "int") {
        const n = Number.parseInt((v ?? "").toString().replace(/[^\d-]/g, ""), 10);
        if (Number.isNaN(n)) return `El campo ${key} debe ser entero`; out[key] = n;
      } else if (dt === "numeric") {
        const norm = (v ?? "").toString().replace(",", ".").replace(/[^0-9.\-]/g, "");
        const x = Number.parseFloat(norm); if (Number.isNaN(x)) return `El campo ${key} debe ser decimal`; out[key] = x;
      } else if (dt === "bool") {
        const s = (v ?? "").toString().toLowerCase();
        if (!["true","false","1","0","sí","si","no","t","f","yes","y","n"].includes(s)) return `El campo ${key} debe ser Sí/No`;
        out[key] = ["true","1","sí","si","t","yes","y"].includes(s);
      } else if (dt === "date") out[key] = v;
      else out[key] = v ?? "";
    }
    return out;
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setOk(null);
    if (!form.tipo_nombre) { setMsg("Selecciona un tipo"); return; }
    if (!form.codigo.trim()) { setMsg("Completa el código"); return; }
    const specsOrError = buildValidatedSpecs();
    if (typeof specsOrError === "string") { setMsg(specsOrError); return; }

    try {
      const r = await http.post<{ item_id: number }>("/api/items", {
        codigo: form.codigo.trim(), clase: claseActual, tipo_nombre: form.tipo_nombre, area_id: areaId, specs: specsOrError,
      });
      const itemId = r.data.item_id;

      const fd = new FormData();
      if (files && files.length > 0) Array.from(files).forEach((f) => fd.append("files", f));
      if (captured.length > 0) captured.forEach((blob, i) => fd.append("files", new File([blob], `cam-${Date.now()}-${i}.jpg`, { type: "image/jpeg" })));
      if (fd.has("files")) await http.post(`/api/items/${itemId}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });

      setOk(`${claseActual === "COMPONENTE" ? "Componente" : "Periférico"} creado`);
      setForm({ tipo_nombre: form.tipo_nombre, codigo: "", specs: form.specs }); setFiles(null); setCaptured([]);
      if (claseActual === "COMPONENTE") await loadPagedItems("COMPONENTE", compPage.page, compPage.size, compFilter);
      else await loadPagedItems("PERIFERICO", periPage.page, periPage.size, periFilter);
    } catch (e: any) { setMsg(e?.response?.data?.error || "No se pudo crear"); }
  }

  async function createAttr() {
    if (!form.tipo_nombre || !newAttr.nombre.trim()) return;
    try {
      await http.post("/api/spec/attrs", {
        clase: claseActual, tipo_nombre: form.tipo_nombre, nombre_attr: newAttr.nombre.trim(), data_type: newAttr.data_type,
      });
      setShowNewAttr(false);
      const createdName = newAttr.nombre;
      setNewAttr({ nombre: "", data_type: "text" });
      await loadSchema(form.tipo_nombre);
      setOk(`Campo "${createdName}" creado para ${form.tipo_nombre}`);
    } catch (e: any) { setMsg(e?.response?.data?.error || "No se pudo crear el campo"); }
  }

  async function deleteAttrGlobal(attrName: string) {
    if (!form.tipo_nombre) return;
    const nombre_attr = attrName.trim(); if (!nombre_attr) return;
    if (!confirm(`¿Eliminar el campo "${nombre_attr}" del tipo ${form.tipo_nombre} de forma GLOBAL?`)) return;
    setMsg(null); setOk(null);
    try {
      await http.delete("/api/spec/attrs", { data: { clase: claseActual, tipo_nombre: form.tipo_nombre, nombre_attr } });
      await loadSchema(form.tipo_nombre);
      setOk(`Campo "${nombre_attr}" eliminado del tipo ${form.tipo_nombre}`);
    } catch (e: any) { setMsg(e?.response?.data?.message || e?.response?.data?.error || "No se pudo eliminar el campo"); }
  }

  function removePairAt(idx: number) {
    setForm((f) => { const copy = [...f.specs]; copy.splice(idx, 1); return { ...f, specs: copy }; });
  }

  async function createType() {
    const name = newTypeName.trim(); if (!name) return;
    try {
      const res = await http.post<{ id: number; clase: string; nombre: string }>("/api/item-types", { clase: claseActual, nombre: name });
      const list = await http.get<ItemType[]>(`/api/item-types?clase=${claseActual}`);
      if (claseActual === "COMPONENTE") setTypesC(list.data || []); else setTypesP(list.data || []);
      setShowNewType(false); setNewTypeName("");
      await onChangeTipo(res.data.nombre);
      setOk(`Tipo "${res.data.nombre}" creado`);
    } catch (e: any) { setMsg(e?.response?.data?.error || "No se pudo crear el tipo"); }
  }

  // helpers paginación
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
  const onChangePageEquipos = async (page: number) => { await loadPagedEquipos(page, eqPage.size, eqFilter); };
  const onChangeSizeEquipos = async (size: number) => { await loadPagedEquipos(1, size, eqFilter); setEqPage((p) => ({ ...p, size })); };
  const applyFiltersEquipos = async () => { await loadPagedEquipos(1, eqPage.size, eqFilter); };

  /* ---------- Devolución ---------- */
  async function doDevolver(item: ItemRow) {
    if (!confirm(`¿Devolver ${item.item_codigo} a ALMACEN?`)) return;
    setMsg(null);
    try {
      await http.post(`/api/items/${item.item_id}/devolver`);
      setOk(`Ítem ${item.item_codigo} devuelto a ALMACEN`);
      await loadPagedItems(item.clase, item.clase === "COMPONENTE" ? compPage.page : periPage.page, item.clase === "COMPONENTE" ? compPage.size : periPage.size, item.clase === "COMPONENTE" ? compFilter : periFilter);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo devolver el ítem");
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* App bar */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="secondary"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/areas"))}
              title="Volver"
            >
              <Icon name="back" /> Atrás
            </Button>
            <div>
              <div className="text-2xl font-semibold tracking-tight">{info?.area?.nombre || "Área"}</div>
              {info && (
                <div className="text-sm text-slate-500 flex flex-wrap items-center gap-1 mt-1">
                  {info.ancestors.length === 0 ? (
                    <Badge>Raíz</Badge>
                  ) : (
                    <>
                      <span className="text-slate-400 mr-1">Ruta:</span>
                      {info.ancestors.map((a, i) => (
                        <span key={a.id} className="inline-flex items-center gap-1">
                          <Link to={`/areas/${a.id}`} className="underline-offset-2 hover:underline text-slate-700">{a.nombre}</Link>
                          {i < info.ancestors.length - 1 && <span className="text-slate-400">/</span>}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Acciones de equipos */}
          <div className="relative">
            <div className="inline-flex rounded-lg shadow-sm overflow-hidden">
              <Button
                variant={tab === "EQUIPOS" ? "primary" : "secondary"}
                onClick={() => setTab("EQUIPOS")}
                className="rounded-none"
              >
                Equipos
              </Button>
              <Button
                variant={tab === "EQUIPOS" ? "primary" : "secondary"}
                onClick={() => setOpenMenu((v) => !v)}
                className="rounded-none"
                title="Crear nuevo equipo"
              >
                <Icon name="plus" /> Nuevo
              </Button>
            </div>

            {openMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white border rounded-xl shadow-lg z-20 overflow-hidden">
                <Link to={`/areas/${areaId}/equipos/nuevo`} className="block px-3 py-2 hover:bg-slate-50" onClick={() => setOpenMenu(false)}>
                  Crear desde ALMACÉN
                </Link>
                <Link to={`/areas/${areaId}/equipos/nuevo-uso`} className="block px-3 py-2 hover:bg-slate-50" onClick={() => setOpenMenu(false)}>
                  Crear en USO (con nuevos ítems)
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {msg && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">{msg}</div>}
      {ok && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Tabs items */}
      <div className="flex gap-2">
        {(["COMPONENTE", "PERIFERICO"] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "primary" : "secondary"}
            onClick={() => setTab(t)}
          >
            {t === "COMPONENTE" ? "Componentes" : "Periféricos"}
          </Button>
        ))}
      </div>

      {/* Filtros items */}
      {tab !== "EQUIPOS" && (
        <div className="bg-white rounded-2xl shadow-sm border p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-sm text-slate-600 mb-1">Tipo</div>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              value={tab === "COMPONENTE" ? compFilter.tipo : periFilter.tipo}
              onChange={(e) => (tab === "COMPONENTE" ? setCompFilter((f) => ({ ...f, tipo: e.target.value })) : setPeriFilter((f) => ({ ...f, tipo: e.target.value })))}
            >
              <option value="">(Todos)</option>
              {(tab === "COMPONENTE" ? typesC : typesP).map((t) => (
                <option key={t.id} value={t.nombre}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-1">Desde</div>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              value={tab === "COMPONENTE" ? compFilter.desde : periFilter.desde}
              onChange={(e) => (tab === "COMPONENTE" ? setCompFilter((f) => ({ ...f, desde: e.target.value })) : setPeriFilter((f) => ({ ...f, desde: e.target.value })))}
            />
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-1">Hasta</div>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              value={tab === "COMPONENTE" ? compFilter.hasta : periFilter.hasta}
              onChange={(e) => (tab === "COMPONENTE" ? setCompFilter((f) => ({ ...f, hasta: e.target.value })) : setPeriFilter((f) => ({ ...f, hasta: e.target.value })))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={() => applyFiltersItems(tab === "COMPONENTE" ? "COMPONENTE" : "PERIFERICO")}>Aplicar</Button>
            <Button
              variant="subtle"
              onClick={async () => {
                if (tab === "COMPONENTE") setCompFilter({ tipo: "", desde: "", hasta: "" });
                else setPeriFilter({ tipo: "", desde: "", hasta: "" });
                await applyFiltersItems(tab === "COMPONENTE" ? "COMPONENTE" : "PERIFERICO");
              }}
            >
              Limpiar
            </Button>
          </div>
        </div>
      )}

      {/* Form crear item */}
      {/* (Se mantiene igual que antes para registrar componentes/periféricos con fotos y ficha) */}
      {tab !== "EQUIPOS" && (
        <form onSubmit={createItem} className="bg-white rounded-2xl shadow-sm border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-medium">Nuevo {claseActual === "COMPONENTE" ? "componente" : "periférico"}</div>
              <div className="text-sm text-slate-500">Completa los datos y adjunta imágenes si corresponde.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <div className="text-sm text-slate-600 mb-1">
                Tipo <span className="text-slate-400">({claseActual})</span>
              </div>
              <div className="flex gap-2">
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value={form.tipo_nombre} onChange={(e) => onChangeTipo(e.target.value)}>
                  <option value="">Seleccione…</option>
                  {typeOpts.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                </select>
                <Button type="button" variant="secondary" onClick={() => setShowNewType(true)} title="Crear nuevo tipo">
                  <Icon name="plus" /> Tipo
                </Button>
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-600 mb-1">Código</div>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Se sugiere al elegir tipo" />
            </div>

            <div className="flex items-end sm:col-span-2">
              <Button type="button" variant="secondary" className="w-full" disabled={!form.tipo_nombre} title={!form.tipo_nombre ? "Seleccione un tipo primero" : ""} onClick={() => setShowNewAttr(true)}>
                <Icon name="plus" /> Campo
              </Button>
            </div>
          </div>

          {/* Imágenes */}
          {form.tipo_nombre && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm text-slate-600">Imágenes (múltiples)</div>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 cursor-pointer text-sm bg-white hover:bg-slate-50">
                  <Icon name="camera" /> Subir / Cámara
                  <input type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={(e) => setFiles(e.target.files)} />
                </label>
                <Button type="button" variant="secondary" onClick={() => setShowCam(true)}><Icon name="camera" /> Tomar foto</Button>
                {(files?.length || 0) > 0 && <div className="text-xs text-slate-600">Seleccionadas: {files?.length || 0}</div>}
                {captured.length > 0 && <div className="text-xs text-slate-600">Capturadas: {captured.length}</div>}
                <div className="text-xs text-slate-500">Se adjuntarán después de crear el {claseActual === "COMPONENTE" ? "componente" : "periférico"}.</div>
              </div>
            </div>
          )}

          {/* Ficha dinámica */}
          <div>
            <div className="text-sm text-slate-600 mb-1">Ficha (pares clave/valor)</div>
            {!form.tipo_nombre ? (
              <div className="p-3 rounded-lg bg-slate-50 text-slate-600 text-sm">Selecciona un tipo para ver sus campos.</div>
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
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 bg-white"
                            placeholder="Atributo (ej. MARCA)"
                            value={row.k}
                            onChange={(e) => { const copy = [...form.specs]; copy[idx].k = e.target.value; setForm({ ...form, specs: copy }); }}
                          />
                          {isSchemaField ? (
                            <Button type="button" variant="danger" className="text-xs px-2 py-2" title="Eliminar este campo del TIPO (GLOBAL)" onClick={() => deleteAttrGlobal(row.k)}>
                              Eliminar
                            </Button>
                          ) : (
                            <Button type="button" variant="secondary" className="text-xs px-2 py-2" title="Quitar este par del formulario" onClick={() => removePairAt(idx)}>
                              Quitar
                            </Button>
                          )}
                        </div>

                        {dt === "bool" ? (
                          <select
                            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 bg-white"
                            value={row.v}
                            onChange={(e) => { const copy = [...form.specs]; copy[idx].v = e.target.value; setForm({ ...form, specs: copy }); }}
                          >
                            <option value="">--</option>
                            <option value="true">Sí</option>
                            <option value="false">No</option>
                          </select>
                        ) : dt === "date" ? (
                          <input
                            type="date"
                            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 bg-white"
                            value={row.v}
                            onChange={(e) => { const copy = [...form.specs]; copy[idx].v = e.target.value; setForm({ ...form, specs: copy }); }}
                          />
                        ) : (
                          <input
                            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 bg-white"
                            placeholder={dt === "int" ? "número entero" : dt === "numeric" ? "número decimal" : "texto"}
                            value={row.v}
                            onChange={(e) => { const copy = [...form.specs]; copy[idx].v = e.target.value; setForm({ ...form, specs: copy }); }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <Button type="button" variant="secondary" onClick={() => setForm({ ...form, specs: [...form.specs, { k: "", v: "" }] })}>
                    <Icon name="plus" /> Agregar par
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="pt-1">
            <Button type="submit" variant="primary">Crear {claseActual === "COMPONENTE" ? "componente" : "periférico"}</Button>
          </div>
        </form>
      )}

      {/* Listas paginadas */}
      {tab === "COMPONENTE" && (
        <ItemsTable
          page={compPage}
          onPage={(p) => onChangePageItems("COMPONENTE", p)}
          onSize={(s) => onChangeSizeItems("COMPONENTE", s)}
          onDevolver={doDevolver}
        />
      )}
      {tab === "PERIFERICO" && (
        <ItemsTable
          page={periPage}
          onPage={(p) => onChangePageItems("PERIFERICO", p)}
          onSize={(s) => onChangeSizeItems("PERIFERICO", s)}
          onDevolver={doDevolver}
        />
      )}

      {/* Equipos */}
      {tab === "EQUIPOS" && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-sm text-slate-600 mb-1">Estado</div>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value={eqFilter.estado} onChange={(e) => setEqFilter((f) => ({ ...f, estado: e.target.value }))}>
                <option value="">(Todos)</option>
                <option value="USO">USO</option>
                <option value="ALMACEN">ALMACEN</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="BAJA">BAJA</option>
              </select>
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Desde</div>
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value={eqFilter.desde} onChange={(e) => setEqFilter((f) => ({ ...f, desde: e.target.value }))}/>
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Hasta</div>
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value={eqFilter.hasta} onChange={(e) => setEqFilter((f) => ({ ...f, hasta: e.target.value }))}/>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={applyFiltersEquipos}>Aplicar</Button>
              <Button variant="subtle" onClick={async () => { setEqFilter({ estado: "", desde: "", hasta: "" }); await applyFiltersEquipos(); }}>
                Limpiar
              </Button>
            </div>
          </div>

          <EquiposTable page={eqPage} onPage={onChangePageEquipos} onSize={onChangeSizeEquipos} />
        </>
      )}

      {/* Cámara */}
      <CameraCapture open={showCam} onClose={() => setShowCam(false)} onCapture={(blob) => setCaptured((arr) => [...arr, blob])} />
    </div>
  );
}

/* =========================================================
   Tablas
========================================================= */
function ItemsTable({
  page, onPage, onSize, onDevolver,
}: {
  page: ItemsPage; onPage: (p: number) => void; onSize: (s: number) => void;
  onDevolver: (item: ItemRow) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((page.total || 0) / (page.size || 10)));
  return (
    <div className="bg-white rounded-2xl shadow-sm border">
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="text-left text-[13px] text-slate-600">
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Préstamo</th>
              <th className="px-3 py-2 font-medium">Registrado</th>
              <th className="px-3 py-2 font-medium">En equipo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((r, i) => (
              <tr key={r.item_id} className={`border-t ${i % 2 ? "bg-slate-50/30" : ""} hover:bg-slate-50/70`}>
                <td className="px-3 py-2 font-mono text-[13px]">{r.item_codigo}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2">{r.estado}</td>
                <td className="px-3 py-2">{r.prestamo_text ?? "—"}</td>
                <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">{r.equipo ? `${r.equipo.equipo_codigo} · ${r.equipo.equipo_nombre}` : "-"}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link to={`/items/${r.item_id}`} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm">Ver ficha</Link>
                    {/* Solo mostrar "Devolver" cuando el backend diga que puede */}
                    {r.puede_devolver ? (
                      <Button variant="subtle" onClick={() => onDevolver(r)}>Devolver</Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {page.items.length === 0 && (
              <tr><td colSpan={7}><EmptyState title="Sin registros" hint="Ajusta los filtros o crea un nuevo ítem." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePager total={page.total} page={page.page} size={page.size} totalPages={totalPages} onPage={onPage} onSize={onSize} />
    </div>
  );
}

function EquiposTable({ page, onPage, onSize }: { page: EquiposPage; onPage: (p: number) => void; onSize: (s: number) => void; }) {
  const totalPages = Math.max(1, Math.ceil((page.total || 0) / (page.size || 10)));
  const rows = Array.isArray(page.items) ? page.items : [];
  return (
    <div className="bg-white rounded-2xl shadow-sm border">
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="text-left text-[13px] text-slate-600">
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Usuario final</th>
              <th className="px-3 py-2 font-medium">Ingresó</th>
              <th className="px-3 py-2 font-medium">Modificado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.equipo_id} className={`border-t ${i % 2 ? "bg-slate-50/30" : ""} hover:bg-slate-50/70`}>
                <td className="px-3 py-2 font-mono text-[13px]">{r.equipo_codigo}</td>
                <td className="px-3 py-2">{r.equipo_nombre}</td>
                <td className="px-3 py-2">{r.estado || "-"}</td>
                <td className="px-3 py-2">{r.usuario_final || "-"}</td>
                <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2 text-right">
                  <Link to={`/equipos/${r.equipo_id}`} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm">Abrir</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7}><EmptyState title="Sin registros" hint="Ajusta los filtros o crea un nuevo equipo." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePager total={page.total} page={page.page} size={page.size} totalPages={totalPages} onPage={onPage} onSize={onSize} />
    </div>
  );
}

function TablePager({
  total, page, size, totalPages, onPage, onSize,
}: { total: number; page: number; size: number; totalPages: number; onPage: (p: number) => void; onSize: (s: number) => void; }) {
  return (
    <div className="flex items-center justify-between p-3 border-t">
      <div className="text-sm text-slate-600">Total: {total.toLocaleString()}</div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="chevL" /></Button>
        <span className="text-sm">Página {page} / {totalPages}</span>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}><Icon name="chevR" /></Button>
        <select className="ml-2 rounded-lg border px-2 py-1 text-sm bg-white" value={size} onChange={(e) => onSize(Number(e.target.value))}>
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / pág</option>)}
        </select>
      </div>
    </div>
  );
}
