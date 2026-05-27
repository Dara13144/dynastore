import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  LogOut,
  Wallet,
  RefreshCw,
  Plus,
  Clock,
  History,
  Package,
  Check,
  X as XIcon,
  Loader2,
} from "lucide-react";
import { StoreProvider, useStore } from "@/lib/store";
import { useSession } from "@/hooks/use-session";
import { TopupModal } from "@/components/TopupModal";
import { SiteHeader } from "@/components/SiteHeader";
import { listMyTopupRequests } from "@/lib/topup.functions";
import { getMyDeliveries } from "@/lib/stock.functions";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — DYNASTORE" },
      {
        name: "description",
        content: "Manage your DYNASTORE wallet balance and view transactions.",
      },
      { property: "og:title", content: "My account — DYNASTORE" },
      {
        property: "og:description",
        content: "Manage your DYNASTORE wallet balance and view transactions.",
      },
      { property: "og:url", content: "https://dynastore.lovable.app/account" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dynastore.lovable.app/account" }],
  }),

  component: () => (
    <StoreProvider>
      <AccountPage />
    </StoreProvider>
  ),
});

const PRESETS = [10, 25, 50, 100];

type TopupRow = Awaited<ReturnType<typeof listMyTopupRequests>>[number];

function AccountPage() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { profile, signOut, balance, refreshWallet } = useStore();
  const listFn = useServerFn(listMyTopupRequests);

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupInitialAmount, setTopupInitialAmount] = useState<number | undefined>();
  const [topupAutoStart, setTopupAutoStart] = useState(false);

  const [customAmount, setCustomAmount] = useState<string>("");
  const [history, setHistory] = useState<TopupRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    if (!sessionLoading && !session) navigate({ to: "/login" });
  }, [sessionLoading, session, navigate]);

  const reloadHistory = async () => {
    try {
      setLoadingHistory(true);
      const h = await listFn();
      setHistory(h);
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    reloadHistory();
    const onRefresh = () => {
      reloadHistory();
    };
    window.addEventListener("wallet:refresh", onRefresh);
    return () => window.removeEventListener("wallet:refresh", onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const user = session.user;
  const balanceUsd = balance; // 1 coin = $1 (coins_per_usd default 1)

  const openTopup = (amount?: number, autoStart = false) => {
    setTopupInitialAmount(amount);
    setTopupAutoStart(autoStart);
    setTopupOpen(true);
  };

  const handleCustomTopup = () => {
    const n = Number(customAmount);
    if (!Number.isFinite(n) || n < 0.01 || n > 100) {
      showToast("Enter an amount between $0.01 and $100");
      return;
    }
    openTopup(n, true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader onTopup={() => openTopup()} />


      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl">My account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your wallet balance and view transactions.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT — Balance + Top up */}
          <div className="space-y-6">
            {/* Wallet balance */}
            <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-background p-6">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" /> Wallet balance
              </div>
              <div className="mt-3 font-display text-5xl tabular-nums">
                ${balanceUsd.toFixed(2)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Use your balance to pay at checkout.
              </div>
              <button
                onClick={refreshWallet}
                className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] hover:bg-accent"
                aria-label="Refresh balance"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </section>

            {/* Top up */}
            <section className="rounded-2xl border border-border/60 bg-card p-6">
              <h2 className="font-semibold">Top up</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Pick a preset or enter a custom amount.
              </p>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => openTopup(p, true)}
                    className="rounded-xl border border-border/60 bg-background/40 px-3 py-3 text-sm font-semibold hover:border-primary/50 hover:bg-primary/10 transition-colors"
                  >
                    +${p.toFixed(2)}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    min={0.01}
                    max={100}
                    step={0.01}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Custom amount ($0.01 – $100)"
                    className="w-full rounded-xl bg-input pl-7 pr-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleCustomTopup}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Top up
                </button>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">
                Paid instantly via Bakong KHQR — scan with ABA / ACLEDA / Wing / Bakong.
              </p>
            </section>
          </div>

          {/* RIGHT — Transactions */}
          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold">Transactions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Most recent first.</p>
              </div>
              <button
                onClick={reloadHistory}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] hover:bg-accent"
              >
                <History className="h-3 w-3" /> View all
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-16 grid place-items-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-16 grid place-items-center text-center">
                <div className="h-10 w-10 rounded-full bg-muted/50 grid place-items-center text-muted-foreground mb-3">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="text-sm font-medium">No transactions yet</div>
                <div className="text-xs text-muted-foreground mt-1">Top up to get started.</div>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {history.map((t) => (
                  <TxnRow key={t.id} row={t} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Delivered accounts (placeholder) */}
        <section className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="font-semibold flex items-center gap-2 text-primary">
            <Package className="h-4 w-4" /> Delivered accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Auto-delivered credentials from your purchases. Keep them safe.
          </p>
          <div className="py-12 grid place-items-center text-center">
            <div className="h-10 w-10 rounded-full bg-muted/50 grid place-items-center text-muted-foreground mb-3">
              <Package className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium">No deliveries yet</div>
            <div className="text-xs text-muted-foreground mt-1">
              Buy a product to receive an account automatically.
            </div>
          </div>
        </section>

        {/* Account info / actions */}
        <section className="mt-6 rounded-2xl border border-border/60 bg-card p-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground font-medium">
              {profile.display_name || "Player"}
            </span>{" "}
            · {user.email}
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 text-destructive px-4 py-2 text-xs hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </section>
      </main>

      {topupOpen && (
        <TopupModal
          onClose={() => {
            setTopupOpen(false);
            setTopupAutoStart(false);
            reloadHistory();
          }}
          onToast={showToast}
          initialAmount={topupInitialAmount}
          autoStart={topupAutoStart}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] rounded-full bg-foreground text-background px-5 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function TxnRow({ row }: { row: TopupRow }) {
  const date = row.created_at ? new Date(row.created_at) : null;
  const status = row.status as "pending" | "approved" | "rejected";
  return (
    <li className="py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${
            status === "approved"
              ? "bg-emerald-500/15 text-emerald-400"
              : status === "rejected"
                ? "bg-destructive/15 text-destructive"
                : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {status === "approved" ? (
            <Check className="h-4 w-4" />
          ) : status === "rejected" ? (
            <XIcon className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            Top up · ${Number(row.amount_usd).toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {date ? date.toLocaleString() : "—"} ·{" "}
            <span className="capitalize">{status}</span>
          </div>
        </div>
      </div>
      <div
        className={`text-sm font-semibold tabular-nums ${
          status === "approved" ? "text-emerald-400" : "text-muted-foreground"
        }`}
      >
        {status === "approved" ? "+" : ""}${Number(row.amount_usd).toFixed(2)}
      </div>
    </li>
  );
}
