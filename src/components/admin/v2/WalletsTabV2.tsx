import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { listAdminWallets } from "@/lib/admin-products.functions";
import { adminSetUserBalance } from "@/lib/admin.functions";

type Row = Awaited<ReturnType<typeof listAdminWallets>>[number];

export function WalletsTabV2() {
  const list = useServerFn(listAdminWallets);
  const setBal = useServerFn(adminSetUserBalance);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const reload = () => { setLoading(true); list().then(setRows).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const filtered = rows.filter((r) => !q.trim() || r.display_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Wallets</h1>
        <p className="text-sm text-muted-foreground">View and adjust user balances.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users..." className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-3 text-sm" />
      </div>

      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2.5 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-6">User</div>
          <div className="col-span-3 text-right">Balance</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        {loading ? (
          <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No users.</div>
        ) : filtered.map((r) => (
          <div key={r.user_id} className="grid grid-cols-12 px-4 py-3 border-t border-border items-center">
            <div className="col-span-6 flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold overflow-hidden">
                {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : r.display_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{r.display_name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{r.user_id.slice(0, 8)}…</div>
              </div>
            </div>
            <div className="col-span-3 text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <WalletIcon className="h-3 w-3" /> ${r.balance.toFixed(2)}
              </span>
            </div>
            <div className="col-span-3 text-right">
              <button
                onClick={async () => {
                  const v = prompt(`Set balance for ${r.display_name}:`, String(r.balance));
                  if (v == null) return;
                  const n = Math.max(0, Math.round(Number(v) || 0));
                  try { await setBal({ data: { user_id: r.user_id, new_balance: n, reason: "admin adjust" } }); toast.success("Updated"); reload(); } catch { toast.error("Failed"); }
                }}
                className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
              >Set balance</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
