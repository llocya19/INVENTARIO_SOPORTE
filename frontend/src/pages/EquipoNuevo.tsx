// src/pages/EquipoNuevo.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import http from "../api/http";

type ItemType = { id: number; clase: "COMPONENTE" | "PERIFERICO"; nombre: string };
type ItemRow = {
  item_id: number; item_codigo: string; clase: "COMPONENTE" | "PERIFERICO";
  tipo: string; estado: string; created_at?: string|null;
};
type ItemsPage = { items: ItemRow[]; total: number; page: number; size: number };

export default function EquipoNuevo() {
  const { areaId } = useParams();
  const aid = Number(areaId);
  const nav = useNavigate();

  const [form, setForm] = useState({
    codigo: "", nombre: "", estado: "ALMACEN", usuario_final: "", login: "", password: ""
  });

  // tipos para filtros
  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);

  // filtros + paginación
  const [filtC, setFiltC] = useState<{ tipo: string; q: string }>({ tipo: "", q: "" });
  const [filtP, setFiltP] = useState<{ tipo: string; q: string }>({ tipo: "", q: "" });
  const [pageC, setPageC] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });
  const [pageP, setPageP] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });

  // selección
  const [selComp, setSelComp] = useState<number[]>([]);
  const [selPeri, setSelPeri] = useState<number[]>([]);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function loadTypes() {
    const [c, p] = await Promise.all([
      http.get<ItemType[]>("/api/item-types?clase=COMPONENTE"),
      http.get<ItemType[]>("/api/item-types?clase=PERIFERICO"),
    ]);
    setTypesC(c.data);
    setTypesP(p.data);
  }

  async function loadDisponibles(clase: "COMPONENTE" | "PERIFERICO", page = 1, size = 10) {
    const f = clase === "COMPONENTE" ? filtC : filtP;
    const params: any = { clase, page, size };
    if (f.tipo) params.tipo = f.tipo;
    if (f.q) params.q = f.q;

    const r = await http.get<ItemsPage>(`/api/areas/${aid}/items-disponibles`, { params });
    if (clase === "COMPONENTE") setPageC(r.data);
    else setPageP(r.data);
  }

  useEffect(() => {
    loadTypes();
    loadDisponibles("COMPONENTE", 1, pageC.size);
    loadDisponibles("PERIFERICO", 1, pageP.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aid]);

  async function crearEquipo() {
    setMsg(null); setOk(null);
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setMsg("Código y nombre son requeridos"); return;
    }
    const items = [
      ...selComp.map(id => ({ item_id: id, slot: null })),
      ...selPeri.map(id => ({ item_id: id, slot: null })),
    ];
    try {
      const r = await http.post<{ equipo_id: number }>(`/api/areas/${aid}/equipos`, {
        ...form,
        items
      });
      setOk("Equipo creado");
      nav(`/equipos/${r.data.equipo_id}`);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo crear");
    }
  }

  const compLeft = useMemo(() => pageC.items.filter(i => !selComp.includes(i.item_id)), [pageC.items, selComp]);
  const periLeft = useMemo(() => pageP.items.filter(i => !selPeri.includes(i.item_id)), [pageP.items, selPeri]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="text-xl font-semibold">Nuevo equipo (desde ALMACÉN)</div>

      {msg && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-slate-600">Código</div>
            <input className="w-full border rounded-lg px-3 py-2"
              value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })}/>
          </div>
          <div>
            <div className="text-sm text-slate-600">Nombre</div>
            <input className="w-full border rounded-lg px-3 py-2"
              value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}/>
          </div>
          <div>
            <div className="text-sm text-slate-600">Estado</div>
            <select className="w-full border rounded-lg px-3 py-2"
              value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
              <option value="ALMACEN">ALMACEN</option>
              <option value="USO">USO</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
              <option value="BAJA">BAJA</option>
            </select>
          </div>
          <div>
            <div className="text-sm text-slate-600">Usuario final</div>
            <input className="w-full border rounded-lg px-3 py-2"
              value={form.usuario_final} onChange={e => setForm({ ...form, usuario_final: e.target.value })}/>
          </div>
          <div>
            <div className="text-sm text-slate-600">Login</div>
            <input className="w-full border rounded-lg px-3 py-2"
              value={form.login} onChange={e => setForm({ ...form, login: e.target.value })}/>
          </div>
          <div>
            <div className="text-sm text-slate-600">Password</div>
            <input className="w-full border rounded-lg px-3 py-2" type="password"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/>
          </div>
        </div>
      </div>

      <SelectorLista
        title="Componentes disponibles"
        page={pageC}
        types={typesC}
        filter={filtC}
        onFilter={setFiltC}
        selected={selComp}
        onSelect={setSelComp}
        reload={(p, s) => loadDisponibles("COMPONENTE", p, s)}
        rows={compLeft}
      />

      <SelectorLista
        title="Periféricos disponibles"
        page={pageP}
        types={typesP}
        filter={filtP}
        onFilter={setFiltP}
        selected={selPeri}
        onSelect={setSelPeri}
        reload={(p, s) => loadDisponibles("PERIFERICO", p, s)}
        rows={periLeft}
      />

      <div>
        <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={crearEquipo}>
          Crear equipo
        </button>
      </div>
    </div>
  );
}

function SelectorLista(props: {
  title: string;
  page: ItemsPage;
  types: ItemType[];
  filter: { tipo: string; q: string };
  onFilter: (f: { tipo: string; q: string }) => void;
  rows: ItemRow[];
  selected: number[];
  onSelect: (ids: number[]) => void;
  reload: (p: number, s: number) => void;
}) {
  const { title, page, types, filter, onFilter, rows, selected, onSelect, reload } = props;
  const totalPages = Math.max(1, Math.ceil(page.total / page.size));

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <div className="text-lg font-semibold">{title}</div>

      <div className="grid sm:grid-cols-3 gap-2">
        <div>
          <div className="text-sm text-slate-600">Tipo</div>
          <select className="w-full border rounded-lg px-3 py-2"
            value={filter.tipo}
            onChange={e => onFilter({ ...filter, tipo: e.target.value })}>
            <option value="">(Todos)</option>
            {types.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <div className="text-sm text-slate-600">Buscar código</div>
          <input className="w-full border rounded-lg px-3 py-2"
            value={filter.q}
            onChange={e => onFilter({ ...filter, q: e.target.value })}/>
        </div>
        <div className="flex items-end gap-2">
          <button className="px-3 py-2 rounded-lg border" onClick={() => reload(1, page.size)}>Aplicar</button>
          <button className="px-3 py-2 rounded-lg border" onClick={() => { onFilter({ tipo: "", q: "" }); reload(1, page.size); }}>
            Limpiar
          </button>
        </div>
      </div>

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
            {rows.map(r => (
              <tr key={r.item_id} className="border-t">
                <td className="px-3 py-2">{r.item_codigo}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2">{r.estado}</td>
                <td className="px-3 py-2 text-right">
                  {selected.includes(r.item_id) ? (
                    <button className="px-3 py-1.5 rounded-lg border" onClick={() => onSelect(selected.filter(id => id !== r.item_id))}>
                      Quitar
                    </button>
                  ) : (
                    <button className="px-3 py-1.5 rounded-lg bg-slate-900 text-white"
                      onClick={() => onSelect([...selected, r.item_id])}>
                      Agregar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-3 py-6 text-slate-500" colSpan={4}>Sin registros</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Página {page.page} de {totalPages} · {page.total} ítems
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg border"
            disabled={page.page <= 1}
            onClick={() => reload(page.page - 1, page.size)}>
            ◀
          </button>
          <select className="border rounded-lg px-2 py-1.5"
            value={page.size}
            onChange={e => reload(1, Number(e.target.value))}>
            {[10, 20, 50].map(s => <option key={s} value={s}>{s} / pág</option>)}
          </select>
          <button className="px-3 py-1.5 rounded-lg border"
            disabled={page.page >= totalPages}
            onClick={() => reload(page.page + 1, page.size)}>
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
