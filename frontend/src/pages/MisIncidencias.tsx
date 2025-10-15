// src/pages/MisIncidencias.tsx
import { useEffect, useMemo, useState } from "react";
import {
  listarMisIncidencias,
  crearIncidencia,
  agregarMensaje,
  obtenerIncidencia,
  type Incidencia,
} from "../api/incidencias";

/* =========================
   UI helpers (tema)
========================= */
const BG_APP = "bg-[#FFFDF8]";
const TEXT = "text-slate-800";
const MUTED = "text-slate-600";

const section = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const baseText = "leading-relaxed tracking-[0.01em]";
const focusRing =
  "focus:outline-none focus:ring-2 focus:ring-emerald-300/40 focus:border-emerald-300/60";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] placeholder-slate-400 " +
  TEXT +
  " " +
  focusRing +
  " transition";

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "subtle" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] transition min-h-[40px]";
  const map = {
    primary:
      "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed",
    secondary:
      "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50",
    subtle:
      "bg-white/60 border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-50",
    danger:
      "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50",
  };
  return (
    <button className={`${base} ${map[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "sky" | "violet" | "amber" | "emerald" | "rose";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    sky: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-800",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${map[tone]}`}>{children}</span>
  );
}

function SkBar({ w = "w-full" }: { w?: string }) {
  return <div className={`h-3 ${w} rounded bg-slate-200/70 animate-pulse`} />;
}

function estadoTone(e: string | null | undefined): Parameters<typeof Badge>[0]["tone"] {
  if (!e) return "slate";
  const up = e.toUpperCase();
  if (up.includes("ABIERTA") || up.includes("NUEVA") || up.includes("PEND")) return "amber";
  if (up.includes("EN") || up.includes("PROCESO")) return "sky";
  if (up.includes("RESUEL") || up.includes("CERR")) return "emerald";
  if (up.includes("CANCEL")) return "rose";
  return "slate";
}

/* =========================
   Página
========================= */
export default function MisIncidencias() {
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [rows, setRows] = useState<Incidencia[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // form nueva
  const [showNew, setShowNew] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [equipoId, setEquipoId] = useState<number | "">("");
  const [email, setEmail] = useState("");

  // detalle
  const [sel, setSel] = useState<(Incidencia & { mensajes: any[] }) | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      const data = await listarMisIncidencias({ page, size });
      setRows(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar tus incidencias.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function crear() {
    if (!titulo.trim() || !desc.trim()) {
      setMsg("Completa título y descripción.");
      return;
    }
    setMsg(null);
    try {
      await crearIncidencia({
        titulo: titulo.trim(),
        descripcion: desc.trim(),
        equipo_id: equipoId ? Number(equipoId) : undefined,
        email: email.trim() || undefined,
      });
      setShowNew(false);
      setTitulo("");
      setDesc("");
      setEquipoId("");
      setEmail("");
      await load();
      setMsg("Incidencia creada correctamente.");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo crear la incidencia.");
    }
  }

  async function open(id: number) {
    const d = await obtenerIncidencia(id);
    setSel(d as any);
    setNote("");
  }

  async function addNote() {
    if (!sel || !note.trim()) return;
    try {
      setSending(true);
      await agregarMensaje(sel.inc_id, note.trim());
      setNote("");
      await open(sel.inc_id);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div className={`${section} px-4 py-4 md:px-6 md:py-5 ${baseText}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[22px] md:text-[26px] font-semibold">Mis incidencias</h2>
              <p className={MUTED + " text-sm"}>Crea nuevas incidencias y conversa con Soporte.</p>
            </div>
            <Button onClick={() => setShowNew(true)}>+ Nueva</Button>
          </div>
        </div>

        {/* feedback */}
        {msg && <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">{msg}</div>}

        {/* Lista */}
        <div className={section}>
          <div className="divide-y">
            {loading ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`sk-${i}`} className="p-4 space-y-2">
                    <SkBar w="w-1/3" />
                    <SkBar w="w-2/3" />
                  </div>
                ))}
              </>
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-slate-500">Aún no tienes incidencias.</div>
            ) : (
              rows.map((r) => (
                <div key={r.inc_id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{r.titulo}</div>
                      <Badge tone={estadoTone(r.estado)}>{r.estado || "—"}</Badge>
                    </div>
                    <div className="text-sm text-slate-600 truncate">
                      #{r.inc_id} · {r.equipo_codigo || "sin equipo"}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => open(r.inc_id)}>
                    Ver
                  </Button>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-3 border-t flex items-center justify-between text-sm">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  «
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: nueva incidencia */}
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowNew(false)} />
            <div className={`${section} relative w-full max-w-lg`}>
              <div className="px-4 py-3 border-b border-slate-200 font-semibold">Nueva incidencia</div>
              <div className="p-4 md:p-5 space-y-3">
                <div>
                  <div className={MUTED + " text-sm mb-1"}>Título</div>
                  <input className={fieldBase} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </div>
                <div>
                  <div className={MUTED + " text-sm mb-1"}>Descripción</div>
                  <textarea className={fieldBase} rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <div>
                  <div className={MUTED + " text-sm mb-1"}>Correo de contacto (Gmail)</div>
                  <input
                    type="email"
                    placeholder="tucorreo@gmail.com"
                    className={fieldBase}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className={MUTED + " text-sm mb-1"}>Equipo (opcional, id)</div>
                  <input
                    className={fieldBase}
                    value={equipoId}
                    onChange={(e) => setEquipoId(e.target.value ? Number(e.target.value) : "")}
                  />
                </div>
              </div>
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowNew(false)}>
                  Cancelar
                </Button>
                <Button onClick={crear}>Crear</Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: detalle + chat */}
        {sel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => setSel(null)} />
            <div className={`${section} relative w-full max-w-3xl overflow-hidden`}>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">Incidencia #{sel.inc_id}</div>
                  <Badge tone={estadoTone(sel.estado)}>{sel.estado || "—"}</Badge>
                </div>
                <Button variant="secondary" onClick={() => setSel(null)}>
                  Cerrar
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-4 p-4 md:p-5">
                {/* Resumen */}
                <div className="md:col-span-1 space-y-2">
                  <div>
                    <div className={MUTED + " text-xs"}>Título</div>
                    <div className="font-medium">{sel.titulo}</div>
                  </div>
                  <div>
                    <div className={MUTED + " text-xs"}>Descripción</div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{sel.descripcion}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Equipo: <span className="font-medium">{sel.equipo_codigo || "sin equipo"}</span>
                  </div>
                </div>

                {/* Mensajes (chat) */}
                <div className="md:col-span-2">
                  <div className="text-sm font-medium mb-2">Mensajes</div>

                  {/* Lista con scroll suave */}
                  <div className="space-y-2 h-72 md:h-80 overflow-auto pr-1 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                    {sel.mensajes?.length ? (
                      sel.mensajes.map((m: any, i: number) => (
                        <div key={i} className="text-sm p-2 rounded-lg bg-white ring-1 ring-slate-200">
                          <div className="text-slate-700">{m.mensaje}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {m.usuario} · {new Date(m.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 text-sm p-2">Sin mensajes</div>
                    )}
                  </div>

                  {/* Composer pegado abajo y responsive */}
                  <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      className={fieldBase + " flex-1"}
                      placeholder="Escribe un mensaje…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addNote()}
                    />
                    <Button onClick={addNote} disabled={sending}>
                      {sending ? "Enviando…" : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
