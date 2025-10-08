// src/pages/Auditorias.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../api/http";
import type { JSX } from "react/jsx-runtime";

/* =========================
   Types
========================= */
type MovRow = {
  mov_id: number;
  mov_item_id: number | null;
  item_codigo: string | null;
  clase: "COMPONENTE" | "PERIFERICO" | null;
  item_tipo: string | null;
  mov_tipo: string;
  mov_fecha: string; // ISO
  mov_origen_area_id: number | null;
  origen_area_nombre: string | null;
  mov_destino_area_id: number | null;
  destino_area_nombre: string | null;
  mov_equipo_id: number | null;
  equipo_codigo: string | null;
  equipo_nombre: string | null;
  mov_usuario_app: string | null;
  mov_motivo: string | null;
  mov_detalle: any; // json
  es_audit?: boolean;
};
type MovPage = { items: MovRow[]; total: number; page: number; size: number };
type Fuente = "mov" | "audit" | "both";

/* =========================
   UI helpers
========================= */
function Icon({
  name,
  className = "h-4 w-4",
}: {
  name:
    | "back"
    | "refresh"
    | "chevL"
    | "chevR"
    | "filter"
    | "x"
    | "search";
  className?: string;
}) {
  const map: Record<string, JSX.Element> = {
    back: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    refresh: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 9a8 8 0 10-1.7 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    chevL: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    chevR: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    filter: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    x: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    search: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  };
  return map[name];
}

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "subtle" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition";
  const map = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed",
    secondary:
      "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-50",
    subtle:
      "bg-white/60 border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50",
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
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${map[tone]}`}>
      {children}
    </span>
  );
}

function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="text-center py-10">
      <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
        —
      </div>
      <div className="font-medium text-slate-700">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

/* =========================
   Page
========================= */
export default function AuditoriasPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState<MovPage>({
    items: [],
    total: 0,
    page: 1,
    size: 20,
  });

  const [fuente, setFuente] = useState<Fuente>("mov");
  const [tipoMov, setTipoMov] = useState<string>("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const [detailOpen, setDetailOpen] = useState<null | MovRow>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((page.total || 0) / (page.size || 20))),
    [page.total, page.size]
  );

  function formatDT(iso?: string | null) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso ?? "-";
    return d.toLocaleString();
  }

  async function load(p = 1, s = page.size) {
    const params: any = { page: p, size: s, fuente };
    if (fuente === "mov" && tipoMov) params.tipo = tipoMov;
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    if (q) params.q = q;

    const r = await http.get<MovPage>("/api/movimientos", { params });
    setPage({
      items: r.data.items || [],
      total: Number(r.data.total || 0),
      page: Number(r.data.page || p),
      size: Number(r.data.size || s),
    });
  }

  // Rango rápido
  function setRango(days: number) {
    const now = new Date();
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - (days - 1));
    const toISODate = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`;
    setDesde(toISODate(start));
    setHasta(toISODate(end));
  }

  function limpiar() {
    setTipoMov("");
    setDesde("");
    setHasta("");
    setQ("");
  }

  useEffect(() => {
    load(1, page.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente]);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* App bar */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="secondary"
              onClick={() =>
                window.history.length > 1 ? navigate(-1) : navigate("/")
              }
              title="Volver"
            >
              <Icon name="back" /> Atrás
            </Button>
            <div>
              <div className="text-2xl font-semibold tracking-tight">
                Auditoría
              </div>
              <div className="text-sm text-slate-500">
                Movimientos de ítems y cambios de equipos, con entradas de MOV y AUDIT.
              </div>
            </div>
          </div>
          <div>
            <Button
              variant="secondary"
              onClick={() => load(page.page, page.size)}
              title="Recargar"
            >
              <Icon name="refresh" /> Recargar
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-600">
          <Icon name="filter" />
          <span className="text-sm font-medium">Filtros</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Fuente - segmented */}
          <div className="lg:col-span-4">
            <div className="text-sm text-slate-600 mb-1">Fuente</div>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
              <button
                onClick={() => setFuente("both")}
                className={`px-3 py-2 text-sm ${
                  fuente === "both" ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                }`}
              >
                Mov + Audit
              </button>
              <button
                onClick={() => setFuente("mov")}
                className={`px-3 py-2 text-sm ${
                  fuente === "mov" ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                }`}
              >
                Solo Mov
              </button>
              <button
                onClick={() => setFuente("audit")}
                className={`px-3 py-2 text-sm ${
                  fuente === "audit" ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                }`}
              >
                Solo Audit
              </button>
            </div>
          </div>

          {/* Tipo (solo MOV) */}
          <div className="lg:col-span-2">
            <div className="text-sm text-slate-600 mb-1">Tipo (solo MOV)</div>
            <select
              className="w-full rounded-lg border px-3 py-2 bg-white"
              value={tipoMov}
              onChange={(e) => setTipoMov(e.target.value)}
              disabled={fuente !== "mov"}
            >
              <option value="">(Todos)</option>
              <option value="ASIGNACION">ASIGNACION</option>
              <option value="RETIRO">RETIRO</option>
              <option value="ENTRADA">ENTRADA</option>
              <option value="TRASLADO">TRASLADO</option>
              <option value="BAJA">BAJA</option>
              <option value="REPARACION">REPARACION</option>
              <option value="RETORNO">RETORNO</option>
              <option value="EQUIPO_ESTADO">EQUIPO_ESTADO</option>
              <option value="EQUIPO_USUARIO_FINAL">EQUIPO_USUARIO_FINAL</option>
            </select>
          </div>

          {/* Desde / Hasta */}
          <div className="lg:col-span-2">
            <div className="text-sm text-slate-600 mb-1">Desde</div>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2 bg-white"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="lg:col-span-2">
            <div className="text-sm text-slate-600 mb-1">Hasta</div>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2 bg-white"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>

          {/* Buscar */}
          <div className="lg:col-span-2">
            <div className="text-sm text-slate-600 mb-1">Buscar</div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon name="search" />
              </span>
              <input
                className="w-full rounded-lg border pl-9 pr-3 py-2 bg-white"
                placeholder="item/equipo/usuario/motivo o JSON"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load(1, page.size)}
              />
              {q && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setQ("")}
                  type="button"
                  title="Limpiar"
                >
                  <Icon name="x" />
                </button>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="lg:col-span-12 flex flex-wrap gap-2 justify-between items-end mt-1">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setRango(1)}>Hoy</Button>
              <Button variant="secondary" onClick={() => setRango(7)}>Últimos 7 días</Button>
              <Button variant="secondary" onClick={() => setRango(30)}>Últimos 30 días</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => load(1, page.size)}>Aplicar</Button>
              <Button
                variant="subtle"
                onClick={() => {
                  limpiar();
                  load(1, page.size);
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50 text-[13px] text-slate-600 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Fecha</th>
              <th className="px-3 py-2 text-left font-medium">Tipo</th>
              <th className="px-3 py-2 text-left font-medium">Item (id)</th>
              <th className="px-3 py-2 text-left font-medium">Clase/Tipo</th>
              <th className="px-3 py-2 text-left font-medium">Equipo (id)</th>
              <th className="px-3 py-2 text-left font-medium">Origen → Destino</th>
              <th className="px-3 py-2 text-left font-medium">Usuario</th>
              <th className="px-3 py-2 text-left font-medium">Motivo</th>
              <th className="px-3 py-2 text-left font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((r, i) => {
              const esAudit = !!r.es_audit;
              return (
                <tr
                  key={`${r.mov_id}-${esAudit ? "A" : "M"}`}
                  className={`border-t align-top ${i % 2 ? "bg-slate-50/40" : ""} hover:bg-slate-50/80`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">{formatDT(r.mov_fecha)}</td>

                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.mov_tipo}</span>
                      {esAudit ? (
                        <Badge tone="violet">AUDIT</Badge>
                      ) : (
                        <Badge tone="sky">MOV</Badge>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <span className="font-mono text-[13px]">{r.item_codigo || "-"}</span>
                    {r.mov_item_id ? (
                      <span className="text-slate-400"> · #{r.mov_item_id}</span>
                    ) : null}
                  </td>

                  <td className="px-3 py-2">
                    {r.clase || "-"} {r.item_tipo ? <span className="text-slate-500">· {r.item_tipo}</span> : ""}
                  </td>

                  <td className="px-3 py-2">
                    <span className="font-mono text-[13px]">{r.equipo_codigo || "-"}</span>
                    {r.mov_equipo_id ? (
                      <span className="text-slate-400"> · #{r.mov_equipo_id}</span>
                    ) : null}
                    {r.equipo_nombre ? (
                      <div className="text-xs text-slate-500">{r.equipo_nombre}</div>
                    ) : null}
                  </td>

                  <td className="px-3 py-2">
                    <div className="text-sm">
                      {(r.origen_area_nombre || "-") +
                        (r.mov_origen_area_id ? ` (#${r.mov_origen_area_id})` : "")}
                      {"  →  "}
                      {(r.destino_area_nombre || "-") +
                        (r.mov_destino_area_id ? ` (#${r.mov_destino_area_id})` : "")}
                    </div>
                  </td>

                  <td className="px-3 py-2">{r.mov_usuario_app || "-"}</td>
                  <td className="px-3 py-2">{r.mov_motivo || "—"}</td>

                  <td className="px-3 py-2">
                    {r.mov_detalle ? (
                      <div className="flex items-start gap-2">
                        <pre className="text-xs bg-slate-50 rounded p-2 max-w-xs overflow-auto">
                          {JSON.stringify(r.mov_detalle, null, 2)}
                        </pre>
                        <Button
                          variant="secondary"
                          className="text-xs"
                          onClick={() => setDetailOpen(r)}
                        >
                          ver…
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {page.items.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title="Sin registros"
                    hint="Ajusta filtros, rango de fechas o prueba otra fuente."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Paginación */}
        <TablePager
          total={page.total}
          page={page.page}
          size={page.size}
          totalPages={totalPages}
          onPage={(p) => load(p, page.size)}
          onSize={(s) => load(1, s)}
        />
      </div>

      {/* Modal Detalle */}
      {detailOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow max-w-3xl w-full overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-semibold">
                Detalle #{detailOpen.mov_id}{" "}
                {detailOpen.es_audit ? (
                  <Badge tone="violet" >AUDIT</Badge>
                ) : (
                  <Badge tone="sky">MOV</Badge>
                )}
              </div>
              <Button variant="secondary" onClick={() => setDetailOpen(null)}>Cerrar</Button>
            </div>
            <div className="p-4">
              <pre className="text-xs bg-slate-50 rounded p-3 overflow-auto">
                {JSON.stringify(detailOpen.mov_detalle ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Table Pager
========================= */
function TablePager({
  total,
  page,
  size,
  totalPages,
  onPage,
  onSize,
}: {
  total: number;
  page: number;
  size: number;
  totalPages: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center justify-between p-3 border-t">
      <div className="text-sm text-slate-600">Total: {total.toLocaleString()}</div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon name="chevL" />
        </Button>
        <span className="text-sm">
          Página {page} / {totalPages}
        </span>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <Icon name="chevR" />
        </Button>
        <select
          className="ml-2 rounded-lg border px-2 py-1 text-sm bg-white"
          value={size}
          onChange={(e) => onSize(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / pág
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
