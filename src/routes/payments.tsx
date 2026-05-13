import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Receipt, Copy } from "lucide-react";
import { useStore, StoreProvider } from "@/lib/store";
import { listMyTransactions } from "@/lib/admin.functions";
import { StatusPill } from "@/routes/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "ការទូទាត់ — Dyna Store" },
      { name: "description", content: "មើលប្រវត្តិការទូទាត់ KHQR, ការបញ្ចូល Balance, និងប្រតិបត្តិការទាំងអស់របស់អ្នកនៅ Dyna Store។" },
      { property: "og:title", content: "ការទូទាត់ — Dyna Store" },
      { property: "og:description", content: "មើលប្រវត្តិការទូទាត់ KHQR, ការបញ្ចូល Balance, និងប្រតិបត្តិការទាំងអស់នៅ Dyna Store។" },
      { property: "og:url", content: "https://dynastore.lovable.app/payments" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dynastore.lovable.app/payments" }],
  }),
  component: () => (<StoreProvider><PaymentsPage /></StoreProvider>),
});

type Tx = { bakong_md5: string; amount_usd: number; coins: number; status: string; created_at: string; expires_at: string; paid_at: string | null };

function PaymentsPage() {
  const { authed, loading } = useStore();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(true);
  const list = useServerFn(listMyTransactions);

  useEffect(() => {
    if (loading) return;
    if (!authed) { navigate({ to: "/login" }); return; }
    (async () => {
      try { const r = await list({}); setRows(r as Tx[]); }
      catch (e) { toast.error(e instanceof Error ? e.message : "បរាជ័យ"); }
      finally { setBusy(false); }
    })();
  }, [authed, loading, list, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" aria-label="ត្រឡប់ទៅទំព័រដើម" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <h1 className="font-display text-lg gradient-text inline-flex items-center gap-2"><Receipt className="h-4 w-4" /> ប្រវត្តិការទូទាត់</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {busy ? (
          <div className="text-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">មិនទាន់មានប្រវត្តិការទូទាត់នៅឡើយ</div>
        ) : (
          <div className="rounded-2xl glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">ពេលវេលា</th>
                    <th className="text-left px-4 py-3">MD5</th>
                    <th className="text-right px-4 py-3">USD</th>
                    <th className="text-right px-4 py-3">Balance</th>
                    <th className="text-center px-4 py-3">ស្ថានភាព</th>
                    <th className="text-left px-4 py-3">ផុត / បង់</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.bakong_md5} className="border-t border-border/60 hover:bg-muted/10">
                      <td className="px-4 py-3 text-xs">{new Date(t.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                        <button onClick={() => { navigator.clipboard.writeText(t.bakong_md5); toast.success("ចម្លង MD5 រួច"); }} className="inline-flex items-center gap-1 hover:text-foreground" title={t.bakong_md5}>
                          <span className="truncate max-w-[160px] inline-block align-bottom">{t.bakong_md5}</span>
                          <Copy className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">${Number(t.amount_usd).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">{t.coins.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><StatusPill s={t.status} /></td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        {t.paid_at ? `Paid ${new Date(t.paid_at).toLocaleString()}` : `Exp ${new Date(t.expires_at).toLocaleString()}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
