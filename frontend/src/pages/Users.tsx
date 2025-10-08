// src/pages/Users.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Crear
  const [openCreate, setOpenCreate] = useState(true);
  const [form, setForm] = useState({
    username: "",
    password: "",
    rol: "PRACTICANTE" as User["rol"],
    area_id: 0,
  });

  // Editar inline
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<User> & { password?: string }>({});

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setMsg(null);
      const params = q ? { params: { q } } : undefined;
      const r = await http.get<User[]>("/api/users", params);
      setItems(r.data);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => items, [items]);

  /* ------------ Crear ------------ */
  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setOk(null);
    if (!form.username.trim() || !form.password || !form.area_id) {
      setMsg("Completa usuario, contraseña y área");
      return;
    }
    try {
      await http.post("/api/users", {
        username: form.username.trim(),
        password: form.password,
        rol: form.rol,
        area_id: form.area_id,
      });
      setOk(`Usuario "${form.username.trim()}" creado`);
      setForm({ username: "", password: "", rol: "PRACTICANTE", area_id: 0 });
      await load();
      setOpenCreate(false);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Error al crear");
    }
  };

  /* ------------ Editar ------------ */
  const startEdit = (u: User) => {
    setEditId(u.id);
    setEdit({ rol: u.rol, area_id: u.area_id, activo: u.activo, password: "" });
    setMsg(null);
    setOk(null);
  };
  const cancelEdit = () => {
    setEditId(null);
    setEdit({});
  };

  const saveEdit = async (id: number) => {
    setMsg(null);
    setOk(null);
    const payload: any = {};
    if (edit.rol) payload.rol = edit.rol;
    if (typeof edit.area_id === "number") payload.area_id = edit.area_id;
    if (typeof edit.activo === "boolean") payload.activo = edit.activo;
    if (edit.password) payload.password = edit.password;

    try {
      await http.patch(`/api/users/${id}`, payload);
      setOk("Usuario actualizado");
      cancelEdit();
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Error al actualizar");
    }
  };

  /* ------------ Acciones rápidas ------------ */
  const toggleActivo = async (u: User) => {
    try {
      await http.patch(`/api/users/${u.id}`, { activo: !u.activo });
      setOk(!u.activo ? `Usuario "${u.username}" activado` : `Usuario "${u.username}" desactivado`);
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cambiar estado");
    }
  };

  const resetPwd = async (u: User) => {
    const pwd = prompt(`Nueva contraseña para ${u.username}`);
    if (!pwd) return;
    try {
      await http.patch(`/api/users/${u.id}`, { password: pwd });
      setOk("Contraseña actualizada");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cambiar contraseña");
    }
  };

  const del = async (u: User) => {
    if (!confirm(`¿Eliminar usuario ${u.username}?`)) return;
    try {
      await http.delete(`/api/users/${u.id}`);
      setOk("Usuario eliminado");
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo eliminar");
    }
  };

  const badgeRol = (rol: User["rol"]) => {
    const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";
    if (rol === "ADMIN") return <span className={`${base} bg-rose-100 text-rose-700`}>ADMIN</span>;
    if (rol === "SOPORTE") return <span className={`${base} bg-sky-100 text-sky-700`}>SOPORTE</span>;
    return <span className={`${base} bg-slate-100 text-slate-700`}>PRACTICANTE</span>;
  };

  const badgeEstado = (a: boolean) => {
    const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";
    return a ? (
      <span className={`${base} bg-emerald-100 text-emerald-700`}>Activo</span>
    ) : (
      <span className={`${base} bg-slate-200 text-slate-700`}>Inactivo</span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-5">
      {/* Header + acciones */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Usuarios</h1>
          <p className="text-sm text-slate-600">Administra cuentas, roles y estado de acceso.</p>
        </div>

        {/* Toolbar búsqueda */}
        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="relative flex-1 sm:w-72">
            <input
              ref={searchInputRef}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-slate-400/60"
              placeholder="Buscar por usuario..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load();
                if (e.key === "Escape") {
                  setQ("");
                  setTimeout(() => searchInputRef.current?.blur(), 0);
                }
              }}
            />
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4a6 6 0 014.472 9.994l4.267 4.267-1.414 1.414-4.267-4.267A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            </span>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner /> Buscando…
              </>
            ) : (
              "Buscar"
            )}
          </button>
          <button
            onClick={() => {
              setQ("");
              load();
            }}
            className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            disabled={loading}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* feedback */}
      {msg && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{msg}</div>}
      {ok && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}

      {/* Crear usuario (card plegable) */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-medium">Crear usuario</div>
          <button
            className="text-sm text-slate-600 hover:text-slate-900"
            onClick={() => setOpenCreate((v) => !v)}
          >
            {openCreate ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {openCreate && (
          <form onSubmit={onCreate} className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-sm text-slate-600">Usuario</div>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="ej. jdoe"
                  autoComplete="off"
                />
              </div>
              <div>
                <div className="text-sm text-slate-600">Contraseña</div>
                <input
                  type="password"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <div className="text-sm text-slate-600">Rol</div>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as User["rol"] })}
                >
                  <option value="PRACTICANTE">PRACTICANTE</option>
                  <option value="SOPORTE">USUARIO</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <div className="text-sm text-slate-600">Área ID</div>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={form.area_id || ""}
                  onChange={(e) => setForm({ ...form, area_id: Number(e.target.value) })}
                  placeholder="p. ej. 1"
                  min={0}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Crear usuario
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tabla */}
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75 border-b">
              <tr className="text-left text-slate-600">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Usuario</th>
                <th className="py-2.5 px-3">Rol</th>
                <th className="py-2.5 px-3">Área</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Último login</th>
                <th className="py-2.5 px-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b">
                      <td className="py-2 px-3"><SkBar w="w-10" /></td>
                      <td className="py-2 px-3"><SkBar w="w-32" /></td>
                      <td className="py-2 px-3"><SkBar w="w-20" /></td>
                      <td className="py-2 px-3"><SkBar w="w-12" /></td>
                      <td className="py-2 px-3"><SkBar w="w-16" /></td>
                      <td className="py-2 px-3"><SkBar w="w-24" /></td>
                      <td className="py-2 px-3"><SkBar w="w-48" /></td>
                    </tr>
                  ))}
                </>
              )}

              {filtered.map((u) => (
                <tr key={u.id} className="border-b last:border-b-0">
                  <td className="py-2.5 px-3 whitespace-nowrap">{u.id}</td>
                  <td className="py-2.5 px-3 break-all">
                    <div className="font-medium text-slate-800">{u.username}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    {editId === u.id ? (
                      <select
                        className="w-40 rounded-lg border border-slate-300 px-2 py-1"
                        value={edit.rol ?? u.rol}
                        onChange={(e) => setEdit({ ...edit, rol: e.target.value as User["rol"] })}
                      >
                        <option value="PRACTICANTE">PRACTICANTE</option>
                        <option value="SOPORTE">SOPORTE</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    ) : (
                      badgeRol(u.rol)
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {editId === u.id ? (
                      <input
                        type="number"
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                        value={(edit.area_id ?? u.area_id) as number}
                        onChange={(e) => setEdit({ ...edit, area_id: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="font-medium text-slate-700">{u.area_id}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {editId === u.id ? (
                      <select
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1"
                        value={String(edit.activo ?? u.activo)}
                        onChange={(e) => setEdit({ ...edit, activo: e.target.value === "true" })}
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    ) : (
                      badgeEstado(u.activo)
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString() : "-"}
                  </td>
                  <td className="py-2.5 px-3">
                    {editId === u.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="password"
                          placeholder="Nueva clave (opcional)"
                          className="w-48 rounded-lg border border-slate-300 px-2 py-1"
                          value={edit.password ?? ""}
                          onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                        />
                        <button
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-white text-sm hover:bg-slate-800"
                          onClick={() => saveEdit(u.id)}
                        >
                          Guardar
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                          onClick={cancelEdit}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                          onClick={() => startEdit(u)}
                          title="Editar rol/área/estado"
                        >
                          Editar
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                          onClick={() => toggleActivo(u)}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                          onClick={() => resetPwd(u)}
                          title="Cambiar contraseña"
                        >
                          Cambiar clave
                        </button>
                        <button
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                          onClick={() => del(u)}
                          title="Eliminar usuario"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- helpers visuales ---- */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
function SkBar({ w = "w-24" }: { w?: string }) {
  return <div className={`h-3 ${w} rounded bg-slate-200/70 animate-pulse`} />;
}
