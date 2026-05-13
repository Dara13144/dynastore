import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
