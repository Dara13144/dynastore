import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Loader2,
  Wallet,
  Check,
  Download,
  ShieldCheck,
  Link as LinkIcon,
  Zap,
  Minus,
  Plus,
  Coins,
  QrCode,
  Mail,
  Copy,
} from "lucide-react";
import { useStore, StoreProvider, type Game } from "@/lib/store";
import { getGameDownloadUrl } from "@/lib/games.functions";
import { purchaseGame } from "@/lib/payment.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TutorialVideo } from "@/components/TutorialVideo";
import { useStockCounts } from "@/hooks/useStockCounts";

export const Route = createFileRoute("/games/$id")({
  head: () => ({ meta: [{ title: "ផលិតផល — Dyna Store" }] }),
  component: () => (
    <StoreProvider>
      <GameDetailPage />
    </StoreProvider>
  ),
});

type CreateResp = { paymentId?: string; qr?: string; qrImage?: string; amount?: number; error?: string };
type StatusResp = { status?: string; paidAt?: string | null; error?: string };

function GameDetailPage() {
  const { id } = Route.useParams();
  const { authed, balance, games, library, refreshWallet, refreshLibrary } = useStore();
  const navigate = useNavigate();
  const game: Game | undefined = games.find((g) => g.id === id);
  const owned = library.some((l) => l.game_id === id && l.kind === "owned");

  const [downloading, setDownloading] = useState(false);
  const downloadFn = useServerFn(getGameDownloadUrl);
  const purchaseFn = useServerFn(purchaseGame);

  // Form state
  const [email, setEmail] = useState("");
  const [qty, setQty] = useState(1);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [redeemCoins, setRedeemCoins] = useState(false);

  // Checkout state
  const [busy, setBusy] = useState(false);
  const [khqrOpen, setKhqrOpen] = useState(false);
  const [payment, setPayment] = useState<CreateResp | null>(null);
  const [khqrStatus, setKhqrStatus] = useState<string>("pending");
  const [delivered, setDelivered] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (!game) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <Link to="/" className="text-xs hover:text-foreground">ត្រឡប់ទៅទំព័រដើម</Link>
      </div>
    );
  }

  const unitPrice = game.price_coins;
  const { counts: stockMap, refresh: refreshStock } = useStockCounts([id]);
  const stock = stockMap[id] ?? 0;
  const subtotal = unitPrice * qty;
  const couponDiscount = couponApplied ? Math.min(subtotal * 0.1, subtotal) : 0;
  const userCoins = Math.floor(balance);
  const coinsRedeemValue = redeemCoins ? Math.min(userCoins, subtotal - couponDiscount) : 0;
  const total = Math.max(0, subtotal - couponDiscount - coinsRedeemValue);
  const enough = balance >= total;

  const requireAuth = () => {
    if (!authed) { navigate({ to: "/login" }); return false; }
    return true;
  };

  const validate = () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { toast.error("សូមបញ្ចូល Email ត្រឹមត្រូវ"); return false; }
    return true;
  };

  const applyCoupon = () => {
    if (!coupon.trim()) return;
    if (coupon.trim().toUpperCase() === "DYNA10") {
      setCouponApplied(true);
      toast.success("Coupon applied: -10%");
    } else {
      setCouponApplied(false);
      toast.error("Invalid coupon");
    }
  };

  const finalizeDelivery = (content: string | null) => {
    setDelivered(content);
    refreshWallet();
    refreshLibrary();
    refreshStock();
    window.dispatchEvent(new Event("stock:refresh"));
  };

  const payWithBalance = async () => {
    if (!requireAuth() || !validate()) return;
    if (!enough) { toast.error("Insufficient balance"); return; }
    setBusy(true);
    try {
      const r = await purchaseFn({ data: { gameId: game.id, qty } });
      if (!r.ok) { toast.error(r.message || "Failed"); return; }
      finalizeDelivery(r.deliveredContent ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const startPolling = (pid: string) => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/payment/status/${pid}`);
        const data: StatusResp = await res.json();
        setKhqrStatus(data.status ?? "pending");
        if (data.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          window.dispatchEvent(new Event("wallet:refresh"));
          setTimeout(async () => {
            await refreshWallet();
            try {
              const r = await purchaseFn({ data: { gameId: game.id, qty } });
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

  const payWithKhqr = async () => {
    if (!requireAuth() || !validate()) return;
    setBusy(true);
    setKhqrOpen(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`/api/payment/create?amount=${encodeURIComponent(total)}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data: CreateResp = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setPayment(data);
      startPolling(data.paymentId!);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate KHQR");
      setKhqrOpen(false);
    } finally { setBusy(false); }
  };

  const download = async (via: "direct" | "link") => {
    setDownloading(true);
    try {
      const { url } = await downloadFn({ data: { gameId: game.id, via } });
      if (via === "direct") {
        const a = document.createElement("a"); a.href = url; a.rel = "noopener"; a.click();
        toast.success("កំពុងទាញយកឯកសារ…");
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
        toast.success("បើកតំណទាញយក…");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "បរាជ័យ";
      toast.error(msg === "file_unavailable" ? "មិនទាន់មានឯកសារ — សូមទាក់ទង Admin" : msg);
    } finally { setDownloading(false); }
  };

  // Delivered confirmation panel
  if (delivered !== null) {
    const content = delivered;
    return (
      <div className="min-h-screen bg-background">
        <Header authed={authed} balance={balance} />
        <main className="container mx-auto px-4 py-10 max-w-2xl">
          <div className="rounded-2xl border border-emerald-500/40 bg-card p-8 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 grid place-items-center">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <h1 className="font-display text-3xl mt-4">Payment confirmed</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Credentials sent to <span className="text-foreground">{email}</span> and saved in your{" "}
              <Link to="/account" className="text-primary underline">account</Link>.
            </p>
            <div className="mt-6 rounded-xl border border-border bg-background p-5 text-left">
              <div className="font-semibold">{game.title}</div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="flex-1 text-xs font-mono truncate">{content || "Saved in your account"}</code>
                {content && (
                  <button onClick={() => { navigator.clipboard.writeText(content); toast.success("Copied"); }} className="text-muted-foreground hover:text-foreground" aria-label="Copy">
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/account" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">View in account</Link>
              <Link to="/" className="rounded-xl border border-border px-5 py-2.5 text-sm hover:bg-accent">Back to home</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header authed={authed} balance={balance} />

      <main className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* LEFT: image */}
          <div className="rounded-2xl glass overflow-hidden border border-border/60 h-fit md:sticky md:top-20">
            <img src={game.image} alt={game.title} className="w-full aspect-square object-cover" />
          </div>

          {/* RIGHT: product info + checkout */}
          <div className="space-y-5">
            <div className="rounded-2xl glass border border-border/60 p-5 space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 text-[11px] font-semibold">
                  <Check className="h-3 w-3" /> In Stock
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 px-2.5 py-1 text-[11px] font-semibold">
                  <Zap className="h-3 w-3" /> Instant
                </span>
                {game.badge && (
                  <span className="rounded-full bg-primary/15 text-primary px-2.5 py-1 text-[11px] font-semibold">
                    {game.badge}
                  </span>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{game.category}</div>
                <h1 className="font-display text-3xl mt-1 gradient-text">{game.title}</h1>
                <div className="mt-2 text-emerald-400 font-bold text-2xl">${unitPrice.toFixed(2)}</div>
              </div>

              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {game.description || "មិនមានការពិពណ៌នា"}
              </p>
            </div>

            <TutorialVideo slug="buy_game" />

            {(
              <>
                {/* Select Duration / Variant */}
                <div className="rounded-2xl glass border border-border/60 p-5 space-y-3">
                  <div className="text-sm font-semibold">Select Duration:</div>
                  <div className="rounded-xl border-2 border-emerald-500/60 bg-emerald-500/5 px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">1 Account</div>
                      <div className="text-emerald-400 text-[11px] font-semibold">In Stock ({stock})</div>
                    </div>
                    <div className="text-emerald-400 font-bold">${unitPrice.toFixed(2)}</div>
                  </div>
                </div>


                {/* Quantity */}
                <div className="rounded-2xl glass border border-border/60 p-5 flex items-center justify-between">
                  <span className="text-sm font-semibold">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-9 w-9 rounded-lg border border-emerald-500/60 text-emerald-400 grid place-items-center hover:bg-emerald-500/10">
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={stock}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Math.min(stock, Number(e.target.value) || 1)))}
                      className="h-9 w-14 rounded-lg border border-border bg-background text-center text-sm"
                    />
                    <button onClick={() => setQty(Math.min(stock, qty + 1))} className="h-9 w-9 rounded-lg border border-emerald-500/60 text-emerald-400 grid place-items-center hover:bg-emerald-500/10">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Coupon */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={coupon}
                    onChange={(e) => { setCoupon(e.target.value); setCouponApplied(false); }}
                    placeholder="COUPON CODE"
                    className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:border-primary uppercase placeholder:uppercase"
                  />
                  <button onClick={applyCoupon} className="rounded-xl bg-emerald-500 text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90">
                    Apply
                  </button>
                </div>

                {/* Redeem Coins */}
                <button
                  onClick={() => setRedeemCoins(!redeemCoins)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-500/15 grid place-items-center">
                      <Coins className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold">Redeem Coins</div>
                      <div className="text-[11px] text-muted-foreground">You have {userCoins} coins</div>
                    </div>
                  </div>
                  <div className={`relative h-6 w-11 rounded-full transition ${redeemCoins ? "bg-emerald-500" : "bg-muted"}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${redeemCoins ? "left-[1.375rem]" : "left-0.5"}`} />
                  </div>
                </button>

                {/* Total */}
                <div className="rounded-2xl glass border border-border/60 p-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Amount</div>
                  <div className="mt-1 text-emerald-400 font-bold text-3xl">${total.toFixed(2)}</div>
                  {(couponDiscount > 0 || coinsRedeemValue > 0) && (
                    <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                      <div>Subtotal: ${subtotal.toFixed(2)}</div>
                      {couponDiscount > 0 && <div className="text-emerald-400">Coupon: -${couponDiscount.toFixed(2)}</div>}
                      {coinsRedeemValue > 0 && <div className="text-amber-400">Coins: -${coinsRedeemValue.toFixed(2)}</div>}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  <button
                    onClick={payWithBalance}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Buy with Balance
                  </button>
                  <button
                    onClick={payWithKhqr}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    Pay with KHQR
                  </button>
                  {!enough && authed && (
                    <p className="text-[11px] text-amber-500 text-center">Not enough balance — use KHQR or top up.</p>
                  )}
                </div>

                <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> ឯកសារត្រូវបានចាក់សោសុវត្ថិភាព — តែម្ចាស់ហ្គេមអាចទាញយក
                </div>
              </>
            )}
          </div>
        </div>

        <MediaSection
          screenshots={game.screenshots ?? []}
          videoUrl={game.preview_video_url ?? null}
          title={game.title}
        />
      </main>

      {/* KHQR modal */}
      {khqrOpen && (
        <button
          onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setKhqrOpen(false); setPayment(null); setKhqrStatus("pending"); }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4 cursor-zoom-out"
          aria-label="Close"
        >
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl bg-card border border-border p-6 max-w-sm w-full text-center space-y-3 cursor-default">
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
            <div className="text-lg font-bold text-emerald-400">${total.toFixed(2)}</div>
            <button
              onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setKhqrOpen(false); setPayment(null); setKhqrStatus("pending"); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </button>
      )}
    </div>
  );
}

function Header({ authed, balance }: { authed: boolean; balance: number }) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> ទំព័រដើម
        </Link>
        {authed && (
          <span className="text-xs text-primary inline-flex items-center gap-1">
            <Coins className="h-3 w-3" /> {balance.toLocaleString()}
          </span>
        )}
      </div>
    </header>
  );
}

function MediaSection({
  screenshots,
  videoUrl,
  title,
}: {
  screenshots: string[];
  videoUrl: string | null;
  title: string;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const hasShots = screenshots.length > 0;
  const hasVideo = !!videoUrl;

  return (
    <section className="mt-10 space-y-8">
      <div>
        <h2 className="font-semibold text-sm mb-3">វីដេអូមើលជាមុន</h2>
        {hasVideo ? (
          <div className="rounded-2xl overflow-hidden border border-border/60 glass">
            <video src={videoUrl!} controls preload="metadata" className="w-full aspect-video bg-black">
              <track kind="captions" />
            </video>
          </div>
        ) : (
          <EmptyMedia label="មិនទាន់មានវីដេអូ preview" />
        )}
      </div>

      <div>
        <h2 className="font-semibold text-sm mb-3">រូបភាពហ្គេម ({screenshots.length})</h2>
        {hasShots ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {screenshots.map((src, i) => (
              <button
                key={src + i}
                onClick={() => setLightbox(src)}
                className="group relative aspect-video rounded-xl overflow-hidden border border-border/60 glass focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img src={src} alt={`${title} screenshot ${i + 1}`} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              </button>
            ))}
          </div>
        ) : (
          <EmptyMedia label="មិនទាន់មានរូបភាព" />
        )}
      </div>

      {lightbox && (
        <button onClick={() => setLightbox(null)} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4 cursor-zoom-out" aria-label="Close preview">
          <img src={lightbox} alt="preview" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </button>
      )}
    </section>
  );
}

function EmptyMedia({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 grid place-items-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
