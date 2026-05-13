import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminPayments, lookupTransactionByMd5 } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Admin · Recent Payments" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
});

type Tx = {
  id: string;
  md5: string;
  user_id: string;
  amount_usd: number;
  coins: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
  bakong_ref: string | null;
};

function statusClass(s: string) {
  if (s === "paid") return "bg-green-500/15 text-green-400 border-green-500/30";
  if (s === "expired") return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  if (s === "pending") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function AdminDashboard() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [lookupMd5, setLookupMd5] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupErr, setLookupErr] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);

  const runLookup = async (md5?: string) => {
    const value = (md5 ?? lookupMd5).trim();
    if (!value) return;
    setLookupBusy(true);
    setLookupErr("");
    setLookupResult(null);
    try {
      const r = await lookupTransactionByMd5({ data: { md5: value } });
      setLookupResult(r);
    } catch (e: any) {
      setLookupErr(e?.message || String(e));
    } finally {
      setLookupBusy(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await getAdminPayments();
      setTxs(r.transactions as Tx[]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = txs.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      t.md5.toLowerCase().includes(needle) ||
      t.user_id.toLowerCase().includes(needle) ||
      (t.bakong_ref?.toLowerCase().includes(needle) ?? false)
    );
  });

  const counts = {
    all: txs.length,
    pending: txs.filter((t) => t.status === "pending").length,
    paid: txs.filter((t) => t.status === "paid").length,
    expired: txs.filter((t) => t.status === "expired").length,
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin · Recent Payments</h1>
          <p className="text-sm text-muted-foreground">Last 100 payment attempts across all users.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-card hover:bg-muted"
          >
            Refresh
          </button>
          <Link
            to="/debug/payment"
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-card hover:bg-muted"
          >
            Open my debug panel →
          </Link>
        </div>
      </header>

      {err && (
        <div className="mb-4 p-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {err}
        </div>
      )}

      <section className="mb-6 p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Lookup transaction by MD5</h2>
          <span className="text-xs text-muted-foreground">Confirms the reuse path / debugs collisions</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={lookupMd5}
            onChange={(e) => setLookupMd5(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runLookup(); }}
            placeholder="Paste an md5 (e.g. from the duplicate-key error or debug log)"
            className="flex-1 min-w-[280px] px-3 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
          />
          <button
            onClick={() => runLookup()}
            disabled={lookupBusy || !lookupMd5.trim()}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-primary text-primary-foreground disabled:opacity-50"
          >
            {lookupBusy ? "Looking up…" : "Lookup"}
          </button>
        </div>

        {lookupErr && (
          <div className="mt-3 p-2 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
            {lookupErr}
          </div>
        )}

        {lookupResult && !lookupResult.found && (
          <div className="mt-3 p-3 rounded border border-border bg-muted/30 text-sm">
            No transaction found for md5 <code className="font-mono">{lookupResult.md5}</code>.
          </div>
        )}

        {lookupResult?.found && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {[
              ["Tx ID", lookupResult.transaction.id],
              ["Status", lookupResult.transaction.status + (lookupResult.transaction.isPendingExpired ? " (expired in DB clock)" : "")],
              ["User ID", lookupResult.transaction.userId],
              ["MD5", lookupResult.transaction.md5],
              ["Amount USD", `$${lookupResult.transaction.amountUsd.toFixed(2)}`],
              ["Coins", String(lookupResult.transaction.coins)],
              ["Created", new Date(lookupResult.transaction.createdAt).toLocaleString()],
              ["Expires", `${new Date(lookupResult.transaction.expiresAt).toLocaleString()} (${lookupResult.transaction.secondsUntilExpiry}s)`],
              ["Paid", lookupResult.transaction.paidAt ? new Date(lookupResult.transaction.paidAt).toLocaleString() : "—"],
              ["Bakong Ref", lookupResult.transaction.bakongRef ?? "—"],
              ["QR payload", lookupResult.transaction.qrPayloadPreview ?? "—"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-2 p-2 rounded bg-background border border-border">
                <span className="text-muted-foreground w-24 shrink-0">{k}</span>
                <span className="font-mono break-all">{v as string}</span>
              </div>
            ))}
          </div>
        )}

        {lookupResult?.found && lookupResult.raw && (
          <details className="mt-3 rounded border border-border bg-background" open>
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold flex items-center justify-between">
              <span>Raw row (all selected columns)</span>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(lookupResult.raw, null, 2));
                    toast.success("Raw row JSON copied to clipboard");
                  } catch (err: any) {
                    toast.error(`Copy failed: ${err?.message || String(err)}`);
                  }
                }}
                className="px-2 py-0.5 text-[10px] rounded border border-border hover:bg-muted"
              >
                Copy JSON
              </button>
            </summary>
            <pre className="px-3 pb-3 pt-1 text-[11px] font-mono whitespace-pre-wrap break-all overflow-x-auto">
{JSON.stringify(lookupResult.raw, null, 2)}
            </pre>
          </details>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(["all", "pending", "paid", "expired"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs border ${
              filter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s} ({counts[s as keyof typeof counts] ?? 0})
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search md5 / user_id / bakong_ref"
          className="ml-auto px-3 py-1.5 text-sm rounded-md border border-border bg-card w-72 max-w-full"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-right px-3 py-2">USD</th>
              <th className="text-right px-3 py-2">Coins</th>
              <th className="text-left px-3 py-2">MD5</th>
              <th className="text-left px-3 py-2">Bakong Ref</th>
              <th className="text-left px-3 py-2">Expires</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No matching transactions.</td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${statusClass(t.status)}`}>{t.status}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{t.user_id.slice(0, 8)}…</td>
                <td className="px-3 py-2 text-right">${Number(t.amount_usd).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{t.coins}</td>
                <td className="px-3 py-2 font-mono text-xs truncate max-w-[180px]" title={t.md5}>{t.md5.slice(0, 16)}…</td>
                <td className="px-3 py-2 font-mono text-xs truncate max-w-[140px]" title={t.bakong_ref ?? ""}>{t.bakong_ref ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(t.expires_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Link
                    to="/debug/payment"
                    search={{ md5: t.md5 } as any}
                    className="text-primary hover:underline text-xs"
                  >
                    Debug →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Need access? Ask an existing admin to insert a row in <code>user_roles</code> with role <code>admin</code> for your user id.
      </p>
    </div>
  );
}
