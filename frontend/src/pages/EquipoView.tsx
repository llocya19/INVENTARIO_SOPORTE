import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import http from "../api/http";

type ItemLite = {
  item_id: number;
  item_codigo: string;
  clase: "COMPONENTE" | "PERIFERICO";
  tipo: string;
  estado: string;
};

type Equipo = {
  equipo_id: number;
  equipo_codigo: string;
  equipo_nombre: string;
  area_id: number;
  estado: string;
  usuario_final?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items: ItemLite[];
};

type AreaItemRow = {
  item_id: number;
  item_codigo: string;
  clase: "COMPONENTE" | "PERIFERICO";
  tipo: string;
  estado: string;
};

export default function EquipoView() {
  const { id } = useParams();
  const equipoId = Number(id);

  const [data, setData] = useState<Equipo | null>(null);
  const [areaItems, setAreaItems] = useState<AreaItemRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ q: string; estado: "ALMACEN" | "EN_USO" | "TODOS"; clase: "TODOS" | "COMPONENTE" | "PERIFERICO" }>({
    q: "",
    estado: "ALMACEN",
    clase: "TODOS",
  });
  const [toAssign, setToAssign] = useState<number[]>([]);

  async function load() {
    setMsg(null);
    try {
      const r = await http.get<Equipo>(`/api/equipos/${equipoId}`);
      setData(r.data);

      // cargamos items del área: podrás armar desde ALMACEN o ver EN_USO
      const rC = await http.get<AreaItemRow[]>(`/api/areas/${r.data.area_id}/items?clase=COMPONENTE`);
      const rP = await http.get<AreaItemRow[]>(`/api/areas/${r.data.area_id}/items?clase=PERIFERICO`);
      setAreaItems([...rC.data, ...rP.data]);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar el equipo");
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [equipoId]);

  const filtered = useMemo(() => {
    return areaItems.filter(it => {
      if (filter.estado !== "TODOS" && it.estado !== filter.estado) return false;
      if (filter.clase !== "TODOS" && it.clase !== filter.clase) return false;
      if (filter.q && !(`${it.item_codigo} ${it.tipo}`.toLowerCase().includes(filter.q.toLowerCase()))) return false;
      return true;
    });
  }, [areaItems, filter]);

  async function assignSelected() {
    if (!toAssign.length) return;
    try {
      await http.post(`/api/equipos/${equipoId}/assign`, { item_ids: toAssign });
      setOk("Items asignados");
      setToAssign([]);
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo asignar");
    }
  }

  async function unassign(item_id: number) {
    try {
      await http.post(`/api/equipos/${equipoId}/unassign`, { item_id });
      setOk("Item retirado");
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo retirar");
    }
  }

  async function saveMeta(patch: Partial<Pick<Equipo, "equipo_nombre"|"estado"|"usuario_final">>) {
    if (!data) return;
    try {
      await http.patch(`/api/equipos/${equipoId}`, patch);
      setOk("Actualizado");
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo actualizar");
    }
  }

  if (!data) return (
    <div className="max-w-6xl mx-auto p-4">
      {msg ? <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div> : "Cargando..."}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="text-sm">
        <Link to={`/areas/${data.area_id}`} className="text-slate-500 hover:underline">← Volver al área</Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">{data.equipo_codigo}</div>
          <div className="text-slate-500 text-sm">
            Registrado: {data.created_at ? new Date(data.created_at).toLocaleString() : "-"} ·
            Última act.: {data.updated_at ? new Date(data.updated_at).toLocaleString() : "-"}
          </div>
        </div>
      </div>

      {msg && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok &&  <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Encabezado editable */}
      <div className="bg-white rounded-2xl shadow p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-sm text-slate-600">Nombre del equipo</div>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            defaultValue={data.equipo_nombre}
            onBlur={(e) => e.target.value !== data.equipo_nombre && saveMeta({equipo_nombre: e.target.value})}
          />
        </div>
        <div>
          <div className="text-sm text-slate-600">Estado</div>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={data.estado}
            onChange={(e) => saveMeta({estado: e.target.value})}
          >
            <option value="EN_USO">EN_USO</option>
            <option value="ALMACEN">ALMACEN</option>
            <option value="MANTENIMIENTO">MANTENIMIENTO</option>
            <option value="BAJA">BAJA</option>
          </select>
        </div>
        <div>
          <div className="text-sm text-slate-600">Usuario final</div>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            defaultValue={data.usuario_final || ""}
            onBlur={(e) => (e.target.value !== (data.usuario_final||"")) && saveMeta({usuario_final: e.target.value||null as any})}
          />
        </div>
      </div>

      {/* Vista dividida */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Izquierda: items asignados */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-lg font-semibold mb-2">Asignados</div>
          <div className="space-y-2">
            {data.items.map((it) => (
              <div key={it.item_id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="text-sm">
                  <div className="font-medium">{it.item_codigo}</div>
                  <div className="text-slate-500">{it.clase} · {it.tipo} · {it.estado}</div>
                </div>
                <button
                  className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm"
                  onClick={() => unassign(it.item_id)}
                >
                  Retirar
                </button>
              </div>
            ))}
            {data.items.length === 0 && (
              <div className="text-slate-500 text-sm">Sin componentes/periféricos asignados.</div>
            )}
          </div>
        </div>

        {/* Derecha: disponibles en el área (para armar) */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Disponibles en el área</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Buscar código o tipo…"
              value={filter.q}
              onChange={(e)=>setFilter({...filter, q: e.target.value})}
            />
            <select
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={filter.estado}
              onChange={(e)=>setFilter({...filter, estado: e.target.value as any})}
            >
              <option value="ALMACEN">Solo ALMACEN</option>
              <option value="EN_USO">Solo EN_USO</option>
              <option value="TODOS">Todos</option>
            </select>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={filter.clase}
              onChange={(e)=>setFilter({...filter, clase: e.target.value as any})}
            >
              <option value="TODOS">Componentes y Periféricos</option>
              <option value="COMPONENTE">Solo Componentes</option>
              <option value="PERIFERICO">Solo Periféricos</option>
            </select>
          </div>

          <div className="mt-3 border rounded-lg max-h-80 overflow-auto divide-y">
            {filtered.map((it) => {
              const selected = toAssign.includes(it.item_id);
              const disabled = data.items.some(x => x.item_id === it.item_id);
              return (
                <label key={it.item_id} className={`flex items-center justify-between px-3 py-2 ${disabled ? "opacity-50" : ""}`}>
                  <div className="text-sm">
                    <div className="font-medium">{it.item_codigo}</div>
                    <div className="text-slate-500">{it.clase} · {it.tipo} · {it.estado}</div>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    disabled={disabled}
                    checked={selected}
                    onChange={(e)=>{
                      setToAssign(prev => e.target.checked ? [...prev, it.item_id] : prev.filter(x=>x!==it.item_id))
                    }}
                  />
                </label>
              );
            })}
            {filtered.length === 0 && <div className="p-3 text-slate-500 text-sm">Sin resultados.</div>}
          </div>

          <div className="mt-3 flex justify-end">
            <button
              className="px-4 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50"
              onClick={assignSelected}
              disabled={toAssign.length===0}
            >
              Asignar seleccionados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
