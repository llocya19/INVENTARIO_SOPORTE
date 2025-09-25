// src/pages/EquipoNuevoUso.tsx
import React, { memo, useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import http from "../api/http";

type Clase = "COMPONENTE" | "PERIFERICO";
type ItemType = { id: number; clase: Clase; nombre: string };
type Attr = { nombre: string; data_type: "text" | "int" | "numeric" | "bool" | "date"; orden?: number | null };

type SpecKV = { k: string; v: string };

type NuevoItem = {
  clase: Clase;
  tipo_nombre: string;
  codigo: string;
  specs: SpecKV[];
  schema: Attr[];
  files?: FileList | null;
};

export default function EquipoNuevoUso() {
  const { areaId } = useParams();
  const aid = Number(areaId);
  const nav = useNavigate();

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    estado: "USO", // fijo
    usuario_final: "",
    login: "",
    password: "",
  });

  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);
  const [comp, setComp] = useState<NuevoItem[]>([]);
  const [peri, setPeri] = useState<NuevoItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function loadSchema(clase: Clase, tipo: string) {
    if (!tipo) return [];
    const r = await http.get<Attr[]>("/api/spec/attrs", { params: { clase, tipo } });
    return r.data || [];
  }
  async function suggestCode(clase: Clase, tipo: string) {
    try {
      const r = await http.get<{ next_code: string }>("/api/items/next-code", { params: { clase, tipo, area_id: aid } });
      return r.data?.next_code || "";
    } catch {
      return "";
    }
  }

  const addRow = (clase: Clase) => {
    const n: NuevoItem = { clase, tipo_nombre: "", codigo: "", specs: [], schema: [], files: null };
    if (clase === "COMPONENTE") setComp((v) => [...v, n]);
    else setPeri((v) => [...v, n]);
  };

  const onChangeTipo = async (list: "C" | "P", idx: number, tipo: string) => {
    const clase: Clase = list === "C" ? "COMPONENTE" : "PERIFERICO";
    const schema = await loadSchema(clase, tipo);
    const codigo = await suggestCode(clase, tipo);

    const setList = list === "C" ? setComp : setPeri;
    setList((arr) => {
      const copy = [...arr];
      const prevSpecs = copy[idx]?.specs || [];
      // Alinear por nombre de atributo (mantener valores previos si coinciden)
      const specs = schema.map((a) => {
        const prev = prevSpecs.find((s) => s.k.toLowerCase() === a.nombre.toLowerCase());
        return { k: a.nombre, v: prev?.v ?? "" };
      });
      copy[idx] = { ...copy[idx], tipo_nombre: tipo, schema, specs, codigo };
      return copy;
    });
  };

  function buildValidated(specs: SpecKV[], schema: Attr[]): string | Record<string, any> {
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
    return out;
  }

  async function guardar() {
    setMsg(null);
    setOk(null);

    // Forzar blur del campo activo, para que RowEditor dispare onBlur y suba el último valor
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!form.codigo.trim() || !form.nombre.trim()) {
      setMsg("Código y nombre del equipo son requeridos");
      return;
    }
    for (const arr of [comp, peri]) {
      for (const row of arr) {
        if (!row.tipo_nombre) return setMsg("Completa el tipo en cada fila");
        if (!row.codigo.trim()) return setMsg("Completa el código en cada fila");
        const specsOr = buildValidated(row.specs, row.schema);
        if (typeof specsOr === "string") return setMsg(specsOr);
      }
    }

    setSaving(true);
    try {
      // 1) equipo (USO fijo)
      const creq = await http.post<{ equipo_id: number }>(`/api/areas/${aid}/equipos`, {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        estado: "USO",
        usuario_final: form.usuario_final?.trim() || null,
        login: form.login?.trim() || null,
        password: form.password?.trim() || null,
        items: [],
      });
      const equipo_id = creq.data.equipo_id;

      // 2) crear ítems + media + asignar
      const crearYAsignar = async (row: NuevoItem) => {
        const specs = buildValidated(row.specs, row.schema) as Record<string, any>;
        const ir = await http.post<{ item_id: number }>("/api/items", {
          codigo: row.codigo.trim(),
          clase: row.clase,
          tipo_nombre: row.tipo_nombre,
          area_id: aid,
          specs,
        });
        const item_id = ir.data.item_id;

        if (row.files && row.files.length > 0) {
          const fd = new FormData();
          Array.from(row.files).forEach((f) => fd.append("files", f));
          await http.post(`/api/items/${item_id}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        }
        await http.post(`/api/equipos/${equipo_id}/items`, { item_id, slot: null });
      };

      for (const r of comp) await crearYAsignar(r);
      for (const r of peri) await crearYAsignar(r);

      setOk("Equipo creado en USO con sus ítems");
      nav(`/equipos/${equipo_id}`);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo crear el equipo");
    } finally {
      setSaving(false);
    }
  }

  // ---------- RowEditor con estado local y sync solo en onBlur ----------
  const RowEditor = memo(function RowEditor(props: {
    list: "C" | "P";
    idx: number;
    row: NuevoItem;
    onRow: (updater: (prev: NuevoItem) => NuevoItem) => void;
    types: ItemType[];
  }) {
    const { list, idx, row, onRow, types } = props;
    const clase = list === "C" ? "COMPONENTE" : "PERIFERICO";

    // Estado local: escritura fluida sin tocar el padre
    const [localCodigo, setLocalCodigo] = useState(row.codigo);
    const [localSpecs, setLocalSpecs] = useState<Record<string, string>>(() => {
      const o: Record<string, string> = {};
      row.specs.forEach((s) => (o[s.k] = s.v ?? ""));
      return o;
    });

    // Si cambia el código desde arriba (por sugerencia), sincronizamos
    useEffect(() => {
      setLocalCodigo(row.codigo);
    }, [row.codigo]);

    // Si cambia tipo o schema, rearmar mapa manteniendo valores previos
    useEffect(() => {
      const next: Record<string, string> = {};
      row.schema.forEach((a) => {
        const prevLocal = localSpecs[a.nombre];
        const prevArr = row.specs.find((s) => s.k.toLowerCase() === a.nombre.toLowerCase())?.v;
        next[a.nombre] = prevLocal ?? prevArr ?? "";
      });
      setLocalSpecs(next);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row.tipo_nombre, row.schema]);

    // Subir cambios al padre solo en blur
    const flushParent = useCallback(() => {
      onRow((prev) => {
        const specsArr: SpecKV[] = Object.entries(localSpecs).map(([k, v]) => ({ k, v }));
        return { ...prev, codigo: localCodigo, specs: specsArr };
      });
    }, [localCodigo, localSpecs, onRow]);

    const setSpecLocal = (name: string, val: string) => {
      setLocalSpecs((s) => ({ ...s, [name]: val }));
      // NO flusheamos aquí
    };

    const handleCodigo = (val: string) => {
      setLocalCodigo(val);
      // NO flusheamos aquí
    };

    return (
      <div className="border rounded-lg p-3 space-y-2">
        <div className="grid sm:grid-cols-3 gap-2">
          <div>
            <div className="text-sm text-slate-600">Tipo ({clase})</div>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={row.tipo_nombre}
              onChange={(e) => onChangeTipo(list, idx, e.target.value)}
            >
              <option value="">Seleccione…</option>
              {types.map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm text-slate-600">Código</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={localCodigo}
              onChange={(e) => handleCodigo(e.target.value)}
              onBlur={flushParent}
              autoComplete="off"
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Imágenes</div>
            <input
              type="file"
              multiple
              accept="image/*"
              className="w-full border rounded-lg px-3 py-2"
              onChange={(e) => onRow((prev) => ({ ...prev, files: e.target.files }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          {row.schema.length === 0 ? (
            <div className="text-sm text-slate-500">Selecciona un tipo para ver la ficha…</div>
          ) : (
            row.schema.map((a) => {
              const value = localSpecs[a.nombre] ?? "";
              const key = `spec-${row.tipo_nombre}-${a.nombre}`;
              return (
                <div key={key}>
                  <div className="text-xs text-slate-600">
                    {a.nombre} <span className="text-slate-400">({a.data_type})</span>
                  </div>

                  {a.data_type === "bool" ? (
                    <select
                      className="w-full border rounded-lg px-3 py-2"
                      value={value}
                      onChange={(e) => setSpecLocal(a.nombre, e.target.value)}
                      onBlur={flushParent}
                    >
                      <option value="">--</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : a.data_type === "date" ? (
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2"
                      value={value}
                      onChange={(e) => setSpecLocal(a.nombre, e.target.value)}
                      onBlur={flushParent}
                      autoComplete="off"
                    />
                  ) : (
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder={a.data_type === "int" ? "entero" : a.data_type === "numeric" ? "decimal" : "texto"}
                      value={value}
                      onChange={(e) => setSpecLocal(a.nombre, e.target.value)}
                      onBlur={flushParent}
                      autoComplete="off"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="text-xl font-semibold">Nuevo equipo en USO (crear y asignar ítems)</div>

      {msg && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-slate-600">Código</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Nombre</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              autoComplete="off"
            />
          </div>

          {/* Estado fijo (no select) */}
          <div>
            <div className="text-sm text-slate-600">Estado</div>
            <input className="w-full border rounded-lg px-3 py-2 bg-slate-50" value="USO" readOnly />
          </div>

          <div>
            <div className="text-sm text-slate-600">Usuario final</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.usuario_final}
              onChange={(e) => setForm({ ...form, usuario_final: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Login</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Password</div>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Componentes</div>
        <button className="px-3 py-2 rounded-lg border" onClick={() => addRow("COMPONENTE")}>
          + Agregar componente
        </button>
      </div>
      <div className="space-y-3">
        {comp.map((r, i) => (
          <RowEditor
            key={`c-${i}`}
            list="C"
            idx={i}
            row={r}
            types={typesC}
            onRow={(updater) =>
              setComp((arr) => {
                const copy = [...arr];
                copy[i] = updater(copy[i]);
                return copy;
              })
            }
          />
        ))}
        {comp.length === 0 && <div className="text-sm text-slate-500">Sin filas</div>}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Periféricos</div>
        <button className="px-3 py-2 rounded-lg border" onClick={() => addRow("PERIFERICO")}>
          + Agregar periférico
        </button>
      </div>
      <div className="space-y-3">
        {peri.map((r, i) => (
          <RowEditor
            key={`p-${i}`}
            list="P"
            idx={i}
            row={r}
            types={typesP}
            onRow={(updater) =>
              setPeri((arr) => {
                const copy = [...arr];
                copy[i] = updater(copy[i]);
                return copy;
              })
            }
          />
        ))}
        {peri.length === 0 && <div className="text-sm text-slate-500">Sin filas</div>}
      </div>

      <div className="flex justify-end">
        <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" disabled={saving} onClick={guardar}>
          {saving ? "Guardando..." : "Guardar equipo"}
        </button>
      </div>
    </div>
  );
}
