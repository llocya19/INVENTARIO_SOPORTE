import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http from "../api/http";

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

  // upload múltiple
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

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

  useEffect(() => { if (Number.isFinite(itemId)) load(); }, [itemId]);

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
      if (!["true","false","1","0","sí","si","no","t","f","yes","y","n"].includes(s)) {
        return { ok: false, err: "Debe ser Sí/No" };
      }
      return { ok: true, val: ["true","1","sí","si","t","yes","y"].includes(s) };
    }
    return { ok: true, val: raw ?? "" };
  }

  const dirtyCount = useMemo(() => Object.values(dirty).filter(Boolean).length, [dirty]);

  async function saveAll() {
    if (!data) return;
    setSavingAll(true);
    setMsg(null);
    setOk(null);

    // validación y envío secuencial para mensajes claros
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
    if (!files || files.length === 0) return;
    setUploading(true);
    setMsg(null);
    setOk(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      await http.post(`/api/items/${itemId}/media`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFiles(null);
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
    setMsg(null); setOk(null);
    try {
      await http.delete(`/api/items/${itemId}/media`, { data: { path } });
      await load();
      setOk("Imagen eliminada");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo eliminar la imagen");
    }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-6">Cargando…</div>;
  if (!data) return <div className="max-w-6xl mx-auto px-4 py-6">{msg || "No encontrado"}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/areas/${data.area_id}`} className="text-slate-600 hover:underline">← Volver a área</Link>
          <h2 className="text-2xl font-semibold mt-1">{data.item_codigo}</h2>
          <div className="text-slate-500">
            {data.clase} · {data.tipo} · {data.estado} · Área: {data.area_nombre}
            {data.created_at && (
              <span className="ml-2">· Registrado: {new Date(data.created_at).toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-60"
            onClick={saveAll}
            disabled={savingAll || dirtyCount === 0}
            title={dirtyCount === 0 ? "Sin cambios" : `Hay ${dirtyCount} cambio(s)`}
          >
            {savingAll ? "Guardando…" : "Guardar cambios"}
          </button>

          <button
            className="px-3 py-2 rounded-lg border text-sm"
            onClick={() => setShowNewAttr(true)}
            title="Crear nuevo campo para este tipo"
          >
            + Nuevo campo
          </button>
        </div>
      </div>

      {msg && <div className="mb-3 p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">{msg}</div>}
      {ok  && <div className="mb-3 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Split: izquierda ficha, derecha fotos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FICHA EDITABLE */}
        <div className="bg-white rounded-2xl shadow p-4">
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
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                          value={current}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditValues((prev) => ({ ...prev, [a.nombre]: v }));
                            setDirty((d) => ({ ...d, [a.nombre]: v !== original }));
                          }}
                        />
                      ) : (
                        <input
                          className={`w-full rounded-lg border px-3 py-2 ${isDirty ? "border-amber-400" : "border-slate-300"}`}
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
        </div>

        {/* FOTOS */}
        <div className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-semibold mb-4">Fotos</h3>

          {data.fotos?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {data.fotos.map((f, i) => (
                <div key={i} className="border rounded-lg overflow-hidden bg-slate-50">
                  <div className="relative">
                    <img src={f.path} alt="" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-md px-2 py-1 text-xs border"
                      onClick={() => deletePhoto(f.path)}
                      title="Eliminar imagen"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="p-2 text-xs text-slate-600 flex items-center justify-between">
                    <div>
                      {f.principal ? <span className="font-semibold">Principal</span> : "Secundaria"}
                      {f.orden != null && <span> · orden {f.orden}</span>}
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
            <input
              type="file"
              multiple
              accept="image/*"
              className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-3"
              onChange={(e) => setFiles(e.target.files)}
            />
            <button
              className="px-4 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-60"
              onClick={uploadPhotos}
              disabled={!files || uploading}
            >
              {uploading ? "Subiendo…" : "Subir imágenes"}
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-1">Se adjuntarán al guardar.</div>
        </div>
      </div>

      {/* Modal: nuevo campo */}
      {showNewAttr && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-md">
            <div className="text-lg font-semibold mb-2">
              Nuevo campo para {data?.tipo || "tipo"}
            </div>
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
                  onChange={(e) =>
                    setNewAttr({ ...newAttr, data_type: e.target.value as Attr["data_type"] })
                  }
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
              <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={async () => {
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
                } catch (e:any) {
                  setMsg(e?.response?.data?.error || "No se pudo crear el campo");
                }
              }}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
