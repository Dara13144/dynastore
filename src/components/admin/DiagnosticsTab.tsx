import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { runBackendDiagnostics, type DiagCheck } from "@/lib/diagnostics.functions";
import { getGameFilesBucketLimit } from "@/lib/bucket-limit.functions";
import { supabase } from "@/integrations/supabase/client";

type ClientCheck = DiagCheck & { source: "server" | "client" };

async function timeClient(
  name: string,
  run: () => Promise<{ ok: boolean; message: string }>,
): Promise<ClientCheck> {
  const t0 = performance.now();
  try {
    const r = await run();
    return {
      name,
      ok: r.ok,
      ms: Math.round(performance.now() - t0),
      message: r.message,
      source: "client",
    };
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Math.round(performance.now() - t0),
      message: e instanceof Error ? e.message : String(e),
      source: "client",
    };
  }
}

export function DiagnosticsTab() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ClientCheck[]>([]);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [serverMs, setServerMs] = useState<number | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const runDiagnostics = useServerFn(runBackendDiagnostics);
  const fetchBucketLimit = useServerFn(getGameFilesBucketLimit);

  const run = async () => {
    setRunning(true);
    setResults([]);
    setRttMs(null);
    setServerMs(null);
    try {
      // 1) RPC roundtrip to runBackendDiagnostics (server suite)
      const t0 = performance.now();
      let server: { checks: DiagCheck[]; serverMs: number } | null = null;
      let rpcError: string | null = null;
      try {
        server = await runDiagnostics({ data: undefined });
      } catch (e) {
        rpcError = e instanceof Error ? e.message : String(e);
      }
      const rtt = Math.round(performance.now() - t0);
      setRttMs(rtt);
      setServerMs(server?.serverMs ?? null);

      const all: ClientCheck[] = [];
      all.push({
        name: "rpc.runBackendDiagnostics",
        ok: !!server && !rpcError,
        ms: rtt,
        message: rpcError ?? `OK · roundtrip ${rtt}ms`,
        source: "client",
      });
      if (server) {
        for (const c of server.checks) all.push({ ...c, source: "server" });
      }

      // 2) Client-side RPC: bucket limit (upload preflight uses this on the
      //    admin page load)
      all.push(
        await timeClient("rpc.getGameFilesBucketLimit", async () => {
          const r = await fetchBucketLimit({ data: undefined });
          return {
            ok: true,
            message: r.limitBytes
              ? `OK · ${(r.limitBytes / 1024 ** 3).toFixed(1)}GiB`
              : "OK · default",
          };
        }),
      );

      // 3) Link-lookup probe: read a visible game row (RLS-respected)
      all.push(
        await timeClient("link.games.public-read", async () => {
          const { data, error } = await supabase
            .from("games")
            .select("id")
            .eq("visible", true)
            .limit(1);
          if (error) return { ok: false, message: error.message };
          return { ok: true, message: `OK · ${data?.length ?? 0} row` };
        }),
      );

      // 4) Auth session reachable
      all.push(
        await timeClient("auth.getSession", async () => {
          const { data, error } = await supabase.auth.getSession();
          if (error) return { ok: false, message: error.message };
          return {
            ok: !!data.session,
            message: data.session ? `OK · ${data.session.user.email ?? "user"}` : "no session",
          };
        }),
      );

      setResults(all);
      setRanAt(new Date().toLocaleTimeString());
    } finally {
      setRunning(false);
    }
  };

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Backend Diagnostics
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            ពិនិត្យ upload/link lookup server functions រួមទាំង latency។
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> កំពុងពិនិត្យ…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" /> Run diagnostics
            </>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <StatCard label="Pass" value={String(passed)} tone="emerald" />
          <StatCard label="Fail" value={String(failed)} tone={failed ? "destructive" : "muted"} />
          <StatCard
            label="RPC RTT"
            value={rttMs != null ? `${rttMs} ms` : "—"}
            tone="primary"
          />
          <StatCard
            label="Server"
            value={serverMs != null ? `${serverMs} ms` : "—"}
            tone="primary"
          />
        </div>
      )}

      {ranAt && (
        <p className="text-[11px] text-muted-foreground">
          ដំណើរការចុងក្រោយ: {ranAt}
        </p>
      )}

      {results.length === 0 && !running && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          ចុច "Run diagnostics" ដើម្បីពិនិត្យសុខភាព backend។
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl ring-1 ring-border bg-card/40">
          <table className="w-full text-xs">
            <thead className="bg-muted/20 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Check</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-right px-3 py-2">Latency</th>
                <th className="text-left px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={`${r.name}-${i}`}
                  className={`border-t border-border/60 ${r.ok ? "" : "bg-destructive/5"}`}
                >
                  <td className="px-3 py-2">
                    {r.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      r.ms > 1000
                        ? "text-amber-400"
                        : r.ms > 300
                          ? "text-foreground"
                          : "text-emerald-400"
                    }`}
                  >
                    {r.ms} ms
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "destructive" | "muted" | "primary";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-400 ring-emerald-500/30"
      : tone === "destructive"
        ? "text-destructive ring-destructive/40"
        : tone === "primary"
          ? "text-primary ring-primary/30"
          : "text-muted-foreground ring-border";
  return (
    <div className={`rounded-lg bg-card/60 px-3 py-2 ring-1 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
