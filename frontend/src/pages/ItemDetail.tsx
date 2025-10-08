// src/pages/ItemDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http from "../api/http";

/* ====== Tipos ====== */
type ItemDetail = {
  item_id: number;
  item_codigo: string;
  clase: "COMPONENTE" | "PERIFERICO";
  tipo: string;
  estado: string;
  area_id: number;
  area_nombre: string;
  ficha: Record<string, any>;
  fotos: { path: string; principal: boolean; orden: number | null; created_at?: string }[];
  created_at?: string;
};

type Attr = {
  nombre: string;
  data_type: "text" | "int" | "numeric" | "bool" | "date";
  orden?: number | null;
};

/* ====== Helpers UI ====== */
const card = "bg-white rounded-2xl shadow-sm ring-1 ring-slate-200";
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-400 transition";
const btn =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 active:bg-slate-100 transition";
const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm shadow-sm hover:opacity-95 active:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed";

function Chip({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "emerald" | "amber" | "rose" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-700",
  } as const;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${map[tone]}`}>{children}</span>;
}

/* ====== Página ====== */
export default function ItemDetailPage() {
  const { id } = useParams();
  const itemId = Number(id);

  const [data, setData] = useState<ItemDetail | null>(null);
  const [schema, setSchema] = useState<Attr[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // edición masiva
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);

  // nuevo atributo global
  const [showNewAttr, setShowNewAttr] = useState(false);
  const [newAttr, setNewAttr] = useState<{ nombre: string; data_type: Attr["data_type"] }>({
    nombre: "",
    data_type: "text",
  });

  // upload (input)
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

  // cámara embebida
  const [showCam, setShowCam] = useState(false);
  const [captured, setCaptured] = useState<File[]>([]);

  const ficha = useMemo(() => data?.ficha || {}, [data]);

  async function load() {
    setLoading(true);
    setMsg(null);
    setOk(null);
    try {
      const r = await http.get<ItemDetail>(`/api/items/${itemId}`);
      setData(r.data);

      const attrs = await http.get<Attr[]>(`/api/spec/attrs`, {
        params: { clase: r.data.clase, tipo: r.data.tipo },
      });
      setSchema(attrs.data);

      const initial: Record<string, any> = {};
      const d: Record<string, boolean> = {};
      attrs.data.forEach((a) => {
        const k = a.nombre.toLowerCase();
        initial[a.nombre] = r.data.ficha?.[k] ?? "";
        d[a.nombre] = false;
      });
      setEditValues(initial);
      setDirty(d);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Number.isFinite(itemId)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  function normalize(dt: Attr["data_type"], raw: any): { ok: boolean; val?: any; err?: string } {
    if (dt === "int") {
      const n = Number.parseInt((raw ?? "").toString().replace(/[^\d-]/g, ""), 10);
      if (Number.isNaN(n)) return { ok: false, err: "Debe ser entero" };
      return { ok: true, val: n };
    }
    if (dt === "numeric") {
      const norm = (raw ?? "").toString().replace(",", ".").replace(/[^0-9.\-]/g, "");
      const x = Number.parseFloat(norm);
      if (Number.isNaN(x)) return { ok: false, err: "Debe ser decimal" };
      return { ok: true, val: x };
    }
    if (dt === "bool") {
      const s = (raw ?? "").toString().toLowerCase();
      if (!["true", "false", "1", "0", "sí", "si", "no", "t", "f", "yes", "y", "n"].includes(s)) {
        return { ok: false, err: "Debe ser Sí/No" };
      }
      return { ok: true, val: ["true", "1", "sí", "si", "t", "yes", "y"].includes(s) };
    }
    return { ok: true, val: raw ?? "" };
  }

  const dirtyCount = useMemo(() => Object.values(dirty).filter(Boolean).length, [dirty]);

  async function saveAll() {
    if (!data) return;
    setSavingAll(true);
    setMsg(null);
    setOk(null);

    try {
      for (const a of schema) {
        if (!dirty[a.nombre]) continue;
        const raw = editValues[a.nombre];
        const { ok: isOk, val, err } = normalize(a.data_type, raw);
        if (!isOk) {
          setMsg(`"${a.nombre}": ${err}`);
          setSavingAll(false);
          return;
        }
        await http.post(`/api/items/${itemId}/specs`, {
          attr: a.nombre,
          data_type: a.data_type,
          value: val,
          clase: data.clase,
          tipo_nombre: data.tipo,
        });
      }

      await load();
      setOk("Cambios guardados");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudieron guardar los cambios");
    } finally {
      setSavingAll(false);
    }
  }

  async function uploadPhotos() {
    const blobs: File[] = [];
    if (files && files.length > 0) blobs.push(...Array.from(files));
    if (captured.length > 0) blobs.push(...captured);
    if (blobs.length === 0) return;

    setUploading(true);
    setMsg(null);
    setOk(null);
    try {
      const fd = new FormData();
      blobs.forEach((f) => fd.append("files", f));
      await http.post(`/api/items/${itemId}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setFiles(null);
      setCaptured([]);
      setShowCam(false);
      await load();
      setOk("Imágenes subidas");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudieron subir las imágenes");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(path: string) {
    if (!confirm("¿Eliminar esta imagen?")) return;
    setMsg(null);
    setOk(null);
    try {
      await http.delete(`/api/items/${itemId}/media`, { data: { path } });
      await load();
      setOk("Imagen eliminada");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo eliminar la imagen");
    }
  }

  /* ====== Thumbs de pendientes (seleccionadas/capturadas) ====== */
  const selected = useMemo(() => (files ? Array.from(files) : []), [files]);
  const selectedCount = (files?.length || 0) + captured.length;

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-6">Cargando…</div>;
  if (!data) return <div className="max-w-6xl mx-auto px-4 py-6">{msg || "No encontrado"}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <Link to={`/areas/${data.area_id}`} className="text-slate-600 hover:underline">
            ← Volver a área
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-semibold">{data.item_codigo}</h2>
            <Chip tone="slate">{data.clase}</Chip>
            <Chip tone="emerald">{data.estado}</Chip>
            <Chip tone="amber">{data.tipo}</Chip>
          </div>
          <div className="text-sm text-slate-600 flex items-center gap-2 flex-wrap">
            <span>Área: <b>{data.area_nombre}</b></span>
            {data.created_at && (
              <>
                <span className="text-slate-400">·</span>
                <span>Registrado: <b>{new Date(data.created_at).toLocaleString()}</b></span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={btnPrimary}
            onClick={saveAll}
            disabled={savingAll || dirtyCount === 0}
            title={dirtyCount === 0 ? "Sin cambios" : `Hay ${dirtyCount} cambio(s)`}
          >
            {savingAll ? "Guardando…" : "Guardar cambios"}
          </button>

          <button
            className={btn}
            onClick={() => setShowNewAttr(true)}
            title="Crear nuevo campo para este tipo"
          >
            + Nuevo campo
          </button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">{msg}</div>}
      {ok && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{ok}</div>}

      {/* Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FICHA EDITABLE */}
        <section className={card + " p-4 md:p-5"}>
          <h3 className="font-semibold mb-4">Ficha técnica</h3>
          {schema.length === 0 ? (
            <div className="text-slate-500">Este tipo aún no tiene campos.</div>
          ) : (
            <div className="space-y-3">
              {schema.map((a) => {
                const kLower = a.nombre.toLowerCase();
                const original = ficha[kLower] ?? "";
                const current = editValues[a.nombre] ?? "";
                const isDirty = current !== original;

                return (
                  <div key={a.nombre} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    <div className="sm:col-span-2 text-slate-600">{a.nombre}</div>
                    <div className="sm:col-span-3">
                      {a.data_type === "bool" ? (
                        <select
                          className={field}
                          value={String(current)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditValues((prev) => ({ ...prev, [a.nombre]: v }));
                            setDirty((d) => ({ ...d, [a.nombre]: v !== String(original) }));
                          }}
                        >
                          <option value="">--</option>
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                        </select>
                      ) : a.data_type === "date" ? (
                        <input
                          type="date"
                          className={field}
                          value={current}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditValues((prev) => ({ ...prev, [a.nombre]: v }));
                            setDirty((d) => ({ ...d, [a.nombre]: v !== original }));
                          }}
                        />
                      ) : (
                        <input
                          className={`${field} ${isDirty ? "ring-2 ring-amber-200 border-amber-300" : ""}`}
                          placeholder={a.data_type === "int" ? "entero" : a.data_type === "numeric" ? "decimal" : "texto"}
                          value={current}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditValues((prev) => ({ ...prev, [a.nombre]: v }));
                            setDirty((d) => ({ ...d, [a.nombre]: v !== original }));
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* FOTOS */}
        <section className={card + " p-4 md:p-5"}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Fotos</h3>
            <div className="flex items-center gap-2">
              {/* Subir/Cámara (nativa) */}
              <label className={btn + " cursor-pointer"}>
                Subir / Cámara
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setFiles(e.target.files)}
                  title="Abrirá cámara en móvil o galería/archivos"
                />
              </label>
              {/* Cámara embebida */}
              <button className={btn} onClick={() => setShowCam(true)}>
                📷 Tomar foto
              </button>
            </div>
          </div>

          {/* existentes */}
          {data.fotos?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {data.fotos.map((f, i) => (
                <div key={i} className="border rounded-xl overflow-hidden bg-slate-50">
                  <div className="relative">
                    <img src={f.path} alt="" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-md px-2 py-1 text-xs border"
                      onClick={() => deletePhoto(f.path)}
                      title="Eliminar imagen"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="p-2 text-xs text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {f.principal ? <Chip tone="emerald">Principal</Chip> : <Chip>Secundaria</Chip>}
                      {f.orden != null && <span>orden {f.orden}</span>}
                    </div>
                    {f.created_at && (
                      <span className="text-[11px] text-slate-400">{new Date(f.created_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 mb-4">Sin fotos</div>
          )}

          {/* pendientes (seleccionadas + capturadas) */}
          {(selected.length > 0 || captured.length > 0) && (
            <div className="mb-3">
              <div className="text-sm font-medium mb-2">
                Pendientes ({selected.length + captured.length})
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* seleccionadas */}
                {selected.map((f, idx) => {
                  const url = URL.createObjectURL(f);
                  return (
                    <div key={`sel-${idx}`} className="relative">
                      <img src={url} alt="" className="w-full h-28 object-cover rounded-lg ring-1 ring-slate-200" />
                      <button
                        type="button"
                        className="absolute top-2 right-2 bg-white/90 rounded-md border px-2 py-0.5 text-xs"
                        onClick={() => {
                          // quitar una seleccionada rearmando el FileList
                          const arr = selected.filter((_, i) => i !== idx);
                          const dt = new DataTransfer();
                          arr.forEach((ff) => dt.items.add(ff));
                          setFiles(dt.files.length ? dt.files : null);
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  );
                })}
                {/* capturadas */}
                {captured.map((f, idx) => {
                  const url = URL.createObjectURL(f);
                  return (
                    <div key={`cap-${idx}`} className="relative">
                      <img src={url} alt="" className="w-full h-28 object-cover rounded-lg ring-1 ring-slate-200" />
                      <button
                        type="button"
                        className="absolute top-2 right-2 bg-white/90 rounded-md border px-2 py-0.5 text-xs"
                        onClick={() => {
                          setCaptured((arr) => arr.filter((_, i) => i !== idx));
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              className={btnPrimary}
              onClick={uploadPhotos}
              disabled={uploading || selectedCount === 0}
            >
              {uploading ? "Subiendo…" : "Subir imágenes"}
            </button>
            <div className="text-xs text-slate-600">
              {selectedCount === 0
                ? "No hay imágenes pendientes."
                : "Se subirán las seleccionadas/capturadas al presionar el botón."}
            </div>
          </div>
        </section>
      </div>

      {/* Modal: nuevo campo */}
      {showNewAttr && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b font-semibold">Nuevo campo para {data?.tipo || "tipo"}</div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-slate-600 mb-1">Nombre del atributo</div>
                <input
                  className={field}
                  value={newAttr.nombre}
                  onChange={(e) => setNewAttr({ ...newAttr, nombre: e.target.value })}
                  placeholder="p. ej. CAPACIDAD_GB"
                />
              </div>
              <div>
                <div className="text-sm text-slate-600 mb-1">Tipo de dato</div>
                <select
                  className={field}
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
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className={btn} onClick={() => setShowNewAttr(false)}>Cancelar</button>
              <button
                className={btnPrimary}
                onClick={async () => {
                  try {
                    await http.post("/api/spec/attrs", {
                      clase: data?.clase,
                      tipo_nombre: data?.tipo,
                      nombre_attr: newAttr.nombre.trim(),
                      data_type: newAttr.data_type,
                    });
                    setShowNewAttr(false);
                    setNewAttr({ nombre: "", data_type: "text" });
                    await load();
                    setOk(`Campo "${newAttr.nombre}" creado`);
                  } catch (e: any) {
                    setMsg(e?.response?.data?.error || "No se pudo crear el campo");
                  }
                }}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cámara embebida */}
      {showCam && (
        <CamSheet
          onClose={() => setShowCam(false)}
          onCapture={(file) => setCaptured((arr) => [...arr, file])}
        />
      )}
    </div>
  );
}

/* ======= Cámara embebida (getUserMedia) ======= */
function CamSheet({ onClose, onCapture }: { onClose: () => void; onCapture: (f: File) => void }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) return;
        setStream(s);
        if (videoEl) {
          (videoEl as any).srcObject = s;
          videoEl.oncanplay = () => setReady(true);
        }
      } catch {
        onClose();
      }
    })();
    return () => {
      active = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // Sólo depende de videoEl; evitamos re-creación del stream innecesaria.
  }, [videoEl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function capture() {
    if (!videoEl) return;
    const w = videoEl.videoWidth || 1280;
    const h = videoEl.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoEl, 0, 0, w, h);
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.85)!
    );
    const file = new File([blob], `cam_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow w-full max-w-md overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">Cámara</div>
        <div className="p-3">
          <video
            ref={setVideoEl}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg bg-black"
            style={{ aspectRatio: "16/9", objectFit: "cover" }}
          />
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <button className={btn} onClick={onClose}>Cerrar</button>
          <button
            className={btnPrimary}
            disabled={!ready}
            onClick={capture}
          >
            Tomar foto
          </button>
        </div>
      </div>
    </div>
  );
}
