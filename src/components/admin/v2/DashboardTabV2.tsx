import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DollarSign, ShoppingBag, Package, Users, Loader2 } from "lucide-react";
import { getAdminOverview } from "@/lib/admin-products.functions";

type Overview = Awaited<ReturnType<typeof getAdminOverview>>;

export function DashboardTabV2() {
  const fn = useServerFn(getAdminOverview);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fn().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [fn]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return <div className="text-sm text-muted-foreground">Failed to load dashboard.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your store activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue (7d)" value={`$${data.stats.revenue7d.toFixed(2)}`} icon={<DollarSign className="h-4 w-4 text-emerald-500" />} />
        <StatCard label="Orders" value={String(data.stats.orders)} icon={<ShoppingBag className="h-4 w-4 text-muted-foreground" />} />
        <StatCard label="Products" value={String(data.stats.products)} icon={<Package className="h-4 w-4 text-muted-foreground" />} />
        <StatCard label="Customers" value={String(data.stats.customers)} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-background p-5">
          <h2 className="font-semibold text-foreground mb-3">Recent orders</h2>
          <div className="space-y-3">
            {data.recentOrders.length === 0 && <div className="text-xs text-muted-foreground">No orders yet.</div>}
            {data.recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">ORD-{o.id.slice(0, 4).toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.customer} · Bakong KHQR</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">${o.amount_usd.toFixed(2)}</div>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5">
          <h2 className="font-semibold text-foreground mb-3">Top products</h2>
          <div className="space-y-3">
            {data.topProducts.length === 0 && <div className="text-xs text-muted-foreground">No sales yet.</div>}
            {data.topProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted grid place-items-center overflow-hidden text-base">
                  {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <span>{p.cover_emoji ?? "🛍️"}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground">{p.sold} sold</div>
                </div>
                <div className="text-sm font-semibold">${p.price_usd.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    approved: { bg: "bg-emerald-500/15", fg: "text-emerald-600", label: "PAID" },
    pending: { bg: "bg-amber-500/15", fg: "text-amber-600", label: "PENDING" },
    rejected: { bg: "bg-rose-500/15", fg: "text-rose-600", label: "REFUNDED" },
  };
  const s = map[status] ?? { bg: "bg-muted", fg: "text-muted-foreground", label: status.toUpperCase() };
  return <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-semibold ${s.bg} ${s.fg}`}>{s.label}</span>;
}
