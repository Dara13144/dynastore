import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Wallet, Loader2, Check, Copy, Mail, QrCode } from "lucide-react";
import { z } from "zod";
import { StoreProvider, useStore, type Game } from "@/lib/store";
import { purchaseGame } from "@/lib/payment.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const searchSchema = z.object({ gameId: z.string().min(1).max(64) });

export const Route = createFileRoute("/checkout")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Checkout — DYNASTORE" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <StoreProvider>
      <CheckoutPage />
    </StoreProvider>
  ),
});

type CreateResp = { paymentId?: string; qr?: string; qrImage?: string; amount?: number; error?: string };
type StatusResp = { status?: string; paidAt?: string | null; error?: string };

function CheckoutPage() {
  const { gameId } = Route.useSearch();
  const navigate = useNavigate();
  const { authed, balance, games, library, refreshWallet, refreshLibrary, session } = useStore();
  const game: Game | undefined = games.find((g) => g.id === gameId);
  const alreadyOwned = library.some((l) => l.game_id === gameId && l.kind === "owned");

  const purchaseFn = useServerFn(purchaseGame);

  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"choose" | "khqr">("choose");
  const [payment, setPayment] = useState<CreateResp | null>(null);
  const [khqrStatus, setKhqrStatus] = useState<string>("pending");
  const [delivered, setDelivered] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authed && session === null) navigate({ to: "/login" });
  }, [authed, session, navigate]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (!game) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const price = game.price_coins;
  const enough = balance >= price;

  const finalizeDelivery = (content: string | null) => {
    setDelivered(content);
    setOrderId(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
    refreshWallet();
    refreshLibrary();
  };

  const payWithBalance = async () => {
    if (!enough) { toast.error("Insufficient balance"); return; }
    setBusy(true);
    try {
      const r = await purchaseFn({ data: { gameId: game.id } });
      if (!r.ok) { toast.error(r.message || "Failed"); return; }
      finalizeDelivery(r.deliveredContent ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const generateKhqr = async () => {
    setBusy(true);
    setMode("khqr");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`/api/payment/create?amount=${encodeURIComponent(price)}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data: CreateResp = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setPayment(data);
      startPolling(data.paymentId!);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate KHQR");
      setMode("choose");
    } finally { setBusy(false); }
  };

  const startPolling = (id: string) => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/payment/status/${id}`);
        const data: StatusResp = await res.json();
        setKhqrStatus(data.status ?? "pending");
        if (data.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          window.dispatchEvent(new Event("wallet:refresh"));
          // Wait briefly for wallet credit, then auto-purchase
          setTimeout(async () => {
            await refreshWallet();
            try {
              const r = await purchaseFn({ data: { gameId: game.id } });
              if (r.ok) finalizeDelivery(r.deliveredContent ?? null);
              else toast.error(r.message || "Auto-delivery failed");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Auto-delivery failed");
            }
          }, 1500);
        }
      } catch {/* ignore */}
    };
    tick();
    pollRef.current = setInterval(tick, 5000);
  };

  // ===== Confirmed view =====
  if (delivered !== null || alreadyOwned) {
    const content = delivered ?? "";
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="container mx-auto px-4 h-14 flex items-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-10 max-w-2xl">
          <div className="rounded-2xl border border-emerald-500/40 bg-card p-8 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 grid place-items-center">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <h1 className="font-display text-3xl mt-4">Payment confirmed</h1>
            <div className="text-xs text-muted-foreground mt-1">Order {orderId || "ORD-OK"}</div>
            <p className="text-sm text-muted-foreground mt-3">
              Your credentials are below. They're also saved in your{" "}
              <Link to="/account" className="text-primary underline">account page</Link>.
            </p>

            <div className="mt-6 rounded-xl border border-border bg-background p-5 text-left">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{game.title}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">1 account</div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="flex-1 text-xs font-mono truncate">{content || "Saved in your account"}</code>
                {content && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(content); toast.success("Copied"); }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
              {content && (
                <button
                  onClick={() => { navigator.clipboard.writeText(content); toast.success("Copied email + password"); }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Copy email + password
                </button>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/account"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                View in account
              </Link>
              <Link
                to="/"
                className="rounded-xl border border-border px-5 py-2.5 text-sm hover:bg-accent"
              >
                Back to home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ===== Checkout view =====
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          {authed && (
            <span className="text-xs text-primary inline-flex items-center gap-1">
              <Wallet className="h-3 w-3" /> ${balance.toFixed(2)}
            </span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl">Checkout</h1>
          <p className="text-sm text-muted-foreground mt-1">Review your order and choose a payment method.</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{game.title} × 1</span>
            <span className="text-primary">${price.toFixed(2)}</span>
          </div>
          <div className="my-4 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-semibold text-lg">${price.toFixed(2)}</span>
          </div>

          {mode === "choose" && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Wallet className="h-4 w-4" /> Wallet balance
                </span>
                <span className={`font-semibold ${enough ? "text-emerald-500" : "text-amber-500"}`}>
                  ${balance.toFixed(2)}
                </span>
              </div>

              <button
                onClick={payWithBalance}
                disabled={busy || !enough}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-primary px-5 py-3 text-sm font-semibold hover:bg-primary/20 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Pay with Balance (${price.toFixed(2)})
              </button>

              {!enough && (
                <p className="text-[11px] text-amber-500 text-center">
                  Not enough balance — generate KHQR or top up first.
                </p>
              )}

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full h-px bg-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-3 text-[11px] text-muted-foreground">OR</span></div>
              </div>

              <button
                onClick={generateKhqr}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Generate KHQR
              </button>
            </div>
          )}

          {mode === "khqr" && (
            <div className="mt-6 text-center space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Scan with Bakong / KHQR app</div>
              {payment?.qrImage ? (
                <img src={payment.qrImage} alt="KHQR" className="w-64 h-64 mx-auto rounded-lg border bg-white p-2" />
              ) : (
                <div className="h-64 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              )}
              <div className="text-sm">
                Status:{" "}
                <span className={khqrStatus === "paid" ? "text-emerald-500 font-semibold" : "text-amber-500"}>
                  {khqrStatus}
                </span>
              </div>
              <button
                onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setMode("choose"); setPayment(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
