// src/pages/EquipoNuevoUso.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import http from "../api/http";

/* =========================
   Tipos
========================= */
type Clase = "COMPONENTE" | "PERIFERICO";
type ItemType = { id: number; clase: Clase; nombre: string };
type Attr = { nombre: string; data_type: "text" | "int" | "numeric" | "bool" | "date"; orden?: number | null };
type SpecKV = { k: string; v: string };

type TempItem = {
  clase: Clase;
  tipo_nombre: string;
  codigo: string;
  schema: Attr[];
  specs: SpecKV[];
  files?: FileList | null;
};

type EquipoHeaderAPI = {
  equipo_id: number;
  equipo_codigo: string;
  equipo_nombre: string;
  area_id: number;
  estado: string;
  usuario_final: string | null;
  login: string | null;
  password: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: { item_id: number; item_codigo: string; clase: Clase; tipo: string; estado: string }[];
};

/* =========================
   Estilos reutilizables
========================= */
const fieldBase =
  "w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 md:px-3.5 md:py-2.5 " +
  "text-sm md:text-base placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-400 " +
  "transition shadow-sm";
const fieldReadOnly = fieldBase + " bg-slate-50 text-slate-700";
const selectBase = fieldBase + " pr-8";
const btnBase =
  "inline-flex items-center justify-center rounded-2xl border border-slate-300 " +
  "bg-white px-3 py-2 md:px-3.5 md:py-2.5 text-sm md:text-base " +
  "hover:bg-slate-50 active:bg-slate-100 transition shadow-sm";
const btnPrimary =
  "inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white " +
  "px-4 py-2.5 md:px-5 md:py-3 text-sm md:text-base shadow-sm " +
  "hover:opacity-95 active:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed";
const card = "bg-white rounded-3xl shadow-sm ring-1 ring-slate-200";

/* ============ UI: Sheet (drawer) ============ */
function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-[1px] transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`
          fixed z-50 bg-white shadow-xl transition-transform duration-300
          right-0 top-0 h-full w-full sm:w-[560px]
          ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full"}
          sm:top-0 sm:h-full bottom-0 rounded-t-3xl sm:rounded-none
        `}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-full flex flex-col">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
            <div className="font-semibold text-base md:text-lg">{title}</div>
            <button className={btnBase} onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-5">{children}</div>
          {footer && <div className="px-4 md:px-5 py-3 md:py-4 border-t bg-slate-50">{footer}</div>}
        </div>
      </div>
    </>
  );
}

/* =========================
   Página
========================= */
export default function EquipoNuevoUso() {
  // 1) /areas/:areaId/equipos/nuevo-uso
  // 2) /equipos/:equipoId/agregar-en-uso
  const { areaId, equipoId } = useParams();
  const aidParam = Number(areaId);
  const eidParam = Number(equipoId);
  const isAppend = Number.isFinite(eidParam) && eidParam > 0;

  const nav = useNavigate();

  /* --- Paso 1: Datos del equipo --- */
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    estado: "USO",
    usuario_final: "",
    login: "",
    password: "",
  });

  const [currentAreaId, setCurrentAreaId] = useState<number>(aidParam || 0);
  const [equipoHeader, setEquipoHeader] = useState<EquipoHeaderAPI | null>(null);
  const [yaAsignados, setYaAsignados] = useState<
    { item_id: number; item_codigo: string; clase: Clase; tipo: string; estado: string }[]
  >([]);

  /* Catálogos */
  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);

  /* --- Paso 2: Ítems temporales --- */
  const [temp, setTemp] = useState<TempItem[]>([]);
  const [tPage, setTPage] = useState(1);
  const [tSize, setTSize] = useState(5);

  /* Sheet crear/editar ítem */
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TempItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  /* Estado general */
  const [step, setStep] = useState<1 | 2 | 3>(isAppend ? 2 : 1);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* =========================
     Cargas iniciales
  ========================= */
  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([
        http.get<ItemType[]>("/api/item-types?clase=COMPONENTE"),
        http.get<ItemType[]>("/api/item-types?clase=PERIFERICO"),
      ]);
      setTypesC(c.data || []);
      setTypesP(p.data || []);
    })();
  }, []);

  // Carga del equipo si estamos en append
  useEffect(() => {
    if (!isAppend) return;
    (async () => {
      try {
        const r = await http.get<EquipoHeaderAPI>(`/api/equipos/${eidParam}`);
        const h = r.data;
        setEquipoHeader(h);
        setCurrentAreaId(h.area_id);
        setForm({
          codigo: h.equipo_codigo || "",
          nombre: h.equipo_nombre || "",
          estado: (h.estado || "USO").toUpperCase(),
          usuario_final: h.usuario_final || "",
          login: h.login || "",
          password: h.password || "",
        });
        setYaAsignados(Array.isArray(h.items) ? h.items : []);
        setStep(2);
      } catch (e: any) {
        setMsg(e?.response?.data?.error || "No se pudo cargar el equipo");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppend, eidParam]);

  // Sugerir código por área (solo en modo crear)
  useEffect(() => {
    if (isAppend || !currentAreaId) return;
    (async () => {
      try {
        const r = await http.get<{ next_code: string }>(
          `/api/areas/${currentAreaId}/equipos/next-code`,
          { params: { prefix: "PC-", pad: 3 } }
        );
        if (r.data?.next_code && !form.codigo) {
          setForm((f) => ({ ...f, codigo: r.data.next_code }));
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppend, currentAreaId]);

  /* =========================
     Helpers de ficha/tipos
  ========================= */
  async function loadSchema(clase: Clase, tipo: string) {
    if (!tipo) return [];
    const r = await http.get<Attr[]>("/api/spec/attrs", { params: { clase, tipo } });
    return r.data || [];
  }
  async function suggestCode(clase: Clase, tipo: string) {
    try {
      const r = await http.get<{ next_code: string }>("/api/items/next-code", {
        params: { clase, tipo, area_id: currentAreaId },
      });
      return r.data?.next_code || "";
    } catch {
      return "";
    }
  }
  function validateSpecs(specs: SpecKV[], schema: Attr[]) {
    const out: Record<string, any> = {};
    for (const { k, v } of specs) {
      const dt = schema.find((s) => s.nombre.toLowerCase() === k.toLowerCase())?.data_type || "text";
      if (dt === "int") {
        const n = parseInt((v ?? "").toString().replace(/[^\d-]/g, ""), 10);
        if (Number.isNaN(n)) return `El campo ${k} debe ser entero`;
        out[k] = n;
      } else if (dt === "numeric") {
        const x = parseFloat((v ?? "").toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
        if (Number.isNaN(x)) return `El campo ${k} debe ser decimal`;
        out[k] = x;
      } else if (dt === "bool") {
        const s = (v ?? "").toString().toLowerCase();
        if (!["true", "false", "1", "0", "sí", "si", "no", "t", "f", "yes", "y", "n"].includes(s))
          return `El campo ${k} debe ser Sí/No`;
        out[k] = ["true", "1", "sí", "si", "t", "yes", "y"].includes(s);
      } else {
        out[k] = v ?? "";
      }
    }
    return out as Record<string, any>;
  }

  /* =========================
     Sheet: abrir (nuevo / editar)
  ========================= */
  async function openModal(clase: Clase, index: number | null = null) {
    setMsg(null);
    if (step !== 2) setStep(2);

    if (index !== null) {
      const row = temp[index];
      const schema = row.schema.length ? row.schema : await loadSchema(row.clase, row.tipo_nombre);
      setDraft({ ...row, schema });
      setEditingIndex(index);
      setOpen(true);
      return;
    }
    setDraft({ clase, tipo_nombre: "", codigo: "", schema: [], specs: [], files: null });
    setEditingIndex(null);
    setOpen(true);
  }

  async function onChangeTipo(tipo: string) {
    if (!draft) return;
    const schema = await loadSchema(draft.clase, tipo);
    const codigo = await suggestCode(draft.clase, tipo);
    const mapped = schema.map((a) => {
      const prev = draft.specs.find((s) => s.k.toLowerCase() === a.nombre.toLowerCase())?.v;
      return { k: a.nombre, v: prev ?? "" };
    });
    setDraft({ ...draft, tipo_nombre: tipo, schema, specs: mapped, codigo });
  }

  function applyDraft() {
    if (!draft) return;
    if (!draft.tipo_nombre) return setMsg("Selecciona el tipo");
    if (!draft.codigo.trim()) return setMsg("Completa el código");
    const checked = validateSpecs(draft.specs, draft.schema);
    if (typeof checked === "string") return setMsg(checked);
    if (editingIndex !== null) {
      setTemp((arr) => {
        const copy = [...arr];
        copy[editingIndex] = { ...draft };
        return copy;
      });
    } else {
      setTemp((arr) => [...arr, { ...draft }]);
    }
    setOpen(false);
  }

  function removeTemp(index: number) {
    setTemp((arr) => arr.filter((_, i) => i !== index));
  }

  /* =========================
     Guardar
  ========================= */
  async function guardarEquipo() {
    setMsg(null);

    if (!form.nombre.trim() || !form.codigo.trim()) {
      setMsg("Código y nombre del equipo son requeridos");
      setStep(1);
      return;
    }
    if (temp.length === 0) {
      setMsg("Agrega al menos un componente o periférico");
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      let equipo_id = eidParam;

      // Crear equipo primero (solo modo crear)
      if (!isAppend) {
        const payload = {
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          estado: "USO",
          usuario_final: form.usuario_final?.trim() || null,
          login: form.login?.trim() || null,
          password: form.password?.trim() || null,
          items: [],
        };

        async function postOnce(p: typeof payload) {
          return http.post<{ equipo_id: number }>(`/api/areas/${currentAreaId}/equipos`, p);
        }

        try {
          const creq = await postOnce(payload);
          equipo_id = creq.data.equipo_id;
        } catch (e: any) {
          const txt = e?.response?.data?.error || "";
          const isDup = /duplicad.|llave duplicada|duplicate/i.test(txt);
          if (isDup) {
            try {
              const sug = await http.get<{ next_code: string }>(
                `/api/areas/${currentAreaId}/equipos/next-code`,
                { params: { prefix: "PC-", pad: 3 } }
              );
              const next_code = sug.data?.next_code;
              if (next_code) {
                const creq2 = await postOnce({ ...payload, codigo: next_code });
                equipo_id = creq2.data.equipo_id;
              } else {
                throw new Error("No se pudo sugerir un código nuevo");
              }
            } catch {
              throw e;
            }
          } else {
            throw e;
          }
        }
      }

      // Crear ítems + media + asignar
      for (const row of temp) {
        const specsObj = validateSpecs(row.specs, row.schema) as Record<string, any>;

        const ir = await http.post<{ item_id: number }>("/api/items", {
          codigo: row.codigo.trim(),
          clase: row.clase,
          tipo_nombre: row.tipo_nombre,
          area_id: currentAreaId,
          specs: specsObj,
        });
        const item_id = ir.data.item_id;

        if (row.files && row.files.length > 0) {
          const fd = new FormData();
          Array.from(row.files).forEach((f) => fd.append("files", f));
          await http.post(`/api/items/${item_id}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        }

        await http.post(`/api/equipos/${equipo_id}/items`, { item_id, slot: null });
      }

      nav(`/equipos/${equipo_id}`);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo completar la operación");
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     Derivados UI
  ========================= */
  const tempSlice = useMemo(() => temp.slice((tPage - 1) * tSize, tPage * tSize), [temp, tPage, tSize]);
  const totalTPages = Math.max(1, Math.ceil(temp.length / tSize));

  /* =========================
     Render
  ========================= */
  return (
    <div className="max-w-7xl mx-auto p-3 md:p-5 space-y-5">
      {/* Header + Steps */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg md:text-xl font-semibold">
          {isAppend ? "Agregar ítems en USO a equipo" : "Nuevo equipo en USO"}
        </h1>

        <div className="flex items-center text-sm md:text-base w-full sm:w-auto justify-between sm:justify-end gap-2">
          {([1, 2, 3] as const).map((n, i) => (
            <div key={n} className="flex items-center flex-1 sm:flex-none">
              <button
                onClick={() => setStep(n)}
                className={`w-9 h-9 md:w-10 md:h-10 rounded-full border flex items-center justify-center ${
                  step === n ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300"
                }`}
                title={n === 1 ? "Datos" : n === 2 ? "Ítems" : "Revisar"}
                disabled={isAppend && n === 1}
              >
                {n}
              </button>
              {i < 2 && <div className="hidden sm:block w-12 h-[2px] bg-slate-300 mx-2" />}
            </div>
          ))}
        </div>
      </div>

      {msg && <div className="p-3 md:p-4 rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-200">{msg}</div>}

      {/* Paso 1 */}
      {!isAppend && step === 1 && (
        <section className={card + " p-4 md:p-5 space-y-4"}>
          <div className="text-base md:text-lg font-semibold">1) Datos del equipo</div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs md:text-sm text-slate-600 block mb-1">Código</label>
              <input
                className={fieldBase}
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                placeholder="Ej. PC-001"
              />
            </div>
            <div>
              <label className="text-xs md:text-sm text-slate-600 block mb-1">Nombre</label>
              <input
                className={fieldBase}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                placeholder="Nombre visible del equipo"
              />
            </div>
            <div>
              <label className="text-xs md:text-sm text-slate-600 block mb-1">Estado</label>
              <input className={fieldReadOnly} value="USO" readOnly />
            </div>

            <div>
              <label className="text-xs md:text-sm text-slate-600 block mb-1">Usuario final</label>
              <input
                className={fieldBase}
                value={form.usuario_final}
                onChange={(e) => setForm({ ...form, usuario_final: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                placeholder="Persona que usa el equipo"
              />
            </div>
            <div>
              <label className="text-xs md:text-sm text-slate-600 block mb-1">Login</label>
              <input
                className={fieldBase}
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                placeholder="Cuenta de acceso"
              />
            </div>
            <div>
              <label className="text-xs md:text-sm text-slate-600 block mb-1">Password</label>
              <input
                type="text"
                className={fieldBase}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className={btnPrimary}
              onClick={() => setStep(2)}
              disabled={!form.codigo.trim() || !form.nombre.trim()}
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {/* Paso 1 (informativo en append) */}
      {isAppend && step === 1 && equipoHeader && (
        <section className={card + " p-4 md:p-5 space-y-4"}>
          <div className="text-base md:text-lg font-semibold">1) Datos del equipo</div>
          <div className="text-xs md:text-sm text-slate-600 -mt-1 md:-mt-2">
            Editando equipo: <span className="font-mono">{equipoHeader.equipo_codigo}</span> — {equipoHeader.equipo_nombre} · Área{" "}
            <span className="font-medium">{equipoHeader.area_id}</span>{" "}
            <Link className="underline" to={`/equipos/${equipoHeader.equipo_id}`}>ver detalle</Link>
          </div>
        </section>
      )}

      {/* Paso 2 */}
      {step === 2 && (
        <section className={card + " p-4 md:p-5 space-y-4"}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-base md:text-lg font-semibold">
              2) {isAppend ? "Crear y asignar nuevos ítems en USO" : "Agrega componentes y periféricos"}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button className={btnBase + " w-full sm:w-auto"} onClick={() => openModal("COMPONENTE")}>
                + Componente
              </button>
              <button className={btnBase + " w-full sm:w-auto"} onClick={() => openModal("PERIFERICO")}>
                + Periférico
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left text-slate-600">
                  <th className="px-3 py-2">Clase</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Ficha</th>
                  <th className="px-3 py-2">Imágenes</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tempSlice.map((r, i) => {
                  const idx = (tPage - 1) * tSize + i;
                  return (
                    <tr key={`tmp-${idx}`} className={`border-t hover:bg-slate-50 ${i % 2 ? "bg-slate-50/40" : "bg-white"}`}>
                      <td className="px-3 py-2">{r.clase}</td>
                      <td className="px-3 py-2">{r.tipo_nombre || "-"}</td>
                      <td className="px-3 py-2">{r.codigo}</td>
                      <td className="px-3 py-2">
                        {r.specs.filter((s) => (s.v ?? "") !== "").length}/{r.schema.length}
                      </td>
                      <td className="px-3 py-2">{r.files?.length || 0}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button className={btnBase} onClick={() => openModal(r.clase, idx)}>Editar</button>
                          <button className={btnBase} onClick={() => removeTemp(idx)}>Quitar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {temp.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-slate-500" colSpan={6}>
                      Aún no agregas ítems
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Página {Math.min(tPage, totalTPages)} de {totalTPages} · {temp.length} ítems
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                className={btnBase + " flex-1 sm:flex-none"}
                disabled={tPage <= 1}
                onClick={() => setTPage((p) => p - 1)}
              >
                ◀
              </button>
              <select
                className={selectBase + " w-full sm:w-auto py-1.5"}
                value={tSize}
                onChange={(e) => {
                  setTPage(1);
                  setTSize(Number(e.target.value));
                }}
              >
                {[5, 10, 20, 50].map((s) => (
                  <option key={s} value={s}>
                    {s} / pág
                  </option>
                ))}
              </select>
              <button
                className={btnBase + " flex-1 sm:flex-none"}
                disabled={tPage >= totalTPages}
                onClick={() => setTPage((p) => p + 1)}
              >
                ▶
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-2">
            {!isAppend ? (
              <button className={btnBase} onClick={() => setStep(1)}>
                Volver
              </button>
            ) : (
              <Link to={`/equipos/${eidParam}`} className={btnBase}>
                Volver al detalle
              </Link>
            )}
            <button
              className={btnPrimary}
              onClick={() => setStep(3)}
              disabled={temp.length === 0}
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {/* Paso 3 */}
      {step === 3 && (
        <section className={card + " p-4 md:p-5 space-y-4"}>
          <div className="text-base md:text-lg font-semibold">3) Revisar y guardar</div>

          <div className="grid gap-4 md:gap-5 md:grid-cols-2">
            <div className="rounded-2xl ring-1 ring-slate-200 p-3 md:p-4">
              <div className="font-medium mb-2">Equipo</div>
              <div className="text-sm space-y-1.5">
                <div><span className="text-slate-500">Código:</span> {form.codigo}</div>
                <div><span className="text-slate-500">Nombre:</span> {form.nombre}</div>
                <div><span className="text-slate-500">Estado:</span> USO</div>
                {form.usuario_final && (<div><span className="text-slate-500">Usuario final:</span> {form.usuario_final}</div>)}
                {form.login && (<div><span className="text-slate-500">Login:</span> {form.login}</div>)}
              </div>
            </div>
            <div className="rounded-2xl ring-1 ring-slate-200 p-3 md:p-4">
              <div className="font-medium mb-2">Resumen ítems</div>
              <div className="text-sm space-y-1.5">
                <div>Total: {temp.length}</div>
                <div>Componentes: {temp.filter((t) => t.clase === "COMPONENTE").length}</div>
                <div>Periféricos: {temp.filter((t) => t.clase === "PERIFERICO").length}</div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left text-slate-600">
                  <th className="px-3 py-2">Clase</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2"># Atributos</th>
                  <th className="px-3 py-2">Imágenes</th>
                </tr>
              </thead>
              <tbody>
                {temp.map((r, i) => (
                  <tr key={`rev-${i}`} className={`border-t ${i % 2 ? "bg-slate-50/40" : "bg-white"}`}>
                    <td className="px-3 py-2">{r.clase}</td>
                    <td className="px-3 py-2">{r.tipo_nombre}</td>
                    <td className="px-3 py-2">{r.codigo}</td>
                    <td className="px-3 py-2">{r.specs.filter((s) => (s.v ?? "") !== "").length}/{r.schema.length}</td>
                    <td className="px-3 py-2">{r.files?.length || 0}</td>
                  </tr>
                ))}
                {temp.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-slate-500" colSpan={5}>Sin ítems</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-2">
            <button className={btnBase} onClick={() => setStep(2)}>
              Volver
            </button>
            <button
              className={btnPrimary}
              disabled={saving}
              onClick={guardarEquipo}
            >
              {saving ? "Guardando..." : isAppend ? "Agregar al equipo" : "Guardar equipo"}
            </button>
          </div>
        </section>
      )}

      {/* Sheet crear/editar ítem */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editingIndex !== null ? "Editar ítem" : "Agregar ítem"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button className={btnBase} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className={btnPrimary} onClick={applyDraft}>
              {editingIndex !== null ? "Actualizar" : "Agregar"}
            </button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs md:text-sm text-slate-600 block mb-1">Clase</label>
                <input className={fieldReadOnly} readOnly value={draft.clase} />
              </div>
              <div>
                <label className="text-xs md:text-sm text-slate-600 block mb-1">Tipo</label>
                <select
                  className={selectBase}
                  value={draft.tipo_nombre}
                  onChange={(e) => onChangeTipo(e.target.value)}
                >
                  <option value="">Seleccione…</option>
                  {(draft.clase === "COMPONENTE" ? typesC : typesP).map((t) => (
                    <option key={t.id} value={t.nombre}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs md:text-sm text-slate-600 block mb-1">Código</label>
                <input
                  className={fieldBase}
                  value={draft.codigo}
                  onChange={(e) => setDraft({ ...draft, codigo: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Se sugiere al elegir tipo"
                />
              </div>
            </div>

            <div>
              <label className="text-xs md:text-sm text-slate-600 block mb-1">Imágenes</label>
              <input
                type="file"
                multiple
                accept="image/*"
                className={fieldBase}
                onChange={(e) => setDraft({ ...draft, files: e.target.files })}
              />
            </div>

            <div className="space-y-2">
              {draft.schema.length === 0 ? (
                <div className="text-sm text-slate-500">Selecciona un tipo para ver la ficha…</div>
              ) : (
                draft.schema.map((a) => {
                  const cur = draft.specs.find((s) => s.k.toLowerCase() === a.nombre.toLowerCase())?.v ?? "";
                  return (
                    <div key={`spec-${a.nombre}`}>
                      <div className="text-xs text-slate-600 mb-1">
                        {a.nombre} <span className="text-slate-400">({a.data_type})</span>
                      </div>
                      {a.data_type === "bool" ? (
                        <select
                          className={selectBase}
                          value={cur}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraft((d) => {
                              if (!d) return d;
                              const next = d.specs.some((s) => s.k === a.nombre)
                                ? d.specs.map((s) => (s.k === a.nombre ? { ...s, v } : s))
                                : [...d.specs, { k: a.nombre, v }];
                              return { ...d, specs: next };
                            });
                          }}
                        >
                          <option value="">--</option>
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                        </select>
                      ) : a.data_type === "date" ? (
                        <input
                          type="date"
                          className={fieldBase}
                          value={cur}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraft((d) => {
                              if (!d) return d;
                              const next = d.specs.some((s) => s.k === a.nombre)
                                ? d.specs.map((s) => (s.k === a.nombre ? { ...s, v } : s))
                                : [...d.specs, { k: a.nombre, v }];
                              return { ...d, specs: next };
                            });
                          }}
                        />
                      ) : (
                        <input
                          className={fieldBase}
                          placeholder={a.data_type === "int" ? "entero" : a.data_type === "numeric" ? "decimal" : "texto"}
                          value={cur}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraft((d) => {
                              if (!d) return d;
                              const next = d.specs.some((s) => s.k === a.nombre)
                                ? d.specs.map((s) => (s.k === a.nombre ? { ...s, v } : s))
                                : [...d.specs, { k: a.nombre, v }];
                              return { ...d, specs: next };
                            });
                          }}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
