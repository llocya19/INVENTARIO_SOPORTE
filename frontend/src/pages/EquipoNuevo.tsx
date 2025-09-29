import { useEffect, useMemo, useState } from "react";
import http from "../api/http";
import { useNavigate, useParams } from "react-router-dom";

/* ---------- Tipos ---------- */
type Clase = "COMPONENTE" | "PERIFERICO";
type ItemType = { id: number; clase: Clase; nombre: string };
type ItemRow = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string;
  created_at?: string | null;
};
type ItemsPage = { items: ItemRow[]; total: number; page: number; size: number };

/* ---------- UI helpers ---------- */
function Drawer(props: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const { open, onClose, children, title } = props;
  return (
    <>
      {/* overlay */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      {/* panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-2xl transition-transform duration-300
        ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">{title || "Seleccionados"}</div>
            <button className="rounded-lg px-3 py-1.5 border" onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </>
  );
}

function LocalPager<T>({
  data,
  page,
  size,
  onPage,
  onSize,
}: {
  data: T[];
  page: number;
  size: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(data.length / size));
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div>
        Página {Math.min(page, totalPages)} de {totalPages} · {data.length} ítems
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 rounded-lg border"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ◀
        </button>
        <select
          className="border rounded-lg px-2 py-1.5"
          value={size}
          onChange={(e) => {
            onPage(1);
            onSize(Number(e.target.value));
          }}
        >
          {[5, 10, 20, 50].map((s) => (
            <option key={s} value={s}>
              {s} / pág
            </option>
          ))}
        </select>
        <button
          className="px-3 py-1.5 rounded-lg border"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

/* ---------- Página ---------- */
export default function EquipoNuevo() {
  const { areaId } = useParams();
  const aid = Number(areaId);
  const nav = useNavigate();

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    estado: "ALMACEN",
    usuario_final: "",
    login: "",
    password: "",
  });

  // tipos para filtros
  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);

  // filtros + paginación servidor
  const [filtC, setFiltC] = useState<{ tipo: string; q: string }>({ tipo: "", q: "" });
  const [filtP, setFiltP] = useState<{ tipo: string; q: string }>({ tipo: "", q: "" });
  const [pageC, setPageC] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });
  const [pageP, setPageP] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });

  // selección
  const [selComp, setSelComp] = useState<ItemRow[]>([]);
  const [selPeri, setSelPeri] = useState<ItemRow[]>([]);

  // drawer de seleccionados
  const [openDrawer, setOpenDrawer] = useState(false);
  const [spage, setSpage] = useState(1);
  const [ssize, setSsize] = useState(10);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function loadTypes() {
    const [c, p] = await Promise.all([
      http.get<ItemType[]>("/api/item-types?clase=COMPONENTE"),
      http.get<ItemType[]>("/api/item-types?clase=PERIFERICO"),
    ]);
    setTypesC(c.data || []);
    setTypesP(p.data || []);
  }

  async function loadDisponibles(clase: Clase, page = 1, size = 10) {
    const f = clase === "COMPONENTE" ? filtC : filtP;
    const params: any = { clase, page, size };
    if (f.tipo) params.tipo = f.tipo;
    if (f.q) params.q = f.q;
    const r = await http.get<ItemsPage>(`/api/areas/${aid}/items-disponibles`, { params });
    if (clase === "COMPONENTE") setPageC(r.data);
    else setPageP(r.data);
  }

  // Sugerir código por área al montar / cambiar área
  useEffect(() => {
    (async () => {
      try {
        const r = await http.get<{ next_code: string }>(`/api/areas/${aid}/equipos/next-code`, {
          params: { prefix: "PC-", pad: 3 },
        });
        if (r.data?.next_code && !form.codigo) {
          setForm((f) => ({ ...f, codigo: r.data.next_code }));
        }
      } catch {
        // si falla, se deja vacío y el usuario puede escribir a mano
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aid]);

  useEffect(() => {
    loadTypes();
    loadDisponibles("COMPONENTE", 1, pageC.size);
    loadDisponibles("PERIFERICO", 1, pageP.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aid]);

  const compLeft = useMemo(
    () => pageC.items.filter((i) => !selComp.some((s) => s.item_id === i.item_id)),
    [pageC.items, selComp]
  );
  const periLeft = useMemo(
    () => pageP.items.filter((i) => !selPeri.some((s) => s.item_id === i.item_id)),
    [pageP.items, selPeri]
  );

  const totalSelected = selComp.length + selPeri.length;

  async function crearEquipo() {
    setMsg(null);
    setOk(null);
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setMsg("Código y nombre son requeridos");
      return;
    }
    const items = [
      ...selComp.map((r) => ({ item_id: r.item_id, slot: null })),
      ...selPeri.map((r) => ({ item_id: r.item_id, slot: null })),
    ];

    async function postOnce(payload: typeof form) {
      return http.post<{ equipo_id: number }>(`/api/areas/${aid}/equipos`, {
        ...payload,
        items,
      });
    }

    try {
      const r = await postOnce(form);
      setOk("Equipo creado");
      nav(`/equipos/${r.data.equipo_id}`);
    } catch (e: any) {
      const txt = e?.response?.data?.error || "";
      const isDup = /duplicad.|llave duplicada|duplicate/i.test(txt);
      if (isDup) {
        try {
          const sug = await http.get<{ next_code: string }>(`/api/areas/${aid}/equipos/next-code`, {
            params: { prefix: "PC-", pad: 3 },
          });
          const next_code = sug.data?.next_code;
          if (next_code) {
            const r2 = await postOnce({ ...form, codigo: next_code });
            setOk("Equipo creado");
            nav(`/equipos/${r2.data.equipo_id}`);
            return;
          }
        } catch {
          // ignore
        }
      }
      setMsg(txt || "No se pudo crear");
    }
  }

  /* ---------- UI ---------- */
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xl font-semibold">Nuevo equipo (desde ALMACÉN)</div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Seleccionados: </span>
          <button
            className="px-3 py-1.5 rounded-full bg-slate-900 text-white"
            onClick={() => setOpenDrawer(true)}
          >
            {totalSelected}
          </button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{msg}</div>}
      {ok && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Meta equipo */}
      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-slate-600">Código</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="Ej. PC-001"
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Nombre</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre visible"
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Estado</div>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
            >
              <option value="ALMACEN">ALMACEN</option>
              <option value="USO">USO</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
              <option value="BAJA">BAJA</option>
            </select>
          </div>
          <div>
            <div className="text-sm text-slate-600">Usuario final</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.usuario_final}
              onChange={(e) => setForm({ ...form, usuario_final: e.target.value })}
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Login</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
            />
          </div>
          <div>
            <div className="text-sm text-slate-600">Password</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Lista de disponibles - Componentes */}
      <SelectorLista
        title="Componentes disponibles"
        page={pageC}
        types={typesC}
        filter={filtC}
        onFilter={setFiltC}
        rows={compLeft}
        onApply={(p, s) => loadDisponibles("COMPONENTE", p, s)}
        onAdd={(row) => setSelComp((v) => [...v, row])}
      />

      {/* Lista de disponibles - Periféricos */}
      <SelectorLista
        title="Periféricos disponibles"
        page={pageP}
        types={typesP}
        filter={filtP}
        onFilter={setFiltP}
        rows={periLeft}
        onApply={(p, s) => loadDisponibles("PERIFERICO", p, s)}
        onAdd={(row) => setSelPeri((v) => [...v, row])}
      />

      <div className="flex justify-end">
        <button
          className="px-4 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50"
          onClick={crearEquipo}
          disabled={totalSelected === 0 || !form.codigo.trim() || !form.nombre.trim()}
        >
          Crear equipo
        </button>
      </div>

      {/* Drawer de seleccionados */}
      <Drawer open={openDrawer} onClose={() => setOpenDrawer(false)} title="Ítems seleccionados">
        <div className="p-4 space-y-3">
          <LocalPager
            data={[...selComp, ...selPeri]}
            page={spage}
            size={ssize}
            onPage={setSpage}
            onSize={setSsize}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-slate-50">
                <tr className="text-left text-sm text-slate-600">
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Clase</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...selComp, ...selPeri]
                  .slice((spage - 1) * ssize, spage * ssize)
                  .map((r) => (
                    <tr key={`s-${r.item_id}`} className="border-t">
                      <td className="px-3 py-2">{r.item_codigo}</td>
                      <td className="px-3 py-2">{r.clase}</td>
                      <td className="px-3 py-2">{r.tipo}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="px-3 py-1.5 rounded-lg border"
                          onClick={() => {
                            if (r.clase === "COMPONENTE")
                              setSelComp((v) => v.filter((x) => x.item_id !== r.item_id));
                            else setSelPeri((v) => v.filter((x) => x.item_id !== r.item_id));
                          }}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                {totalSelected === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-slate-500" colSpan={4}>
                      Sin seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

/* ---------- SelectorLista ---------- */
function SelectorLista(props: {
  title: string;
  page: ItemsPage;
  types: ItemType[];
  filter: { tipo: string; q: string };
  onFilter: (f: { tipo: string; q: string }) => void;
  rows: ItemRow[];
  onApply: (p: number, s: number) => void;
  onAdd: (row: ItemRow) => void;
}) {
  const { title, page, types, filter, onFilter, rows, onApply, onAdd } = props;
  const totalPages = Math.max(1, Math.ceil(page.total / page.size));

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <div className="text-lg font-semibold">{title}</div>

      <div className="grid sm:grid-cols-3 gap-2">
        <div>
          <div className="text-sm text-slate-600">Tipo</div>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={filter.tipo}
            onChange={(e) => onFilter({ ...filter, tipo: e.target.value })}
          >
            <option value="">(Todos)</option>
            {types.map((t) => (
              <option key={t.id} value={t.nombre}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-sm text-slate-600">Buscar código</div>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={filter.q}
            onChange={(e) => onFilter({ ...filter, q: e.target.value })}
          />
        </div>
        <div className="flex items-end gap-2">
          <button className="px-3 py-2 rounded-lg border" onClick={() => onApply(1, page.size)}>
            Aplicar
          </button>
          <button
            className="px-3 py-2 rounded-lg border"
            onClick={() => {
              onFilter({ tipo: "", q: "" });
              onApply(1, page.size);
            }}
          >
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
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item_id} className="border-t">
                <td className="px-3 py-2">{r.item_codigo}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2">{r.estado}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white"
                    onClick={() => onAdd(r)}
                  >
                    Agregar
                  </button>
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

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Página {page.page} de {totalPages} · {page.total} ítems
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-lg border"
            disabled={page.page <= 1}
            onClick={() => onApply(page.page - 1, page.size)}
          >
            ◀
          </button>
          <select
            className="border rounded-lg px-2 py-1.5"
            value={page.size}
            onChange={(e) => onApply(1, Number(e.target.value))}
          >
            {[10, 20, 50].map((s) => (
              <option key={s} value={s}>
                {s} / pág
              </option>
            ))}
          </select>
          <button
            className="px-3 py-1.5 rounded-lg border"
            disabled={page.page >= totalPages}
            onClick={() => onApply(page.page + 1, page.size)}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
