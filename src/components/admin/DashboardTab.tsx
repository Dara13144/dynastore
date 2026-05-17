import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard } from "@/lib/admin.functions";
import { Loader2, Wallet, Users, Gamepad2, TrendingUp, ShoppingBag, Coins } from "lucide-react";

type Dash = Awaited<ReturnType<typeof getAdminDashboard>>;

export function DashboardTab() {
  const fetchDash = useServerFn(getAdminDashboard);
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = await fetchDash();
        setData(d);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchDash]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (err || !data) {
    return <div className="text-sm text-destructive">បរាជ័យ: {err}</div>;
  }

  const t = data.totals;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Coins className="h-4 w-4" />} label="សរុបកាក់ក្នុងប្រព័ន្ធ" value={t.totalCoins.toLocaleString()} />
        <StatCard icon={<Users className="h-4 w-4" />} label="អ្នកប្រើសរុប" value={t.totalUsers.toLocaleString()} />
        <StatCard icon={<Gamepad2 className="h-4 w-4" />} label="ហ្គេមសរុប" value={t.totalGames.toLocaleString()} />
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Topup សរុប (USD)" value={`$${t.totalToppedUsd.toFixed(2)}`} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Topup កាក់សរុប" value={t.totalToppedCoins.toLocaleString()} />
        <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="ការទិញ (ថ្មីៗ)" value={t.totalPurchases.toLocaleString()} />
      </div>

      <section className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
        <header className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm">បញ្ចូលលុយថ្មីៗ (Approved)</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/20">
              <tr>
                <th className="text-left px-4 py-2">អ្នកប្រើ</th>
                <th className="text-right px-4 py-2">USD</th>
                <th className="text-right px-4 py-2">កាក់</th>
                <th className="text-left px-4 py-2">កាលបរិច្ឆេទ</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTopups.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">គ្មានទិន្នន័យ</td></tr>
              ) : data.recentTopups.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-4 py-2">{r.user_name}</td>
                  <td className="px-4 py-2 text-right">${Number(r.amount_usd).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">+{r.coins}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(r.reviewed_at ?? r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
        <header className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm">ការទិញហ្គេមថ្មីៗ</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/20">
              <tr>
                <th className="text-left px-4 py-2">អ្នកប្រើ</th>
                <th className="text-left px-4 py-2">ហ្គេម</th>
                <th className="text-right px-4 py-2">តម្លៃ (កាក់)</th>
                <th className="text-left px-4 py-2">កាលបរិច្ឆេទ</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPurchases.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">គ្មានទិន្នន័យ</td></tr>
              ) : data.recentPurchases.map((p) => (
                <tr key={p.id} className="border-t border-border/40">
                  <td className="px-4 py-2">{p.user_name}</td>
                  <td className="px-4 py-2">{p.game_title}</td>
                  <td className="px-4 py-2 text-right">{p.price_coins}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <div className="mt-2 font-display text-xl gradient-text">{value}</div>
    </div>
  );
}
