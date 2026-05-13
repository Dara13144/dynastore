import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Wallet, Star, Check, Download, ShieldCheck, Package } from "lucide-react";
import { useStore, StoreProvider, type Game } from "@/lib/store";
import { purchaseGame } from "@/lib/payment.functions";
import { getGameDownloadUrl } from "@/lib/games.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/games/$id")({
  head: () => ({ meta: [{ title: "ផលិតផល — Dyna Store" }] }),
  component: () => (<StoreProvider><GameDetailPage /></StoreProvider>),
});

function GameDetailPage() {
  const { id } = Route.useParams();
  const { authed, balance, games, library, refreshWallet, refreshLibrary, toggleWishlist } = useStore();
  const navigate = useNavigate();
  const game: Game | undefined = games.find((g) => g.id === id);
  const owned = library.some((l) => l.game_id === id && l.kind === "owned");
  const wished = library.some((l) => l.game_id === id && l.kind === "wishlist");

  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const purchaseFn = useServerFn(purchaseGame);
  const downloadFn = useServerFn(getGameDownloadUrl);

  if (!game) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <Link to="/" className="text-xs hover:text-foreground">ត្រឡប់ទៅទំព័រដើម</Link>
      </div>
    );
  }

  const buy = async () => {
    if (!authed) { navigate({ to: "/login" }); return; }
    if (balance < game.price_coins) { toast.error("Balance មិនគ្រប់គ្រាន់"); return; }
    setBusy(true);
    try {
      const r = await purchaseFn({ data: { gameId: game.id } });
      if (r.ok) { toast.success(r.message === "already_owned" ? "មានរួចហើយ" : "ទិញបានជោគជ័យ!"); await Promise.all([refreshWallet(), refreshLibrary()]); }
      else toast.error(r.message || "បរាជ័យ");
    } catch (e) { toast.error(e instanceof Error ? e.message : "បរាជ័យ"); }
    finally { setBusy(false); }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const { url } = await downloadFn({ data: { gameId: game.id } });
      const a = document.createElement("a");
      a.href = url; a.rel = "noopener"; a.click();
      toast.success("កំពុងទាញយកឯកសារ…");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "បរាជ័យ";
      toast.error(msg === "file_unavailable" ? "មិនទាន់មានឯកសារ — សូមទាក់ទង Admin" : msg);
    } finally { setDownloading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="h-4 w-4" /> ទំព័រដើម</Link>
          {authed && <span className="text-xs text-primary inline-flex items-center gap-1"><Wallet className="h-3 w-3" /> {balance.toLocaleString()}</span>}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl glass overflow-hidden border border-border/60">
            <img src={game.image} alt={game.title} className="w-full aspect-[16/10] object-cover" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{game.category}</div>
              <h1 className="font-display text-3xl mt-1 gradient-text">{game.title}</h1>
              {game.badge && <span className="mt-2 inline-block rounded-full bg-primary/15 text-primary px-2.5 py-0.5 text-[10px] font-semibold">{game.badge}</span>}
            </div>

            <div className="rounded-2xl glass border border-border/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">តម្លៃ</span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary text-lg"><Wallet className="h-4 w-4" /> {game.price_coins.toLocaleString()}</span>
              </div>
              {authed && !owned && (
                <div className="text-[11px] text-muted-foreground">Balance អ្នក: <span className={balance >= game.price_coins ? "text-emerald-400" : "text-amber-400"}>{balance.toLocaleString()}</span></div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {owned ? (
                <button onClick={download} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  ទាញយកឯកសារ (.zip)
                </button>
              ) : (
                <button onClick={buy} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  ទិញឥឡូវ
                </button>
              )}
              <button
                onClick={async () => {
                  if (!authed) { navigate({ to: "/login" }); return; }
                  const r = await toggleWishlist(game.id);
                  if (r.error) toast.error(r.error); else toast.success(r.added ? "បានបន្ថែមទៅបញ្ជី" : "បានដក");
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm hover:bg-accent ${wished ? "border-primary text-primary" : "border-border"}`}
              >
                <Star className={`h-4 w-4 ${wished ? "fill-primary" : ""}`} /> {wished ? "បានរក្សាទុក" : "រក្សាទុក"}
              </button>
            </div>

            {owned && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300 inline-flex items-center gap-2">
                <Check className="h-3.5 w-3.5" /> អ្នកមានហ្គេមនេះ — អាចទាញយកបានគ្រប់ពេល
              </div>
            )}

            <div>
              <h2 className="font-semibold text-sm mb-2">លម្អិត</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{game.description || "មិនមានការពិពណ៌នា"}</p>
            </div>

            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-emerald-400" /> ឯកសារត្រូវបានចាក់សោសុវត្ថិភាព — តែម្ចាស់ហ្គេមអាចទាញយក</div>
          </div>
        </div>
      </main>
    </div>
  );
}
