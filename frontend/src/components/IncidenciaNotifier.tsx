// src/components/IncidenciaNotifier.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUpdates } from "../api/incidencias";
import { getUser } from "../services/authService";

const LS_LAST       = "incfeed.last_id.v2";
const LS_PRIMED_AT  = "incfeed.primed_at.v2";
const LS_LEADER_KEY = "incfeed.leader.v1"; // { id, until }
const CH_NAME       = "incfeed.channel.v1";

const HEARTBEAT_MS  = 4000; // cada cuánto renueva el líder su lock
const LOCK_TTL_MS   = 7000; // si pasan 7s sin heartbeat, se asume libre
const BASE_POLL_MS  = 1500; // igual que antes

type BroadcastMsg =
  | { type: "prime"; last_id: number }
  | { type: "updates"; items: any[]; last_id: number }
  | { type: "leader:claimed"; id: string }
  | { type: "leader:released"; id: string };

function readLast(): number {
  try { return Number(localStorage.getItem(LS_LAST) || "0"); } catch { return 0; }
}
function writeLast(v: number) {
  try { localStorage.setItem(LS_LAST, String(v)); } catch {}
}
function primed() { return !!localStorage.getItem(LS_PRIMED_AT); }
function writePrimed() {
  try { localStorage.setItem(LS_PRIMED_AT, new Date().toISOString()); } catch {}
}

function now() { return Date.now(); }
function newTabId() { return crypto?.randomUUID?.() || String(Math.random()); }

function readLeader(): { id: string; until: number } | null {
  try {
    const raw = localStorage.getItem(LS_LEADER_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.until !== "number") return null;
    return obj;
  } catch { return null; }
}

function tryBecomeLeader(myId: string): boolean {
  // intento: si no hay líder o está expirado, me postulo
  const current = readLeader();
  const expired = !current || current.until < now();
  if (!expired) return false;
  const candidate = { id: myId, until: now() + LOCK_TTL_MS };
  localStorage.setItem(LS_LEADER_KEY, JSON.stringify(candidate));
  // confirmar que yo quedé
  const after = readLeader();
  return !!after && after.id === myId;
}

function refreshLeader(myId: string) {
  const current = readLeader();
  if (!current || current.id !== myId) return false;
  const refreshed = { id: myId, until: now() + LOCK_TTL_MS };
  localStorage.setItem(LS_LEADER_KEY, JSON.stringify(refreshed));
  return true;
}

function releaseLeader(myId: string) {
  const current = readLeader();
  if (current && current.id === myId) {
    localStorage.removeItem(LS_LEADER_KEY);
  }
}

function Bubble({
  title,
  subtitle,
  onClick,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed right-4 bottom-4 z-[60] animate-[fadeIn_.15s_ease-out]">
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg ring-1 ring-slate-200 w-[320px] overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3">
          <div className="shrink-0 h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3a9 9 0 00-9 9 9 9 0 001.7 5.2L3 21l3.1-1.6A9 9 0 1012 3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{title}</div>
            {subtitle && <div className="text-xs text-slate-600 line-clamp-2">{subtitle}</div>}
            <div className="mt-2 flex items-center gap-2">
              <button className="inline-flex h-9 px-3 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500" onClick={onClick}>
                Abrir chat
              </button>
              <button className="inline-flex h-9 px-3 rounded-lg text-sm bg-white border border-slate-300 hover:bg-slate-50" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:.001;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

export default function IncidenciaNotifier({
  pollMs = BASE_POLL_MS,
  onOpenIncidencia,
}: {
  pollMs?: number;
  onOpenIncidencia?: (id: number) => void;
}) {
  const me = getUser();
  const myUser = (me?.username || "").toLowerCase();
  const rol = me?.rol || "USUARIO";
  const isUser = rol === "USUARIO";

  const [toast, setToast] = useState<{ id: number; titulo: string; preview?: string } | null>(null);

  const lastIdRef = useRef<number>(readLast());
  const busyRef   = useRef(false);

  // Liderazgo
  const tabIdRef    = useRef<string>(newTabId());
  const isLeaderRef = useRef<boolean>(false);
  const bcRef       = useRef<BroadcastChannel | null>(null);

  // Prime: no mostrar histórico
  const prime = useCallback(async () => {
    if (primed()) return;
    const r = await fetchUpdates(undefined);
    lastIdRef.current = r.last_id || 0;
    writeLast(lastIdRef.current);
    writePrimed();
    // comparte prime con otras pestañas
    bcRef.current?.postMessage({ type: "prime", last_id: lastIdRef.current } as BroadcastMsg);
  }, []);

  const handleIncoming = useCallback((items: any[], last_id: number) => {
    if (items?.length) {
      const first = items.find((it: any) => {
        if ((it.usuario || "").toLowerCase() === myUser) return false;
        if (isUser && it.solo_staff) return false;
        return true;
      });
      if (first) {
        setToast({
          id: first.inc_id,
          titulo: `Nueva respuesta en #${first.inc_id} · ${first.titulo}`,
          preview: (first.mensaje || "").slice(0, 120),
        });
      }
    }
    if (typeof last_id === "number" && last_id > (lastIdRef.current || 0)) {
      lastIdRef.current = last_id;
      writeLast(lastIdRef.current);
    }
  }, [isUser, myUser]);

  // Poll (sólo si soy líder)
  const tick = useCallback(async () => {
    if (!isLeaderRef.current) return;
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await fetchUpdates(lastIdRef.current || 0);
      if ((r.items?.length ?? 0) > 0 || (typeof r.last_id === "number" && r.last_id > lastIdRef.current)) {
        // Notifica a TODAS las pestañas (incluida esta)
        bcRef.current?.postMessage({ type: "updates", items: r.items || [], last_id: r.last_id || lastIdRef.current } as BroadcastMsg);
        // Aplica localmente
        handleIncoming(r.items || [], r.last_id || lastIdRef.current);
      }
    } catch {
      /* ignore */
    } finally {
      busyRef.current = false;
    }
  }, [handleIncoming]);

  useEffect(() => {
    // init canal
    const bc = new BroadcastChannel(CH_NAME);
    bcRef.current = bc;

    // Escuchar mensajes de otras pestañas
    const onMsg = (ev: MessageEvent<BroadcastMsg>) => {
      const msg = ev.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "updates") {
        handleIncoming(msg.items || [], msg.last_id || 0);
      } else if (msg.type === "prime") {
        if (!primed()) {
          // si yo aún no primeé pero otra pestaña sí, usa su last_id
          lastIdRef.current = msg.last_id || lastIdRef.current;
          writeLast(lastIdRef.current);
          writePrimed();
        }
      }
    };
    bc.addEventListener("message", onMsg as any);

    // Leader election loop
    const claimLeader = () => {
      if (isLeaderRef.current) return;
      if (tryBecomeLeader(tabIdRef.current)) {
        isLeaderRef.current = true;
        bc.postMessage({ type: "leader:claimed", id: tabIdRef.current } as BroadcastMsg);
      }
    };
    const release = () => {
      if (isLeaderRef.current) {
        releaseLeader(tabIdRef.current);
        isLeaderRef.current = false;
        bc.postMessage({ type: "leader:released", id: tabIdRef.current } as BroadcastMsg);
      }
    };

    // Primer intento de liderazgo
    claimLeader();

    // Heartbeat / renovación (si soy líder)
    const hb = setInterval(() => {
      if (isLeaderRef.current) {
        if (!refreshLeader(tabIdRef.current)) {
          // perdí el lock
          isLeaderRef.current = false;
        }
      } else {
        // intentar robar el liderazgo si expiró
        claimLeader();
      }
    }, HEARTBEAT_MS);

    // Prime una sola vez
    prime().catch(() => {});

    // Polling: si soy líder, hago tick; si no, me quedo escuchando el canal
    const base = setInterval(() => {
      if (document.visibilityState === "hidden") return; // ahorro
      tick().catch(() => {});
    }, pollMs);

    const onVisibility = () => {
      // el líder puede acelerar un poco con foco; aquí mantenemos simple
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Limpieza
    return () => {
      clearInterval(base);
      clearInterval(hb);
      document.removeEventListener("visibilitychange", onVisibility);
      release(); // suelta el liderazgo si lo tenías
      bc.removeEventListener("message", onMsg as any);
      bc.close();
    };
  }, [pollMs, prime, tick, handleIncoming]);

  const open = () => {
    const id = toast?.id;
    setToast(null);
    if (id) onOpenIncidencia?.(id);
  };

  return toast ? (
    <Bubble
      title={toast.titulo}
      subtitle={toast.preview}
      onClick={open}
      onClose={() => setToast(null)}
    />
  ) : null;
}
