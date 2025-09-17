import { useEffect, useMemo, useState } from "react";
import http from "../api/http";

type User = {
  id: number;
  username: string;
  activo: boolean;
  area_id: number;
  rol: "ADMIN" | "SOPORTE" | "PRACTICANTE";
  ultimo_login?: string;
};

export default function Users() {
  const [items, setItems] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [form, setForm] = useState({ username:"", password:"", rol:"PRACTICANTE" as User["rol"], area_id:0 });
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<User> & { password?: string }>({});

  const load = () => {
    const params = q ? { params: { q } } : undefined;
    http.get<User[]>("/api/users", params)
      .then(r=>setItems(r.data))
      .catch(e=>setMsg(e?.response?.data?.error || "No se pudo cargar usuarios"));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items, [items]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setOk(null);
    if (!form.username || !form.password || !form.area_id) {
      setMsg("Completa usuario, contraseña y área"); return;
    }
    try {
      await http.post("/api/users", form);
      setOk(`Usuario "${form.username}" creado`);
      setForm({ username:"", password:"", rol:"PRACTICANTE", area_id:0 });
      load();
    } catch (e:any) {
      setMsg(e?.response?.data?.error || "Error al crear");
    }
  };

  const startEdit = (u: User) => { setEditId(u.id); setEdit({ rol:u.rol, area_id:u.area_id, activo:u.activo, password:"" }); setMsg(null); setOk(null); };
  const cancelEdit = () => { setEditId(null); setEdit({}); };

  const saveEdit = async (id:number) => {
    setMsg(null); setOk(null);
    const payload:any = {};
    if (edit.rol) payload.rol = edit.rol;
    if (typeof edit.area_id === "number") payload.area_id = edit.area_id;
    if (typeof edit.activo === "boolean") payload.activo = edit.activo;
    if (edit.password) payload.password = edit.password;
    try {
      await http.patch(`/api/users/${id}`, payload);
      setOk("Usuario actualizado");
      cancelEdit(); load();
    } catch (e:any) { setMsg(e?.response?.data?.error || "Error al actualizar"); }
  };

  const toggleActivo = async (u: User) => {
    try { 
      await http.patch(`/api/users/${u.id}`, { activo: !u.activo });
      setOk(!u.activo ? `Usuario "${u.username}" activado` : `Usuario "${u.username}" desactivado`);
      load();
    } catch(e:any){ setMsg(e?.response?.data?.error || "No se pudo cambiar estado"); }
  };

  const resetPwd = async (u: User) => {
    const pwd = prompt(`Nueva contraseña para ${u.username}`);
    if (!pwd) return;
    try { await http.patch(`/api/users/${u.id}`, { password: pwd }); setOk("Contraseña actualizada"); }
    catch(e:any){ setMsg(e?.response?.data?.error || "No se pudo cambiar contraseña"); }
  };

  const del = async (u: User) => {
    if (!confirm(`¿Eliminar usuario ${u.username}?`)) return;
    try { await http.delete(`/api/users/${u.id}`); setOk("Usuario eliminado"); load(); }
    catch(e:any){ setMsg(e?.response?.data?.error || "No se pudo eliminar"); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Usuarios</h1>

      {msg && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok  && <div className="mb-3 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Crear: responsive */}
      <form onSubmit={onCreate} className="bg-white rounded-2xl shadow p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-sm text-slate-600">Usuario</div>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
          </div>
          <div>
            <div className="text-sm text-slate-600">Contraseña</div>
            <input type="password" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
          </div>
          <div>
            <div className="text-sm text-slate-600">Rol</div>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.rol} onChange={e=>setForm({...form, rol: e.target.value as User["rol"]})}>
              <option value="PRACTICANTE">PRACTICANTE</option>
              <option value="SOPORTE">SOPORTE</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div>
            <div className="text-sm text-slate-600">Área ID</div>
            <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.area_id || ""} onChange={e=>setForm({...form, area_id:Number(e.target.value)})}/>
          </div>
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800">Crear usuario</button>
        </div>
      </form>

      {/* Buscar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input placeholder="Buscar por usuario..." className="w-full sm:max-w-sm rounded-lg border border-slate-300 px-3 py-2" value={q} onChange={e=>setQ(e.target.value)}/>
        <button className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 w-full sm:w-auto" onClick={load}>Buscar</button>
      </div>

      {/* Tabla: scroll horizontal + header sticky + alto máx con scroll vertical */}
      <div className="bg-white rounded-2xl shadow relative overflow-x-auto">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white shadow-sm">
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 px-3">ID</th>
                <th className="py-2 px-3">Usuario</th>
                <th className="py-2 px-3">Rol</th>
                <th className="py-2 px-3">Área</th>
                <th className="py-2 px-3">Estado</th>
                <th className="py-2 px-3">Último login</th>
                <th className="py-2 px-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u=>(
                <tr key={u.id} className="border-b last:border-b-0">
                  <td className="py-2 px-3">{u.id}</td>
                  <td className="py-2 px-3 break-all">{u.username}</td>
                  <td className="py-2 px-3">
                    {editId === u.id ? (
                      <select className="w-36 rounded-lg border border-slate-300 px-2 py-1" value={edit.rol ?? u.rol}
                              onChange={e=>setEdit({...edit, rol: e.target.value as User["rol"]})}>
                        <option value="PRACTICANTE">PRACTICANTE</option>
                        <option value="SOPORTE">SOPORTE</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    ) : (
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-slate-100">{u.rol}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {editId === u.id ? (
                      <input type="number" className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                             value={(edit.area_id ?? u.area_id) as any}
                             onChange={e=>setEdit({...edit, area_id:Number(e.target.value)})}/>
                    ) : u.area_id}
                  </td>
                  <td className="py-2 px-3">
                    {editId === u.id ? (
                      <select className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                              value={String(edit.activo ?? u.activo)}
                              onChange={e=>setEdit({...edit, activo: e.target.value === "true"})}>
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    ) : (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${u.activo?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-700'}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">{u.ultimo_login?.replace("T"," ").slice(0,19) || "-"}</td>
                  <td className="py-2 px-3">
                    {editId === u.id ? (
                      <div className="flex flex-wrap gap-2">
                        <input type="password" placeholder="Nueva clave (opcional)" className="w-48 rounded-lg border border-slate-300 px-2 py-1"
                               value={edit.password ?? ""} onChange={e=>setEdit({...edit, password:e.target.value})}/>
                        <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={()=>saveEdit(u.id)}>Guardar</button>
                        <button className="px-3 py-2 rounded-lg border border-slate-300" onClick={cancelEdit}>Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button className="px-3 py-2 rounded-lg border border-slate-300" onClick={()=>startEdit(u)}>Editar</button>
                        <button className="px-3 py-2 rounded-lg border border-slate-300" onClick={()=>toggleActivo(u)}>
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button className="px-3 py-2 rounded-lg border border-slate-300" onClick={()=>resetPwd(u)}>Cambiar clave</button>
                        <button className="px-3 py-2 rounded-lg bg-red-600 text-white" onClick={()=>del(u)}>Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
