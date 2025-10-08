// src/pages/Dashboard.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import http from "../api/http";

type Counts = {
  areas: number;
  equipos: number;
  componentes: number;
  perifericos: number;
  en_almacen: number;
  en_uso: number;
};

const card =
  "bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 md:p-5 flex items-center justify-between gap-4";
const btnBase =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 active:bg-slate-100 transition";
const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm shadow-sm hover:opacity-95 active:opacity-90 transition";
const kpiTitle = "text-slate-500 text-xs md:text-sm";
const kpiValue = "text-xl md:text-2xl font-semibold tracking-tight";
const kpiSub = "text-[11px] md:text-xs text-slate-500";

function SkeletonCard() {
  return (
    <div className={card + " animate-pulse"}>
      <div className="space-y-2 flex-1">
        <div className="h-3 w-24 bg-slate-200 rounded" />
        <div className="h-6 w-20 bg-slate-200 rounded" />
        <div className="h-3 w-28 bg-slate-200 rounded" />
      </div>
      <div className="h-10 w-10 rounded-lg bg-slate-200" />
    </div>
  );
}

function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mt-2">
      <div
        className="h-full bg-slate-900"
        style={{ width: `${v}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
      />
    </div>
  );
}

function Donut({
  used,
  stored,
  size = 140,
  stroke = 14,
}: {
  used: number;
  stored: number;
  size?: number;
  stroke?: number;
}) {
  const total = Math.max(0, used + stored);
  const usedPct = total ? used / total : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const usedLen = circumference * usedPct;

  return (
    <svg width={size} height={size} className="block">
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        {/* fondo */}
        <circle r={radius} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        {/* usado */}
        <circle
          r={radius}
          fill="none"
          stroke="#0F172A"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${usedLen} ${circumference - usedLen}`}
          transform="rotate(-90)"
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-900"
          fontSize={16}
          fontWeight={600}
        >
          {total ? Math.round(usedPct * 100) : 0}%
        </text>
      </g>
    </svg>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Counts | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await http.get<Counts>("/api/reports/counts");
      setData(r.data);
      setUpdatedAt(new Date());
    } catch (e: any) {
      setErr(e?.response?.data?.error || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalItems = useMemo(() => {
    if (!data) return 0;
    return (data.componentes || 0) + (data.perifericos || 0);
  }, [data]);

  const usoPct = useMemo(() => {
    if (!data || totalItems === 0) return 0;
    return (data.en_uso / totalItems) * 100;
  }, [data, totalItems]);

  const almacenPct = useMemo(() => {
    if (!data || totalItems === 0) return 0;
    return (data.en_almacen / totalItems) * 100;
  }, [data, totalItems]);

  const cards = useMemo(
    () => [
      { title: "Áreas", value: data?.areas ?? 0, icon: "🏢" },
      { title: "Equipos", value: data?.equipos ?? 0, icon: "🖥️" },
      { title: "Componentes", value: data?.componentes ?? 0, icon: "🧩" },
      { title: "Periféricos", value: data?.perifericos ?? 0, icon: "🎧" },
      { title: "En almacén", value: data?.en_almacen ?? 0, icon: "📦", sub: totalItems ? `${Math.round(almacenPct)}% de ítems` : undefined, pct: almacenPct },
      { title: "En uso", value: data?.en_uso ?? 0, icon: "⚙️", sub: totalItems ? `${Math.round(usoPct)}% de ítems` : undefined, pct: usoPct },
    ],
    [data, almacenPct, usoPct, totalItems]
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Panel General</h1>
          <div className="text-xs md:text-sm text-slate-500">
            {updatedAt ? `Actualizado: ${updatedAt.toLocaleString()}` : "—"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnBase} onClick={fetchData} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Errores */}
      {err && (
        <div className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200 p-3 flex items-center justify-between">
          <span>{err}</span>
          <button className={btnBase} onClick={fetchData}>Reintentar</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}

        {!loading &&
          cards.map((c, i) => (
            <div key={i} className={card}>
              <div className="flex-1">
                <div className={kpiTitle}>{c.title}</div>
                <div className={kpiValue}>{c.value}</div>
                {c.sub && <div className={kpiSub}>{c.sub}</div>}
                {"pct" in c && typeof c.pct === "number" ? (
                  <Progress value={c.pct} />
                ) : null}
              </div>
              <div className="shrink-0 h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">
                <span aria-hidden>{c.icon}</span>
              </div>
            </div>
          ))}
      </div>

      {/* Sección analítica: Distribución En uso / En almacén */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 md:p-6 flex items-center gap-4">
          <Donut used={data?.en_uso ?? 0} stored={data?.en_almacen ?? 0} />
          <div className="space-y-2">
            <div className="text-sm text-slate-600">Distribución de ítems</div>
            <div className="text-2xl font-semibold tracking-tight">
              {totalItems} ítem{totalItems === 1 ? "" : "s"}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-900" />
                <span className="text-slate-700">En uso</span>
                <span className="ml-auto font-medium">
                  {data?.en_uso ?? 0} ({Math.round(usoPct)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
                <span className="text-slate-700">En almacén</span>
                <span className="ml-auto font-medium">
                  {data?.en_almacen ?? 0} ({Math.round(almacenPct)}%)
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              * Cálculo sobre Componentes + Periféricos.
            </div>
          </div>
        </div>

        {/* Resúmenes rápidos */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 md:p-6">
            <div className="text-sm text-slate-600">Resumen de activos</div>
            <div className="mt-2 space-y-2">
              <Row label="Equipos" value={data?.equipos} />
              <Row label="Componentes" value={data?.componentes} />
              <Row label="Periféricos" value={data?.perifericos} />
              <Row label="Áreas" value={data?.areas} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 md:p-6">
            <div className="text-sm text-slate-600">Estado operativo</div>
            <div className="mt-2 space-y-2">
              <Row label="En uso" value={data?.en_uso} secondary={`${Math.round(usoPct)}%`} />
              <Row label="En almacén" value={data?.en_almacen} secondary={`${Math.round(almacenPct)}%`} />
              <div className="text-xs text-slate-500 mt-3">
                Distribución basada en el total de ítems (componentes + periféricos).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA / secundaria */}
      <div className="bg-slate-50 rounded-2xl ring-1 ring-slate-200 p-4 md:p-6 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-700">
          ¿Quieres ver detalles por área o equipo?
        </div>
        <button className={btnPrimary} onClick={fetchData} disabled={loading}>
          {loading ? "Actualizando…" : "Refrescar datos"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, secondary }: { label: string; value?: number | null; secondary?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-slate-700">{label}</div>
      <div className="ml-auto font-medium">{value ?? 0}</div>
      {secondary && <div className="text-xs text-slate-500">{secondary}</div>}
    </div>
  );
}
