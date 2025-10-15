// src/pages/IncidenciasAdmin.tsx
import { useEffect, useMemo, useState } from "react";
import {
  listarIncidencias,
  obtenerIncidencia,
  asignarPracticante,
  cambiarEstado,
  agregarMensaje,
  type Incidencia,
} from "../api/incidencias";
import http from "../api/http";

/* =========================
   Estilos reutilizables
========================= */
const card = "bg-white rounded-2xl shadow-sm ring-1 ring-slate-200";
const pad = "p-4 md:p-5";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition";
const selectBase = fieldBase + " pr-8";
const btnBase =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 active:bg-slate-100 transition";
const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm shadow-sm hover:bg-emerald-500 active:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed";

/* =========================
   UI helpers
========================= */
function BadgeEstado({ value }: { value?: string }) {
  const v = (value || "").toUpperCase();
  const map: Record<string, string> = {
    ABIERTA: "bg-rose-100 text-rose-700",
    EN_PROCESO: "bg-amber-100 text-amber-800",
    CERRADA: "bg-emerald-100 text-emerald-700",
  };
  const cls = map[v] || "bg-slate-100 text-slate-700";
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{v || "—"}</span>;
}

/* =========================
   Página
========================= */
type Pract = { id: number; username: string };

export default function IncidenciasAdmin() {
  const [estado, setEstado] = useState<string>("ABIERTA");
  const [areaId, setAreaId] = useState<number | undefined>();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [size] = useState(10);

  const [rows, setRows] = useState<Incidencia[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // detalle modal
  const [show, setShow] = useState(false);
  const [sel, setSel] = useState<(Incidencia & { mensajes: any[] }) | null>(null);

  // practicantes
  const [practs, setPracts] = useState<Pract[]>([]);
  const [assignId, setAssignId] = useState<number | "">("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await listarIncidencias({ estado, area_id: areaId, q, page, size });
      setRows(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }

  async function loadPracts() {
    try {
      const r = await http.get<{ items: Pract[] }>("/api/users", { params: { rol: "PRACTICANTE" } });
      setPracts(r.data.items || r.data || []);
    } catch {
      /* no-op */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, areaId, q, page]);

  useEffect(() => {
    loadPracts();
  }, []);

  async function openDetail(id: number) {
    setMsg(null);
    try {
      const d = await obtenerIncidencia(id);
      setSel(d as any);
      setAssignId("");
      setShow(true);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo abrir el detalle");
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl md:text-2xl font-semibold">Incidencias</h2>
        <button className={btnBase + " w-full sm:w-auto"} onClick={load} disabled={loading}>
          {loading ? "Actualizando…" : "Refrescar"}
        </button>
      </div>

      {/* Filtros */}
      <div className={`${card} ${pad}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-sm text-slate-600 mb-1">Estado</div>
            <select
              value={estado}
              onChange={(e) => {
                setPage(1);
                setEstado(e.target.value);
              }}
              className={selectBase}
            >
              <option value="ABIERTA">ABIERTA</option>
              <option value="EN_PROCESO">EN_PROCESO</option>
              <option value="CERRADA">CERRADA</option>
              <option value="">— Todos —</option>
            </select>
          </div>

          <div>
            <div className="text-sm text-slate-600 mb-1">Área (ID)</div>
            <input
              className={fieldBase}
              placeholder="Ej. 9"
              value={areaId ?? ""}
              onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : undefined)}
              inputMode="numeric"
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-sm text-slate-600 mb-1">Buscar</div>
            <div className="flex items-center gap-2">
              <input
                className={fieldBase + " flex-1"}
                placeholder="código equipo, título, usuario…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
              <button className={btnPrimary + " shrink-0"} onClick={load}>
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje global */}
      {msg && (
        <div className="p-3 rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
          {msg}
        </div>
      )}

      {/* Listado */}
      <div className={card}>
        <div className="px-4 py-2 border-b text-sm text-slate-600 flex items-center justify-between">
          <span>Total: {total}</span>
          <span className="text-xs text-slate-500">Página {page} / {totalPages}</span>
        </div>

        <div className="divide-y">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-slate-500">Sin resultados</div>
          ) : (
            rows.map((r) => (
              <div key={r.inc_id} className="p-3 md:p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{r.titulo}</div>
                    <BadgeEstado value={r.estado} />
                  </div>
                  <div className="text-sm text-slate-600 truncate">
                    <span className="font-mono">#{r.inc_id}</span> · {r.area_nombre || "—"} ·{" "}
                    {r.equipo_codigo || "sin equipo"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={btnPrimary} onClick={() => openDetail(r.inc_id)}>
                    Ver
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* paginación */}
        {totalPages > 1 && (
          <div className="px-3 md:px-4 py-3 border-t flex items-center justify-between text-sm">
            <span>Página {page} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                className={`${btnBase} disabled:opacity-50`}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ◀
              </button>
              <button
                disabled={page >= totalPages}
                className={`${btnBase} disabled:opacity-50`}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {show && sel && (
        <IncidenciaDetail
          inc={sel}
          practs={practs}
          assignId={assignId}
          onAssignId={setAssignId}
          onClose={() => setShow(false)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

/* =========================
   Detalle (modal)
========================= */
function IncidenciaDetail({
  inc,
  practs,
  assignId,
  onAssignId,
  onClose,
  onRefresh,
}: {
  inc: Incidencia & { mensajes: any[] };
  practs: { id: number; username: string }[];
  assignId: number | "";
  onAssignId: (v: any) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function doAssign() {
    if (!assignId) return;
    setMsg(null);
    try {
      await asignarPracticante(inc.inc_id, String(assignId));
      await onRefresh();
      setMsg("Asignado");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo asignar");
    }
  }

  async function setEstado(e: Incidencia["estado"]) {
    setMsg(null);
    try {
      await cambiarEstado(inc.inc_id, e);
      await onRefresh();
      setMsg("Estado actualizado");
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo cambiar estado");
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setMsg(null);
    try {
      await agregarMensaje(inc.inc_id, note.trim());
      setNote("");
      await onRefresh();
      setMsg("Mensaje agregado");
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo agregar mensaje");
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Dialog */}
      <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-[760px]">
        <div className={`${card} overflow-hidden mx-3 sm:mx-0`}>
          {/* Header sticky */}
          <div className="px-4 py-3 border-b bg-white flex items-center justify-between sticky top-0">
            <div className="font-semibold">
              Incidencia <span className="font-mono">#{inc.inc_id}</span>
            </div>
            <button className={btnBase} onClick={onClose}>Cerrar</button>
          </div>

          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {msg && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                {msg}
              </div>
            )}

            {/* Encabezado */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-lg font-medium">{inc.titulo}</div>
                <BadgeEstado value={inc.estado} />
              </div>
              <div className="text-sm text-slate-600">{inc.descripcion}</div>
              <div className="text-xs text-slate-500">
                {inc.area_nombre || "—"} · {inc.equipo_codigo || "sin equipo"}
              </div>
            </div>

            {/* Acciones superiores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Asignación */}
              <div className="rounded-xl ring-1 ring-slate-200 p-3">
                <div className="text-sm text-slate-600 mb-1">Asignar a practicante</div>
                <div className="flex items-center gap-2">
                  <select
                    className={selectBase}
                    value={assignId}
                    onChange={(e) => onAssignId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">— Seleccione —</option>
                    {practs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.username}
                      </option>
                    ))}
                  </select>
                  <button className={btnPrimary} onClick={doAssign}>
                    Asignar
                  </button>
                </div>
              </div>

              {/* Cambiar estado */}
              <div className="rounded-xl ring-1 ring-slate-200 p-3">
                <div className="text-sm text-slate-600 mb-1">Estado</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setEstado("ABIERTA")} className={btnBase}>ABIERTA</button>
                  <button onClick={() => setEstado("EN_PROCESO")} className={btnBase}>EN_PROCESO</button>
                  <button onClick={() => setEstado("CERRADA")} className={btnBase}>CERRADA</button>
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <div>
              <div className="text-sm font-medium mb-2">Mensajes</div>
              <div className="space-y-2 max-h-60 overflow-auto pr-1">
                {inc.mensajes?.length ? (
                  inc.mensajes.map((m, i) => (
                    <div key={i} className="text-sm p-2 rounded-lg bg-slate-50 ring-1 ring-slate-200">
                      <div className="text-slate-700 whitespace-pre-wrap break-words">{m.mensaje}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {m.usuario} · {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-sm">Sin mensajes</div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  className={fieldBase + " flex-1"}
                  placeholder="Añadir mensaje interno…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button className={btnPrimary} onClick={addNote}>
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Separación inferior en móvil para no pegar al borde */}
        <div className="h-3 sm:hidden" />
      </div>
    </div>
  );
}
