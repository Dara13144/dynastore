import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard } from "@/lib/admin.functions";
import {
  Loader2,
  Wallet,
  Users,
  Gamepad2,
  ShoppingBag,
  DollarSign,
  Package,
  Store,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Dash = Awaited<ReturnType<typeof getAdminDashboard>>;

const PIE_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(330 81% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(262 83% 58%)",
  "hsl(0 84% 60%)",
];

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
      <div>
        <h2 className="font-display text-2xl">ផ្ទាំងគ្រប់គ្រង</h2>
        <p className="text-sm text-muted-foreground mt-1">
          ទិដ្ឋភាពទូទៅ Dyna Store — ទិន្នន័យពិតប្រាកដ
        </p>
      </div>

      {/* Top row: 4 hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-500" />}
          label="អ្នកប្រើសរុប"
          value={t.totalUsers.toLocaleString()}
          live
        />
        <StatCard
          icon={<ShoppingBag className="h-5 w-5 text-emerald-500" />}
          label="ការបញ្ចាទិញ"
          value={t.totalPurchases.toLocaleString()}
          live
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
          label="ចំណូលសរុប"
          value={`$${t.totalToppedUsd.toFixed(2)}`}
          live
        />
        <StatCard
          icon={<Package className="h-5 w-5 text-pink-500" />}
          label="ផលិតផល"
          value={t.totalGames.toLocaleString()}
          live
        />
      </div>

      {/* Second row: 4 secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Store className="h-5 w-5 text-emerald-500" />}
          label="កាក់ក្នុងប្រព័ន្ធ"
          value={t.totalCoins.toLocaleString()}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          label="អ្នកប្រើថ្មី (30 ថ្ងៃ)"
          value={t.newUsers30.toLocaleString()}
        />
        <StatCard
          icon={<Package className="h-5 w-5 text-pink-500" />}
          label="ការទិញថ្មី (30 ថ្ងៃ)"
          value={t.newPurchases30.toLocaleString()}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5 text-blue-500" />}
          label="កាក់បញ្ចូលសរុប"
          value={t.totalToppedCoins.toLocaleString()}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-4">
          <header className="flex items-center gap-2 mb-3">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            <h3 className="font-display text-sm">ចំណូលប្រចាំខែ</h3>
          </header>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlySales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "ចំណូល"]}
                />
                <Line
                  type="monotone"
                  dataKey="usd"
                  stroke="hsl(217 91% 60%)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-4">
          <h3 className="font-display text-sm mb-3">ប្រភេទទំនិញ</h3>
          {data.categories.length === 0 ? (
            <div className="h-64 grid place-items-center text-sm text-muted-foreground">
              គ្មានទិន្នន័យ
            </div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categories}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {data.categories.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {data.categories.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-foreground">{c.name}</span>
                    </span>
                    <span className="text-muted-foreground">{c.pct}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* Recent activity tables */}
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
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    គ្មានទិន្នន័យ
                  </td>
                </tr>
              ) : (
                data.recentTopups.map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="px-4 py-2">{r.user_name}</td>
                    <td className="px-4 py-2 text-right">${Number(r.amount_usd).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">+{r.coins}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(r.reviewed_at ?? r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
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
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    គ្មានទិន្នន័យ
                  </td>
                </tr>
              ) : (
                data.recentPurchases.map((p) => (
                  <tr key={p.id} className="border-t border-border/40">
                    <td className="px-4 py-2">{p.user_name}</td>
                    <td className="px-4 py-2">{p.game_title}</td>
                    <td className="px-4 py-2 text-right">{p.price_coins}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  live,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-4 relative">
      <div className="flex items-start justify-between">
        <div className="h-9 w-9 rounded-xl bg-muted/40 grid place-items-center">{icon}</div>
        {live && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
            <ArrowUpRight className="h-3 w-3" /> Live
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-2xl">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
