import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { listAdminOrders } from "@/lib/admin-products.functions";

type Order = Awaited<ReturnType<typeof listAdminOrders>>[number];

export function OrdersTabV2() {
  const fn = useServerFn(listAdminOrders);
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fn().then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, [fn]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground">All payments and their Bakong KHQR status.</p>
      </div>

      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2.5 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-2">Order</div>
          <div className="col-span-3">Customer</div>
          <div className="col-span-2">Method</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        {loading ? (
          <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No orders yet.</div>
        ) : rows.map((r) => (
          <div key={r.id} className="grid grid-cols-12 px-4 py-3 border-t border-border items-center text-sm">
            <div className="col-span-2 font-medium">ORD-{r.id.slice(0, 4).toUpperCase()}</div>
            <div className="col-span-3 min-w-0">
              <div className="font-medium truncate">{r.customer}</div>
            </div>
            <div className="col-span-2 text-muted-foreground">{r.method}</div>
            <div className="col-span-2 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</div>
            <div className="col-span-2 text-right font-semibold">${r.amount_usd.toFixed(2)}</div>
            <div className="col-span-1 text-right"><StatusBadge status={r.status} /></div>
          </div>
        ))}
      </div>
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
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold ${s.bg} ${s.fg}`}>{s.label}</span>;
}
