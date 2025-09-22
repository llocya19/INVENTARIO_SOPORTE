// frontend/src/pages/EquipoDetalle.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import http from "../api/http";

type ItemRow = { item_id: number; item_codigo: string; clase: string; tipo: string; estado: string };
type Equipo = {
  equipo_id: number; equipo_codigo: string; equipo_nombre: string; area_id: number;
  estado: string; usuario_final?: string|null; login?: string|null; password?: string|null;
  created_at?: string|null; updated_at?: string|null; items: ItemRow[];
};

export default function EquipoDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const eid = Number(id);

  const [data, setData] = useState<Equipo | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    try {
      const r = await http.get<Equipo>(`/api/equipos/${eid}`);
      setData(r.data);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eid]);

  async function retirar(item_id: number) {
    if (!confirm("¿Retirar este ítem del equipo?")) return;
    setMsg(null); setOk(null);
    try {
      await http.delete(`/api/equipos/${eid}/items/${item_id}`);
      await load();
      setOk("Ítem retirado");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo retirar");
    }
  }

  async function guardarCabecera() {
    if (!data) return;
    setMsg(null); setOk(null);
    try {
      await http.patch(`/api/equipos/${eid}`, {
        equipo_nombre: data.equipo_nombre,
        equipo_estado: data.estado,
        equipo_usuario_final: data.usuario_final,
        equipo_login: data.login,
        equipo_password: data.password
      });
      setOk("Equipo actualizado");
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo actualizar");
    }
  }

  if (!data) return <div className="p-4">Cargando…</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">
          Equipo <span className="text-slate-500">Código: {data.equipo_codigo}</span>
        </div>
        <button className="px-3 py-2 rounded-lg border" onClick={() => nav(`/areas/${data.area_id}`)}>
          ← Volver al área
        </button>
      </div>

      {msg && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Cabecera editable */}
      <div className="bg-white rounded-2xl shadow p-4 grid sm:grid-cols-3 gap-3">
        <div>
          <div className="text-sm text-slate-600">Nombre</div>
          <input className="w-full border rounded-lg px-3 py-2"
            value={data.equipo_nombre}
            onChange={e => setData({ ...data, equipo_nombre: e.target.value })}/>
        </div>
        <div>
          <div className="text-sm text-slate-600">Estado</div>
          <select className="w-full border rounded-lg px-3 py-2"
            value={data.estado}
            onChange={e => setData({ ...data, estado: e.target.value })}>
            <option value="USO">USO</option>
            <option value="ALMACEN">ALMACEN</option>
            <option value="MANTENIMIENTO">MANTENIMIENTO</option>
          </select>
        </div>
        <div>
          <div className="text-sm text-slate-600">Usuario final</div>
          <input className="w-full border rounded-lg px-3 py-2"
            value={data.usuario_final || ""}
            onChange={e => setData({ ...data, usuario_final: e.target.value })}/>
        </div>
        <div>
          <div className="text-sm text-slate-600">Login</div>
          <input className="w-full border rounded-lg px-3 py-2"
            value={data.login || ""}
            onChange={e => setData({ ...data, login: e.target.value })}/>
        </div>
        <div>
          <div className="text-sm text-slate-600">Password</div>
          <input className="w-full border rounded-lg px-3 py-2" type="password"
            value={data.password || ""}
            onChange={e => setData({ ...data, password: e.target.value })}/>
        </div>
        <div className="flex items-end">
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={guardarCabecera}>
            Guardar cambios
          </button>
        </div>
      </div>

      {/* Items asignados */}
      <div className="bg-white rounded-2xl shadow">
        <div className="px-4 py-3 font-semibold">Componentes & Periféricos asignados</div>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead className="bg-slate-50">
              <tr className="text-left text-sm text-slate-600">
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Clase</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(it => (
                <tr key={it.item_id} className="border-t">
                  <td className="px-3 py-2">{it.item_codigo}</td>
                  <td className="px-3 py-2">{it.clase}</td>
                  <td className="px-3 py-2">{it.tipo}</td>
                  <td className="px-3 py-2">{it.estado}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/items/${it.item_id}`}
                      className="px-3 py-1.5 rounded-lg border mr-2">Ver ficha</Link>
                    <button className="px-3 py-1.5 rounded-lg border"
                      onClick={() => retirar(it.item_id)}>
                      Retirar
                    </button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td className="px-3 py-6 text-slate-500" colSpan={5}>Sin ítems asignados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
