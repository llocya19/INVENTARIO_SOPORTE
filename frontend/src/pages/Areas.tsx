// src/pages/Areas.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http from "../api/http";
import { getUser } from "../services/authService";

type Area = { id: number; nombre: string; padre_id: number | null };
type AreaInfo = {
  area: { id:number; nombre:string; padre_id:number|null };
  ancestors: { id:number; nombre:string; padre_id:number|null }[];
  children: { id:number; nombre:string }[];
};

export default function Areas() {
  const u = getUser();
  const isAdmin = u?.rol === "ADMIN";

  const [areas, setAreas] = useState<Area[]>([]);
  const [msg, setMsg] = useState<string|null>(null);
  const [ok, setOk]   = useState<string|null>(null);

  // forms
  const [rootForm, setRootForm] = useState({ nombre: "" });
  const [subForm,  setSubForm]  = useState({ nombre: "", padre_id: "" });

  // modal info
  const [showInfo, setShowInfo] = useState(false);
  const [info, setInfo] = useState<AreaInfo | null>(null);

  const load = async () => {
    setMsg(null);
    try {
      const r = await http.get<Area[]>("/api/areas");
      setAreas(r.data);
    } catch (e:any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar las áreas");
    }
  };
  useEffect(()=>{ load(); }, []);

  // crear raíz
  async function createRoot(e:React.FormEvent) {
    e.preventDefault();
    setMsg(null); setOk(null);
    if (!rootForm.nombre.trim()) { setMsg("Nombre requerido"); return; }
    try{
      await http.post("/api/areas/root", { nombre: rootForm.nombre.trim() });
      setOk(`Área raíz "${rootForm.nombre.trim()}" creada`);
      setRootForm({ nombre: "" });
      load();
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo crear el área raíz");
    }
  }

  // crear subárea
  async function createSub(e:React.FormEvent) {
    e.preventDefault();
    setMsg(null); setOk(null);
    if (!subForm.nombre.trim() || !subForm.padre_id) {
      setMsg("Completa nombre y padre"); return;
    }
    try{
      await http.post("/api/areas/sub", { nombre: subForm.nombre.trim(), padre_id: Number(subForm.padre_id) });
      setOk(`Subárea "${subForm.nombre.trim()}" creada`);
      setSubForm({ nombre: "", padre_id: "" });
      load();
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo crear la subárea");
    }
  }

  async function openInfo(id:number) {
    setMsg(null); setInfo(null); setShowInfo(true);
    try{
      const r = await http.get<AreaInfo>(`/api/areas/${id}/info`);
      setInfo(r.data);
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo obtener la info");
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Áreas</h1>

      {msg && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok  && <div className="mb-3 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Solo ADMIN: crear raíz y subárea */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* raíz */}
          <form onSubmit={createRoot} className="bg-white rounded-2xl shadow p-4">
            <div className="text-base font-medium mb-3">Crear área raíz</div>
            <div className="grid gap-3">
              <div>
                <div className="text-sm text-slate-600">Nombre</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                       placeholder='Ej. "Soporte"'
                       value={rootForm.nombre}
                       onChange={e=>setRootForm({ nombre: e.target.value })}/>
              </div>
            </div>
            <div className="mt-3">
              <button className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800">Crear área raíz</button>
            </div>
          </form>

          {/* subárea */}
          <form onSubmit={createSub} className="bg-white rounded-2xl shadow p-4">
            <div className="text-base font-medium mb-3">Crear subárea</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-slate-600">Nombre de la subárea</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                       placeholder='Ej. "Laboratorio"'
                       value={subForm.nombre}
                       onChange={e=>setSubForm({ ...subForm, nombre: e.target.value })}/>
              </div>
              <div>
                <div className="text-sm text-slate-600">Padre (puede ser raíz o subárea)</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                        value={subForm.padre_id}
                        onChange={e=>setSubForm({ ...subForm, padre_id: e.target.value })}>
                  <option value="">Seleccione...</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} {a.padre_id ? "(subárea)" : "(raíz)"}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-500 mt-1">Se creará debajo del área seleccionada.</div>
              </div>
            </div>
            <div className="mt-3">
              <button className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800">Crear subárea</button>
            </div>
          </form>
        </div>
      )}

      {/* Grid de áreas */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map(a => (
          <div key={a.id} className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-medium">{a.nombre}</div>
                <div className="text-sm text-slate-500">{a.padre_id ? "Subárea" : "Raíz"}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>openInfo(a.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm">
                  Info
                </button>
                <Link to={`/areas/${a.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-sm">
                  Abrir
                </Link>
              </div>
            </div>
          </div>
        ))}
        {areas.length===0 && <div className="text-slate-500">No hay áreas</div>}
      </div>

      {/* Modal Info */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-[min(96vw,640px)] p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Información del área</div>
              <button onClick={()=>setShowInfo(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">Cerrar</button>
            </div>
            <div className="mt-3 space-y-3">
              {!info ? (
                <div className="text-slate-500">Cargando…</div>
              ) : (
                <>
                  <div>
                    <div className="text-sm text-slate-500">Área</div>
                    <div className="font-medium">{info.area.nombre} (ID {info.area.id})</div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-500">Pertenece a (cadena de padres)</div>
                    {info.ancestors.length === 0 ? (
                      <div className="text-slate-600">— Es raíz —</div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {info.ancestors.map((p, i) => (
                          <span key={p.id} className="inline-flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">{p.nombre}</span>
                            {i < info.ancestors.length - 1 && <span className="text-slate-400">›</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm text-slate-500">Subáreas directas</div>
                    {info.children.length === 0 ? (
                      <div className="text-slate-600">— Sin subáreas —</div>
                    ) : (
                      <ul className="list-disc pl-5">
                        {info.children.map(c => (
                          <li key={c.id} className="text-slate-700">{c.nombre} (ID {c.id})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
