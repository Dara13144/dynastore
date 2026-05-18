import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  RefreshCw,
  WifiOff,
  Wifi,
  Pause,
  Play,
  CheckCircle2,
  XCircle,
  Ban,
  KeyRound,
  Upload as UploadIcon,
} from "lucide-react";

type AuditRow = {
  id: string;
  user_id: string;
  game_id: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  event_type: string;
  offset_bytes: number | null;
  attempt: number | null;
  message: string | null;
  online: boolean | null;
  created_at: string;
};

const fmtBytes = (n: number | null): string => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MiB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GiB`;
};

const fmtPct = (offset: number | null, total: number | null): string => {
  if (offset == null || !total || total <= 0) return "—";
  return `${((offset / total) * 100).toFixed(1)}%`;
};

const eventBadge = (
  ev: string,
): { icon: ReactNode; cls: string; label: string } => {
  const base = "h-3 w-3";
  switch (ev) {
    case "start":
      return { icon: <UploadIcon className={base} />, cls: "bg-primary/15 text-primary", label: "start" };
    case "pause":
      return { icon: <Pause className={base} />, cls: "bg-amber-500/15 text-amber-600", label: "pause" };
    case "resume":
      return { icon: <Play className={base} />, cls: "bg-emerald-500/15 text-emerald-600", label: "resume" };
    case "retry":
      return { icon: <RefreshCw className={base} />, cls: "bg-sky-500/15 text-sky-600", label: "retry" };
    case "network_lost":
      return { icon: <WifiOff className={base} />, cls: "bg-destructive/15 text-destructive", label: "net lost" };
    case "network_restored":
      return { icon: <Wifi className={base} />, cls: "bg-emerald-500/15 text-emerald-600", label: "net ok" };
    case "success":
      return { icon: <CheckCircle2 className={base} />, cls: "bg-emerald-500/15 text-emerald-600", label: "success" };
    case "error":
      return { icon: <XCircle className={base} />, cls: "bg-destructive/15 text-destructive", label: "error" };
    case "abort":
      return { icon: <Ban className={base} />, cls: "bg-muted text-muted-foreground", label: "abort" };
    case "token_refresh":
      return { icon: <KeyRound className={base} />, cls: "bg-violet-500/15 text-violet-600", label: "token" };
    default:
      return { icon: <Activity className={base} />, cls: "bg-muted text-muted-foreground", label: ev };
  }
};

export function UploadAuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [filterGame, setFilterGame] = useState<string>("");
  const [limit, setLimit] = useState<number>(200);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from("upload_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (filterEvent !== "all") q = q.eq("event_type", filterEvent);
    if (filterGame.trim()) q = q.ilike("game_id", `%${filterGame.trim()}%`);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setRows((data ?? []) as AuditRow[]);
    setLoading(false);
  }, [filterEvent, filterGame, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  // Group rows by file_name + started-at (rough session grouping for UI).
  const grouped = rows.reduce<Record<string, AuditRow[]>>((acc, r) => {
    const key = `${r.user_id}:${r.game_id ?? "?"}:${r.file_name ?? "?"}`;
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Upload Audit Log
          </h2>
          <p className="text-xs text-muted-foreground">
            ប្រវត្តិ retry / resume / network events រួមទាំង byte offset សម្រាប់រាល់ upload session។
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="all">All events</option>
            <option value="start">start</option>
            <option value="pause">pause</option>
            <option value="resume">resume</option>
            <option value="retry">retry</option>
            <option value="network_lost">network_lost</option>
            <option value="network_restored">network_restored</option>
            <option value="success">success</option>
            <option value="error">error</option>
            <option value="abort">abort</option>
            <option value="token_refresh">token_refresh</option>
          </select>
          <input
            type="text"
            placeholder="game id contains…"
            value={filterGame}
            onChange={(e) => setFilterGame(e.target.value)}
            className="w-44 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {rows.length === 0 && !loading && !error && (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          មិនទាន់មាន audit events
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Time</th>
              <th className="px-2 py-1.5 text-left font-medium">Event</th>
              <th className="px-2 py-1.5 text-left font-medium">Game</th>
              <th className="px-2 py-1.5 text-left font-medium">File</th>
              <th className="px-2 py-1.5 text-right font-medium">Offset</th>
              <th className="px-2 py-1.5 text-right font-medium">Size</th>
              <th className="px-2 py-1.5 text-right font-medium">%</th>
              <th className="px-2 py-1.5 text-right font-medium">Attempt</th>
              <th className="px-2 py-1.5 text-center font-medium">Online</th>
              <th className="px-2 py-1.5 text-left font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = eventBadge(r.event_type);
              return (
                <tr key={r.id} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.cls}`}>
                      {b.icon} {b.label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">{r.game_id ?? "—"}</td>
                  <td className="px-2 py-1.5 max-w-[200px] truncate" title={r.file_name ?? ""}>
                    {r.file_name ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmtBytes(r.offset_bytes)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmtBytes(r.file_size_bytes)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {fmtPct(r.offset_bytes, r.file_size_bytes)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{r.attempt ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center">
                    {r.online == null ? "—" : r.online ? (
                      <Wifi className="inline h-3 w-3 text-emerald-600" />
                    ) : (
                      <WifiOff className="inline h-3 w-3 text-destructive" />
                    )}
                  </td>
                  <td className="px-2 py-1.5 max-w-[260px] truncate text-muted-foreground" title={r.message ?? ""}>
                    {r.message ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Sessions: {Object.keys(grouped).length} · Total events: {rows.length}
      </p>
    </section>
  );
}
