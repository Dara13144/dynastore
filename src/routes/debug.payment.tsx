import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { checkPayment, getWalletState } from "@/lib/bakong.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/debug/payment")({
  component: PaymentDebugPage,
  head: () => ({ meta: [{ title: "Payment Debug · Bakong KHQR" }] }),
});

type Tx = {
  id: string;
  md5: string;
  amount_usd: number;
  coins: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
};

type CheckResult = Awaited<ReturnType<typeof checkPayment>> & { __at?: number };

function PaymentDebugPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [results, setResults] = useState<Record<string, CheckResult>>({});

  const refresh = async () => {
    setBusy(true);
    setErr("");
    try {
      const w = await getWalletState();
      setCoins(w.coins);
      setTxs((w.transactions ?? []) as any);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const ok = !!data.user;
      setAuthed(ok);
      if (ok) refresh();
    });
  }, []);

  const probe = async (md5: string) => {
    setErr("");
    try {
      const r = await checkPayment({ data: { md5 } });
      setResults((prev) => ({ ...prev, [md5]: { ...(r as any), __at: Date.now() } }));
      // refresh wallet/tx after a probe (in case it credited)
      refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  };

  if (authed === false) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="mx-auto max-w-3xl rounded-2xl bg-card/40 p-6 ring-1 ring-border">
          <h1 className="font-display text-2xl">Payment Debug</h1>
          <p className="mt-2 text-sm text-muted-foreground">សូមចូលគណនីមុនសិន</p>
          <Link to="/" className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">ទៅទំព័រដើម</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary">Bakong · KHQR · Debug</div>
            <h1 className="font-display text-3xl">Payment Workflow Debug</h1>
            <p className="text-sm text-muted-foreground">Last <code>checkPayment</code> responseCode, bakong_ref, និង credit result</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={busy} className="rounded-full bg-card/60 px-4 py-2 text-sm ring-1 ring-border hover:bg-card disabled:opacity-50">
              {busy ? "កំពុង…" : "ផ្ទុកឡើងវិញ"}
            </button>
            <Link to="/" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">ត្រឡប់</Link>
          </div>
        </header>

        <section className="rounded-2xl bg-card/40 p-5 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Wallet Balance</div>
            <div className="font-display text-2xl text-coin">{coins.toLocaleString()} Coins</div>
          </div>
        </section>

        {err && (
          <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/30">
            <div className="font-bold">Error</div>
            <div className="mt-1 break-all font-mono text-xs">{err}</div>
          </div>
        )}

        <section className="rounded-2xl bg-card/40 p-5 ring-1 ring-border">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Transactions ({txs.length})</h2>
            <span className="text-[11px] text-muted-foreground">ចុច "Probe Bakong" ដើម្បីហៅ checkPayment</span>
          </div>
          <div className="space-y-3">
            {txs.length === 0 && <p className="text-sm text-muted-foreground">មិនទាន់មានប្រតិបត្តិការ</p>}
            {txs.map((t) => {
              const r = results[t.md5];
              const tone =
                t.status === "paid" ? "ring-primary/40 bg-primary/5"
                : t.status === "expired" ? "ring-destructive/30 bg-destructive/5"
                : "ring-border bg-background/30";
              return (
                <div key={t.id} className={`rounded-xl p-4 ring-1 ${tone}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">MD5</span>
                      <code className="break-all font-mono text-xs">{t.md5}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill label={t.status.toUpperCase()} tone={t.status === "paid" ? "ok" : t.status === "expired" ? "bad" : "warn"} />
                      <button
                        onClick={() => probe(t.md5)}
                        className="rounded-full bg-primary/90 px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary"
                      >
                        Probe Bakong
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <Field label="Amount" value={`$${t.amount_usd}`} />
                    <Field label="Coins" value={t.coins.toLocaleString()} />
                    <Field label="Created" value={new Date(t.created_at).toLocaleString()} />
                    <Field label="Expires" value={new Date(t.expires_at).toLocaleString()} />
                    {t.paid_at && <Field label="Paid at" value={new Date(t.paid_at).toLocaleString()} />}
                  </div>

                  {r && (
                    <div className="mt-3 rounded-lg bg-background/60 p-3 ring-1 ring-border">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-primary">Last checkPayment</span>
                        <span className="text-muted-foreground">{r.__at ? new Date(r.__at).toLocaleTimeString() : ""}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                        <Field label="status" value={String(r.status)} />
                        <Field label="responseCode" value={String((r as any).responseCode ?? "—")} />
                        <Field label="responseMessage" value={String((r as any).responseMessage ?? "—")} />
                        {"bakongRef" in r && <Field label="bakong_ref / hash" value={String((r as any).bakongRef ?? "—")} mono />}
                        {"newBalance" in r && <Field label="newBalance" value={String((r as any).newBalance ?? "—")} />}
                        {"creditedNow" in r && <Field label="creditedNow" value={String((r as any).creditedNow)} />}
                        {"coinsCredited" in r && <Field label="coinsCredited" value={String((r as any).coinsCredited)} />}
                      </div>
                      {(r as any).creditResult && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] text-muted-foreground">credit_topup_atomic result</summary>
                          <pre className="mt-1 overflow-auto rounded bg-background p-2 text-[10px]">{JSON.stringify((r as any).creditResult, null, 2)}</pre>
                        </details>
                      )}
                      {(r as any).raw && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] text-muted-foreground">Bakong raw response</summary>
                          <pre className="mt-1 overflow-auto rounded bg-background p-2 text-[10px]">{JSON.stringify((r as any).raw, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function Pill({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" }) {
  const cls =
    tone === "ok" ? "bg-primary/15 text-primary ring-primary/30"
    : tone === "bad" ? "bg-destructive/15 text-destructive ring-destructive/30"
    : "bg-amber-500/15 text-amber-600 ring-amber-500/30";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cls}`}>{label}</span>;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono text-[10px] break-all" : "text-xs"} font-medium`}>{value}</span>
    </div>
  );
}
