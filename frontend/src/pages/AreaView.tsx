// src/pages/AreaView.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http from "../api/http";

// --------- Tipos ---------
type ItemRow = {
  item_id: number;
  item_codigo: string;
  clase: "COMPONENTE" | "PERIFERICO";
  tipo: string;
  estado: string;
};

type EquipoRow = {
  equipo_id: number;
  equipo_codigo: string;
  equipo_nombre: string;
  estado: string;
  usuario_final?: string;
};

type ItemType = { id: number; clase: "COMPONENTE" | "PERIFERICO"; nombre: string };

type AreaInfo = {
  area: { id: number; nombre: string };
  ancestors: { id: number; nombre: string }[];
};

type Attr = {
  nombre: string;
  data_type: "text" | "int" | "numeric" | "bool" | "date";
  orden?: number | null;
};

// --------- Página ---------
export default function AreaView() {
  const { id } = useParams();
  const areaId = Number(id);

  const [tab, setTab] = useState<"COMPONENTE" | "PERIFERICO" | "EQUIPOS">("COMPONENTE");
  const [comp, setComp] = useState<ItemRow[]>([]);
  const [peri, setPeri] = useState<ItemRow[]>([]);
  const [eqs, setEqs] = useState<EquipoRow[]>([]);
  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);
  const [info, setInfo] = useState<AreaInfo | null>(null);

  // Ficha dinámica
  const [schema, setSchema] = useState<Attr[]>([]);
  const claseActual: "COMPONENTE" | "PERIFERICO" = tab === "PERIFERICO" ? "PERIFERICO" : "COMPONENTE";

  // form crear item
  const [form, setForm] = useState<{
    tipo_nombre: string;
    codigo: string;
    specs: { k: string; v: string }[];
  }>({
    tipo_nombre: "",
    codigo: "",
    specs: [
      { k: "MARCA", v: "" },
      { k: "MODELO", v: "" },
    ],
  });

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const typeOpts = claseActual === "COMPONENTE" ? typesC : typesP;

  const load = async () => {
    setMsg(null);
    try {
      const [c, p, e, tC, tP, i] = await Promise.all([
        http.get<ItemRow[]>(`/api/areas/${areaId}/items?clase=COMPONENTE`),
        http.get<ItemRow[]>(`/api/areas/${areaId}/items?clase=PERIFERICO`),
        http.get<EquipoRow[]>(`/api/areas/${areaId}/equipos`),
        http.get<ItemType[]>(`/api/item-types?clase=COMPONENTE`),
        http.get<ItemType[]>(`/api/item-types?clase=PERIFERICO`),
        http.get<AreaInfo>(`/api/areas/${areaId}/info`),
      ]);
      setComp(c.data);
      setPeri(p.data);
      setEqs(e.data);
      setTypesC(tC.data);
      setTypesP(tP.data);
      setInfo(i.data);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar el área");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  // cargar esquema/atributos cuando cambie tipo
  async function loadSchema(tipo: string) {
    if (!tipo) {
      setSchema([]);
      setForm((f) => ({ ...f, specs: [{ k: "MARCA", v: "" }, { k: "MODELO", v: "" }] }));
      return;
    }
    const r = await http.get<Attr[]>(`/api/spec/attrs`, {
      params: { clase: claseActual, tipo },
    });
    setSchema(r.data);
    setForm((f) => {
      const base =
        r.data.length > 0
          ? r.data.map((a) => ({ k: a.nombre, v: "" }))
          : f.specs.length
          ? f.specs
          : [
              { k: "MARCA", v: "" },
              { k: "MODELO", v: "" },
            ];
      return { ...f, specs: base };
    });
  }

  // Valida y normaliza según data_type (evita crasheos en el SP)
  function buildValidatedSpecs(): Record<string, any> | string {
    const out: Record<string, any> = {};
    for (const { k, v } of form.specs) {
      const key = k.trim();
      if (!key) continue;
      const dt = schema.find(s => s.nombre.toLowerCase() === key.toLowerCase())?.data_type || "text";

      if (dt === "int") {
        const n = Number.parseInt((v ?? "").toString().replace(/[^\d-]/g, ""), 10);
        if (Number.isNaN(n)) return `El campo ${key} debe ser entero`;
        out[key] = n; // número JSON
      } else if (dt === "numeric") {
        const norm = (v ?? "").toString().replace(",", ".").replace(/[^0-9.\-]/g, "");
        const x = Number.parseFloat(norm);
        if (Number.isNaN(x)) return `El campo ${key} debe ser decimal`;
        out[key] = x;
      } else if (dt === "bool") {
        const s = (v ?? "").toString().toLowerCase();
        if (!["true","false","1","0","sí","si","no","t","f","yes","y","n"].includes(s)) {
          return `El campo ${key} debe ser Sí/No`;
        }
        out[key] = ["true","1","sí","si","t","yes","y"].includes(s);
      } else if (dt === "date") {
        // esperamos YYYY-MM-DD
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
    if (!form.codigo.trim() || !form.tipo_nombre) {
      setMsg("Completa código y tipo");
      return;
    }

    const specsOrError = buildValidatedSpecs();
    if (typeof specsOrError === "string") {
      setMsg(specsOrError);
      return;
    }

    try {
      await http.post("/api/items", {
        codigo: form.codigo.trim(),
        clase: claseActual,
        tipo_nombre: form.tipo_nombre,
        area_id: areaId,
        specs: specsOrError,
      });
      setOk(`${claseActual === "COMPONENTE" ? "Componente" : "Periférico"} creado`);
      setForm({ tipo_nombre: form.tipo_nombre, codigo: "", specs: form.specs });

      // recargar listas
      if (claseActual === "COMPONENTE") {
        const c = await http.get<ItemRow[]>(`/api/areas/${areaId}/items?clase=COMPONENTE`);
        setComp(c.data);
      } else {
        const p = await http.get<ItemRow[]>(`/api/areas/${areaId}/items?clase=PERIFERICO`);
        setPeri(p.data);
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo crear");
    }
  }

  // Nuevo atributo global para el tipo
  const [showNewAttr, setShowNewAttr] = useState(false);
  const [newAttr, setNewAttr] = useState<{ nombre: string; data_type: Attr["data_type"] }>({
    nombre: "",
    data_type: "text",
  });

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
      setNewAttr({ nombre: "", data_type: "text" });
      await loadSchema(form.tipo_nombre);
      setOk(`Campo "${newAttr.nombre}" creado para ${form.tipo_nombre}`);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo crear el campo");
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">{info?.area.nombre || "Área"}</div>
          {info && (
            <div className="text-sm text-slate-500 flex flex-wrap gap-1">
              {info.ancestors.length === 0 ? (
                <span>Raíz</span>
              ) : (
                <>
                  <span>Subárea de:</span>
                  {info.ancestors.map((a) => (
                    <span
                      key={a.id}
                      className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs"
                    >
                      {a.nombre}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>
      )}
      {ok && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
          {ok}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["COMPONENTE", "PERIFERICO", "EQUIPOS"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t !== "EQUIPOS") {
                // al cambiar de tab, reseteamos selección de tipo y schema
                setForm({ tipo_nombre: "", codigo: "", specs: [{ k: "MARCA", v: "" }, { k: "MODELO", v: "" }] });
                setSchema([]);
              }
            }}
            className={`px-4 py-2 rounded-lg ${
              tab === t ? "bg-slate-900 text-white" : "bg-white border border-slate-300"
            }`}
          >
            {t === "EQUIPOS" ? "Equipos" : t === "COMPONENTE" ? "Componentes" : "Periféricos"}
          </button>
        ))}
      </div>

      {/* Formulario (solo Componentes/Periféricos) */}
      {tab !== "EQUIPOS" && (
        <form onSubmit={createItem} className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <div className="text-sm text-slate-600">
                Tipo <span className="text-slate-400">({claseActual})</span>
              </div>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.tipo_nombre}
                onChange={async (e) => {
                  const tipo = e.target.value;
                  setForm({ ...form, tipo_nombre: tipo });
                  await loadSchema(tipo);
                }}
              >
                <option value="">Seleccione…</option>
                {typeOpts.map((t) => (
                  <option key={t.id} value={t.nombre}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-sm text-slate-600">Código</div>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
            </div>
            <div className="flex items-end">
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

          {/* Campos de ficha dinámica */}
          <div>
            <div className="text-sm text-slate-600 mb-1">Ficha (pares clave/valor)</div>
            <div className="space-y-2">
              {form.specs.map((row, idx) => {
                const dt =
                  schema.find((s) => s.nombre.toLowerCase() === row.k.toLowerCase())?.data_type ||
                  "text";
                return (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Atributo (ej. MARCA)"
                      value={row.k}
                      onChange={(e) => {
                        const copy = [...form.specs];
                        copy[idx].k = e.target.value;
                        setForm({ ...form, specs: copy });
                      }}
                    />
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
                        placeholder={
                          dt === "int"
                            ? "número entero"
                            : dt === "numeric"
                            ? "número decimal"
                            : "texto"
                        }
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
          </div>

          <div>
            <button className="px-4 py-2 rounded-lg bg-slate-900 text-white">
              Crear {claseActual === "COMPONENTE" ? "componente" : "periférico"}
            </button>
          </div>
        </form>
      )}

      {/* Listas */}
      {tab === "COMPONENTE" && <ItemsTable rows={comp} />}
      {tab === "PERIFERICO" && <ItemsTable rows={peri} />}
      {tab === "EQUIPOS" && <EquiposTable rows={eqs} />}

      {/* Modal: nuevo campo */}
      {showNewAttr && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-md">
            <div className="text-lg font-semibold mb-2">
              Nuevo campo para {form.tipo_nombre || "tipo"}
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
              <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={createAttr}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --------- Componentes auxiliares ---------
function ItemsTable({ rows }: { rows: ItemRow[] }) {
  return (
    <div className="bg-white rounded-2xl shadow">
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
                <td className="px-3 py-2">{r.item_codigo}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2">{r.estado}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={`/items/${r.item_id}`}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm"
                  >
                    Ver ficha
                  </Link>
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

function EquiposTable({ rows }: { rows: EquipoRow[] }) {
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.equipo_id} className="border-t">
                <td className="px-3 py-2">{r.equipo_codigo}</td>
                <td className="px-3 py-2">{r.equipo_nombre}</td>
                <td className="px-3 py-2">{r.estado}</td>
                <td className="px-3 py-2">{r.usuario_final || "-"}</td>
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
