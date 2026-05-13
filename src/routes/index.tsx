import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Settings, LogIn, LogOut, Star, Send, Gamepad2, Sparkles, X, Plus, Library, Check, Loader2, AlertTriangle, RefreshCw, Wallet, Copy, ShieldCheck, Upload, Receipt as ReceiptIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitManualTopup } from "@/lib/topup.functions";
import { StoreProvider, useStore, type Game } from "@/lib/store";
import { createTopup, checkTopup, purchaseGame } from "@/lib/payment.functions";
import heroImg from "@/assets/hero-arcade.jpg";
import logoD from "@/assets/dyna-logo.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dyna Store — ទិញហ្គេមដោយ KHQR" },
      { name: "description", content: "ទិញហ្គេម PC និង Console ដោយ Bakong KHQR។ បន្ថែម Balance ហើយទាញយកហ្គេមបានភ្លាមៗបន្ទាប់ពីការទូទាត់។" },
      { property: "og:title", content: "Dyna Store — ទិញហ្គេមដោយ KHQR" },
      { property: "og:description", content: "ហាងហ្គេម PC និង Console ជាមួយការទូទាត់តាម Bakong KHQR, ABA និងធនាគារផ្សេងៗ — បន្ថែម Balance ភ្លាមៗ ហើយទាញយកហ្គេមបានភ្លាមៗ។" },
      { property: "og:url", content: "https://dynastore.lovable.app/" },
    ],
    links: [
      { rel: "preload", as: "image", href: heroImg, fetchpriority: "high" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bayon&family=Noto+Sans+Khmer:wght@400;500;600;700&display=swap" },
      { rel: "canonical", href: "https://dynastore.lovable.app/" },
    ],
  }),
  component: () => (
    <StoreProvider>
      <Page />
    </StoreProvider>
  ),
});

function Page() {
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2400); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onSettings={() => setSettingsOpen(true)} onTopup={() => setTopupOpen(true)} />
      <main>
        <Hero />
        <GamesSection onToast={showToast} onTopup={() => setTopupOpen(true)} />
        <DealsBanner />
        <Recommendations onToast={showToast} />
      </main>
      <Footer />

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onToast={showToast} />}
      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} onToast={showToast} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] rounded-full bg-foreground text-background px-5 py-2 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}

function Header({ onSettings, onTopup }: { onSettings: () => void; onTopup: () => void }) {
  const { authed, signOut, balance, isAdmin } = useStore();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoD} alt="Dyna Store" className="h-9 w-9 rounded-xl" />
          <span className="font-display text-xl gradient-text">Dyna Store</span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
          <a href="#games" className="hover:text-foreground transition">ហ្គេម</a>
          <a href="#deals" className="hover:text-foreground transition">ប្រូម៉ូសិន</a>
          <a href="#community" className="hover:text-foreground transition">សហគមន៍</a>
          {authed && (
            <button onClick={onTopup} className="hover:text-primary transition inline-flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> បន្ថែម Balance
            </button>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {authed && (
            <button onClick={onTopup} title="Topup" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Topup
            </button>
          )}
          {authed && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Wallet className="h-3.5 w-3.5" /> {balance.toLocaleString()}
            </span>
          )}
          {authed && (
            <Link to="/library" className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <Library className="h-3.5 w-3.5" /> បណ្ណាល័យ
            </Link>
          )}
          {authed && (
            <Link to="/payments" className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              ការទូទាត់
            </Link>
          )}
          <button onClick={onSettings} className="p-2 rounded-full hover:bg-accent transition" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </button>
          {authed ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20">Admin</Link>
              )}
              <Link to="/account" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">គណនី</Link>
              <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                <LogOut className="h-3.5 w-3.5" /> ចេញ
              </button>
            </>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
              <LogIn className="h-3.5 w-3.5" /> ចូល
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg} alt="" width={1920} height={1080} fetchPriority="high" decoding="async" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>
      <div className="relative container mx-auto px-4 py-20 md:py-28 max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground mb-5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> បង់ប្រាក់ភ្លាមៗដោយ Bakong KHQR
        </div>
        <h1 className="font-display text-4xl md:text-6xl tracking-tight">
          <span className="gradient-text">ទិញហ្គេម</span> ដោយ Balance
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          បន្ថែម Balance តាម KHQR ហើយទិញហ្គេម PC/Console ភ្លាមៗ។ 1 USD = 1 Balance។
        </p>
      </div>
    </section>
  );
}

function GamesSection({ onToast, onTopup }: { onToast: (m: string) => void; onTopup: () => void }) {
  const { games } = useStore();
  return (
    <section id="games" className="container mx-auto px-4 py-14">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl md:text-3xl">ហ្គេមពេញនិយម</h2>
          <p className="text-sm text-muted-foreground mt-1">ច្រើនជំនាន់ ច្រើនប្រភេទ — រកមួយដែលសាកសម។</p>
        </div>
        <Gamepad2 className="h-6 w-6 text-primary hidden sm:block" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((g) => <GameCard key={g.id} game={g} onToast={onToast} onTopup={onTopup} />)}
      </div>
    </section>
  );
}

function GameCard({ game, onToast, onTopup }: { game: Game; onToast: (m: string) => void; onTopup: () => void }) {
  const { authed, balance, library, toggleWishlist, refreshWallet, refreshLibrary } = useStore();
  const owned = library.some((l) => l.game_id === game.id && l.kind === "owned");
  const wished = library.some((l) => l.game_id === game.id && l.kind === "wishlist");
  const [busy, setBusy] = useState(false);
  const purchaseFn = useServerFn(purchaseGame);

  const buy = async () => {
    if (!authed) { onToast("សូមចូលគណនីជាមុនសិន"); return; }
    if (balance < game.price_coins) { onToast("Balance មិនគ្រប់គ្រាន់ — សូមបន្ថែម"); onTopup(); return; }
    setBusy(true);
    try {
      const r = await purchaseFn({ data: { gameId: game.id } });
      if (r.ok) { onToast(r.message === "already_owned" ? "អ្នកមានហ្គេមនេះរួចហើយ" : "ទិញបានជោគជ័យ!"); await Promise.all([refreshWallet(), refreshLibrary()]); }
      else if (r.message === "insufficient_balance") { onToast("Balance មិនគ្រប់គ្រាន់"); onTopup(); }
      else onToast(r.message || "បរាជ័យ");
    } catch (e) { onToast(e instanceof Error ? e.message : "បរាជ័យ"); }
    finally { setBusy(false); }
  };

  const wish = async () => {
    if (!authed) { onToast("សូមចូលគណនីជាមុនសិន"); return; }
    const r = await toggleWishlist(game.id);
    if (r.error) onToast(r.error);
    else onToast(r.added ? "បានបន្ថែមទៅបញ្ជី" : "បានដក");
  };

  return (
    <article className="group glass rounded-2xl border border-border/60 overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <Link to="/games/$id" params={{ id: game.id }} className="block relative aspect-[16/10] overflow-hidden">
        <img src={game.image} alt={game.title} className="h-full w-full object-cover transition group-hover:scale-105" />
        {game.badge && <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{game.badge}</span>}
        {owned && <span className="absolute top-3 right-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-white inline-flex items-center gap-1"><Check className="h-3 w-3" /> ជាកម្មសិទ្ធ</span>}
      </Link>
      <div className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{game.category}</div>
        <Link to="/games/$id" params={{ id: game.id }} className="block">
          <h3 className="font-display text-lg mt-0.5 hover:text-primary transition">{game.title}</h3>
        </Link>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{game.description}</p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="inline-flex items-center gap-1 font-semibold text-primary">
              <Wallet className="h-3.5 w-3.5" /> {game.price_coins.toLocaleString()}
            </div>
            {authed && !owned && (
              <div className={`inline-flex items-center gap-1 ${balance >= game.price_coins ? "text-emerald-400" : "text-amber-400"}`}>
                <Wallet className="h-3 w-3" /> Balance: {balance.toLocaleString()}
              </div>
            )}
          </div>
          {authed && !owned && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/40">
              <div className={`h-full transition-all ${balance >= game.price_coins ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${Math.min(100, (balance / game.price_coins) * 100)}%` }} />
            </div>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <button onClick={wish} aria-label={wished ? `ដកចេញពីបញ្ជីចង់លេង — ${game.title}` : `បន្ថែមទៅបញ្ជីចង់លេង — ${game.title}`} aria-pressed={wished} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs hover:bg-accent ${wished ? "border-primary text-primary" : "border-border"}`}>
              <Star className={`h-3.5 w-3.5 ${wished ? "fill-primary" : ""}`} />
            </button>
            {owned ? (
              <button disabled className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 px-3 py-1.5 text-xs font-semibold">មាន</button>
            ) : authed && balance < game.price_coins ? (
              <button onClick={onTopup} className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 text-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-400/20">
                <Plus className="h-3.5 w-3.5" /> បន្ថែម Balance
              </button>
            ) : (
              <button onClick={buy} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ទិញ"}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function DealsBanner() {
  return (
    <section id="deals" className="container mx-auto px-4 py-8">
      <div className="rounded-3xl p-8 md:p-10 text-center" style={{ background: "var(--gradient-hero)" }}>
        <h3 className="font-display text-2xl md:text-3xl text-primary-foreground">ប្រូម៉ូសិនពិសេសសប្តាហ៍នេះ</h3>
        <p className="text-sm md:text-base text-primary-foreground/80 mt-2">បន្ថែម 10 USD នឹងទទួលបាន 10 Balance ភ្លាមៗ។</p>
      </div>
    </section>
  );
}

function Recommendations({ onToast }: { onToast: (m: string) => void }) {
  const { recs, addRec } = useStore();
  const [name, setName] = useState(""); const [game, setGame] = useState(""); const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    addRec({ name: name.trim(), game: game.trim() || "—", text: text.trim() });
    setName(""); setGame(""); setText("");
    onToast("អរគុណចំពោះមតិរបស់អ្នក!");
  };
  return (
    <section id="community" className="container mx-auto px-4 py-14">
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div>
          <h2 className="font-display text-2xl md:text-3xl">មតិសហគមន៍</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">សួរស្តីពីហ្គេមដែលអ្នកចូលចិត្ត។</p>
          <ul className="space-y-3">
            {recs.map((r) => (
              <li key={r.id} className="glass rounded-2xl border border-border/60 p-4 flex gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full grid place-items-center bg-primary/15 text-primary font-semibold">{r.initial}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{r.name} <span className="text-muted-foreground font-normal">· {r.game}</span></div>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <form onSubmit={submit} className="glass rounded-2xl border border-border/60 p-5 space-y-3">
          <h3 className="font-semibold text-sm">ចែករំលែកមតិ</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ឈ្មោះអ្នក" className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          <input value={game} onChange={(e) => setGame(e.target.value)} placeholder="ហ្គេម (ស្រេច)" className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="មតិរបស់អ្នក..." className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary resize-none" />
          <button className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
            <Send className="h-3.5 w-3.5" /> ផ្ញើ
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 mt-10">
      <div className="container mx-auto px-4 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Dyna Store. All rights reserved.
      </div>
    </footer>
  );
}

function SettingsModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { profile, updateProfile, authed } = useStore();
  const [name, setName] = useState(profile.display_name);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!authed) { onToast("សូមចូលគណនីជាមុនសិន"); return; }
    setSaving(true);
    const { error } = await updateProfile({ display_name: name.trim() || "Player" });
    setSaving(false);
    if (error) { onToast(error); return; }
    onToast("បានរក្សាទុក"); onClose();
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl glass border border-border/60 shadow-[var(--shadow-card)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold">ការកំណត់</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">ឈ្មោះបង្ហាញ</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          </div>
          {authed ? (
            <Link to="/account" onClick={onClose} className="block text-xs text-primary hover:underline">មើលគណនីពេញលេញ →</Link>
          ) : (
            <p className="text-xs text-muted-foreground">សូមចូលគណនីដើម្បីរក្សាការកំណត់នៅគ្រប់ឧបករណ៍។</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-full border border-border px-4 py-1.5 text-xs hover:bg-accent">បោះបង់</button>
            <button onClick={save} disabled={saving} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {saving ? "កំពុងរក្សាទុក…" : "រក្សាទុក"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PRESETS = [1, 5, 10, 20, 50];

type TopupStage = "choose" | "creating" | "qr" | "checking" | "paid" | "expired" | "failed";

function TopupModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { authed, balance, refreshWallet } = useStore();
  const [amount, setAmount] = useState(5);
  const [method, setMethod] = useState<"khqr" | "manual">("khqr");
  const [stage, setStage] = useState<TopupStage>("choose");
  const [qr, setQr] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [bakongMd5, setBakongMd5] = useState<string | null>(null);
  const [coins, setCoins] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef<number | null>(null);
  const [debug, setDebug] = useState<{ at: string; status: string; httpStatus: number | null; latencyMs: number | null; payload: unknown; providerMessage?: string | null } | null>(null);
  const [attempts, setAttempts] = useState<Array<{ at: string; status: string; httpStatus: number | null; latencyMs: number | null; payload: unknown; providerMessage?: string | null }>>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const createFn = useServerFn(createTopup);
  const checkFn = useServerFn(checkTopup);

  const stopPoll = () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; } setPolling(false); };
  useEffect(() => () => stopPoll(), []);
  useEffect(() => {
    if (stage !== "qr") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  // auto-mark expired when timer hits 0
  useEffect(() => {
    if (stage === "qr" && expiresAt && now >= expiresAt) { stopPoll(); setStage("expired"); }
  }, [stage, expiresAt, now]);

  const recordAttempt = (status: string, payload: unknown, httpStatus: number | null = null, latencyMs: number | null = null, providerMessage: string | null = null) => {
    const entry = { at: new Date().toISOString(), status, httpStatus, latencyMs, payload, providerMessage };
    setDebug(entry);
    setAttempts((prev) => [entry, ...prev].slice(0, 10));
  };

  const start = async (forceNew = false) => {
    if (!authed) { onToast("សូមចូលគណនីជាមុនសិន"); return; }
    setErrorMsg(null);
    setStage("creating");
    try {
      const r = await createFn({ data: { amountUsd: amount, forceNew } });
      setQr(r.qr); setOrderId(r.orderId); setBakongMd5(r.bakongMd5); setCoins(r.balance); setExpiresAt(new Date(r.expiresAt).getTime());
      const dataUrl = await QRCode.toDataURL(r.qr, { width: 320, margin: 1 });
      setQrDataUrl(dataUrl);
      setStage("qr");
      setPolling(true);
      pollRef.current = window.setInterval(async () => {
        try {
          const c = await checkFn({ data: { orderId: r.orderId } });
          setPollCount((n) => n + 1);
          recordAttempt(c.status, c.debug ?? c, c.debug?.httpStatus ?? null, c.debug?.latencyMs ?? null, c.debug?.providerMessage ?? null);
          if (c.status === "paid") {
            stopPoll(); setStage("paid"); await refreshWallet();
            onToast(`បានបន្ថែម ${r.balance.toLocaleString()} Balance!`);
          } else if (c.status === "expired") {
            stopPoll(); setStage("expired");
          }
        } catch (e) {
          recordAttempt("error", e instanceof Error ? e.message : String(e));
        }
      }, 2500) as unknown as number;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "បរាជ័យបង្កើត KHQR");
      setStage("failed");
    }
  };

  // Realtime: flip the UI the moment the transaction row turns paid/completed,
  // without waiting for the next poll tick.
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`tx-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `order_id=eq.${orderId}` },
        async (payload) => {
          const newStatus = (payload.new as { status?: string } | null)?.status;
          if (newStatus === "paid" || newStatus === "completed") {
            stopPoll();
            await refreshWallet();
            recordAttempt("paid", payload.new, null, null, "realtime_update");
            setStage("paid");
            onToast(`បានបន្ថែម ${coins.toLocaleString()} Balance!`);
          } else if (newStatus === "expired" || newStatus === "cancelled" || newStatus === "failed") {
            stopPoll();
            setStage(newStatus === "expired" ? "expired" : "failed");
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
    if (!orderId) return;
    setStage("checking");
    try {
      const c = await checkFn({ data: { orderId } });
      setPollCount((n) => n + 1);
      recordAttempt(c.status, c.debug ?? c, c.debug?.httpStatus ?? null, c.debug?.latencyMs ?? null, c.debug?.providerMessage ?? null);
      if (c.status === "paid") { stopPoll(); setStage("paid"); await refreshWallet(); onToast(`បានបន្ថែម ${coins.toLocaleString()} Balance!`); }
      else if (c.status === "expired") { stopPoll(); setStage("expired"); }
      else { setStage("qr"); onToast(c.debug?.providerMessage ?? "មិនទាន់ទទួលបានការបង់ប្រាក់"); }
    } catch (e) {
      recordAttempt("error", e instanceof Error ? e.message : String(e));
      setErrorMsg(e instanceof Error ? e.message : "បរាជ័យផ្ទៀងផ្ទាត់");
      setStage("failed");
    }
  };

  const reset = () => { stopPoll(); setQr(null); setQrDataUrl(null); setOrderId(null); setBakongMd5(null); setCoins(0); setExpiresAt(null); setErrorMsg(null); setDebug(null); setAttempts([]); setPollCount(0); setStage("choose"); };

  const copyQr = async () => {
    if (!qr) return;
    try { await navigator.clipboard.writeText(qr); onToast("ចម្លង QR string"); } catch { onToast("ចម្លងមិនបាន"); }
  };

  const remain = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;
  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl glass border border-border/60 shadow-[var(--shadow-card)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> បន្ថែម Balance</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">Balance:</span>
            <span className="text-xs font-semibold text-primary inline-flex items-center gap-1"><Wallet className="h-3 w-3" /> {balance.toLocaleString()}</span>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Real-time KHQR status badge (Khmer) */}
        {stage !== "choose" && (() => {
          const map: Record<TopupStage, { label: string; cls: string; dot: string; pulse: boolean }> = {
            choose: { label: "ត្រៀមរួច", cls: "", dot: "", pulse: false },
            creating: { label: "កំពុងបង្កើត KHQR…", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30", dot: "bg-sky-400", pulse: true },
            qr: { label: "កំពុងរង់ចាំការបង់ប្រាក់", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", dot: "bg-amber-400", pulse: true },
            checking: { label: "កំពុងផ្ទៀងផ្ទាត់…", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30", dot: "bg-sky-400", pulse: true },
            paid: { label: "ទូទាត់ជោគជ័យ", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400", pulse: false },
            expired: { label: "QR ផុតកំណត់", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", dot: "bg-amber-400", pulse: false },
            failed: { label: "បរាជ័យ", cls: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive", pulse: false },
          };
          const s = map[stage];
          return (
            <div className="px-5 pt-3">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${s.cls}`}>
                <span className={`h-2 w-2 rounded-full ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
                <span>ស្ថានភាព: {s.label}</span>
                {stage === "qr" && expiresAt && <span className="font-mono opacity-80">• {mm}:{ss}</span>}
              </div>
            </div>
          );
        })()}


        {stage === "choose" && (
          <div className="p-5 space-y-4">
            <div className="flex gap-1 rounded-xl bg-muted/30 p-1">
              <button onClick={() => setMethod("khqr")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${method === "khqr" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>KHQR ស្វ័យប្រវត្តិ</button>
              <button onClick={() => setMethod("manual")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold inline-flex items-center justify-center gap-1 ${method === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Upload className="h-3 w-3" /> ផ្ញើវិក័យបត្រ</button>
            </div>
            <p className="text-xs text-muted-foreground">{method === "khqr" ? "1 USD = 1 Balance។ បង់ប្រាក់ភ្លាមៗតាម Bakong KHQR។ QR មានសុពលភាព 5 នាទី។" : "បង់ប្រាក់ដោយដៃ បន្ទាប់មកផ្ទុកវិក័យបត្រ — Admin នឹងផ្ទៀងផ្ទាត់ និងបន្ថែម Balance។"}</p>
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setAmount(p)} className={`rounded-xl border px-2 py-2 text-sm font-semibold ${amount === p ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}>${p}</button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ឬចំនួនផ្ទាល់ខ្លួន (USD)</label>
              <input type="number" min={1} max={1000} value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                className="mt-1 w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary" />
            </div>
            <div className="rounded-xl bg-accent/40 px-3 py-2 text-xs flex items-center justify-between">
              <span>នឹងទទួលបាន</span>
              <span className="font-semibold inline-flex items-center gap-1 text-primary"><Wallet className="h-3.5 w-3.5" /> {amount.toLocaleString()}</span>
            </div>
            {method === "khqr" ? (
              <button onClick={() => start()} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 inline-flex items-center justify-center gap-2">
                បង្កើត KHQR
              </button>
            ) : (
              <ManualTopupForm amount={amount} onClose={onClose} onToast={onToast} />
            )}
          </div>
        )}

        {stage === "creating" && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div className="text-sm text-muted-foreground">កំពុងបង្កើត KHQR…</div>
          </div>
        )}

        {stage === "qr" && qrDataUrl && (
          <div className="p-5 space-y-3 text-center">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> ស្កេនជាមួយ Bakong / ABA / ធនាគារផ្សេងៗ</div>
            <div className="mx-auto inline-block rounded-xl bg-white p-3"><img src={qrDataUrl} alt={`KHQR Code សម្រាប់ការបង់ប្រាក់ ${amount} USD`} className="h-64 w-64" /></div>
            <div className="text-sm font-semibold">${amount} → {coins.toLocaleString()} Balance</div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300 inline-flex items-center gap-2 mx-auto">
              <Loader2 className={`h-3.5 w-3.5 ${polling ? "animate-spin" : ""}`} />
              <span>កំពុងរង់ចាំការបង់ប្រាក់ • ផុតក្នុង <span className="font-mono text-amber-200">{mm}:{ss}</span></span>
            </div>
            <div className="flex gap-2">
              <button onClick={verifyNow} className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 inline-flex items-center justify-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> ផ្ទៀងផ្ទាត់ឥឡូវ
              </button>
              <button onClick={copyQr} className="flex-1 rounded-xl border border-border py-2 text-xs hover:bg-accent inline-flex items-center justify-center gap-1.5">
                <Copy className="h-3.5 w-3.5" /> ចម្លង QR
              </button>
            </div>
            <button onClick={() => reset()} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">បោះបង់ហើយចាប់ផ្តើមឡើងវិញ</button>
          </div>
        )}

        {stage === "checking" && (
          <div className="p-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div className="text-sm text-muted-foreground">កំពុងផ្ទៀងផ្ទាត់ការបង់ប្រាក់…</div>
          </div>
        )}

        {stage === "expired" && (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/20 grid place-items-center"><AlertTriangle className="h-7 w-7 text-amber-400" /></div>
            <div className="font-display text-xl">QR ផុតកំណត់</div>
            <div className="text-sm text-muted-foreground">មិនទាន់ទទួលបានការបង់ប្រាក់ក្នុងរយៈពេលកំណត់ទេ។ បង្កើត QR ថ្មីដើម្បីសាកល្បងម្តងទៀត។</div>
            <div className="flex gap-2">
              <button onClick={() => reset()} className="flex-1 rounded-xl border border-border py-2.5 text-xs hover:bg-accent">បិទ</button>
              <button onClick={() => start(true)} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 inline-flex items-center justify-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> បង្កើតថ្មី
              </button>
            </div>
          </div>
        )}

        {stage === "failed" && (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-destructive/20 grid place-items-center"><AlertTriangle className="h-7 w-7 text-destructive" /></div>
            <div className="font-display text-xl">មានបញ្ហា</div>
            <div className="text-sm text-muted-foreground break-words">{errorMsg ?? "មិនអាចភ្ជាប់ទៅប្រព័ន្ធបង់ប្រាក់បានទេ។"}</div>
            <div className="flex gap-2">
              <button onClick={() => reset()} className="flex-1 rounded-xl border border-border py-2.5 text-xs hover:bg-accent">បោះបង់</button>
              <button onClick={() => start(true)} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 inline-flex items-center justify-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> សាកល្បងម្តងទៀត
              </button>
            </div>
          </div>
        )}

        {stage === "paid" && (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/20 grid place-items-center"><Check className="h-7 w-7 text-emerald-400" /></div>
            <div className="font-display text-xl">បន្ថែមជោគជ័យ!</div>
            <div className="text-sm text-muted-foreground">បាន {coins.toLocaleString()} Balance ត្រូវបានបន្ថែមទៅ Balance របស់អ្នក។</div>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs inline-flex items-center gap-1.5 text-emerald-300 mx-auto">
              <Wallet className="h-3.5 w-3.5" /> Balance ថ្មី: <span className="font-semibold">{balance.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => reset()} className="flex-1 rounded-xl border border-border py-2.5 text-xs hover:bg-accent">បន្ថែមទៀត</button>
              <button onClick={onClose} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90">បិទ</button>
            </div>
          </div>
        )}

        {/* Debug panel — last Bakong callback payload + poll result */}
        {(stage === "qr" || stage === "checking" || stage === "paid" || stage === "expired" || stage === "failed") && orderId && (
          <div className="border-t border-border/60 px-5 py-3 text-[11px]">
            <button onClick={() => setShowDebug((v) => !v)} className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <span className={`h-1.5 w-1.5 rounded-full ${debug?.status === "paid" ? "bg-emerald-400" : debug?.status === "expired" ? "bg-amber-400" : debug?.status === "error" ? "bg-destructive" : "bg-sky-400"}`} />
                Debug • polls: {pollCount}{debug?.status ? ` • last: ${debug.status}` : ""}
              </span>
              <span>{showDebug ? "▾" : "▸"}</span>
            </button>
            {showDebug && (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">order_id</span><span className="font-mono truncate max-w-[240px]" title={orderId}>{orderId}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">bakong md5</span><span className="font-mono truncate max-w-[240px]" title={bakongMd5 ?? ""}>{bakongMd5 ?? "—"}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">checked at</span><span className="font-mono">{debug?.at ?? "—"}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Bakong HTTP</span><span className="font-mono">{debug?.httpStatus ?? "—"}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Latency</span><span className="font-mono">{debug?.latencyMs != null ? `${debug.latencyMs} ms` : "—"}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">expires at</span><span className="font-mono">{expiresAt ? new Date(expiresAt).toISOString() : "—"}</span></div>
                <div>
                  <div className="text-muted-foreground mb-1">poll attempts</div>
                  <div className="space-y-1">
                    {attempts.length === 0 ? <div className="text-muted-foreground">(no poll yet)</div> : attempts.map((a, i) => (
                      <div key={`${a.at}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-2 py-1 font-mono text-[10px]">
                        <span>{a.status}</span>
                        <span>{a.httpStatus ?? "—"}</span>
                        <span>{a.latencyMs != null ? `${a.latencyMs}ms` : "—"}</span>
                        <span className="truncate max-w-[120px]">{new Date(a.at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">last payload</div>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted/30 border border-border/40 p-2 font-mono text-[10px] whitespace-pre-wrap break-all">{debug ? JSON.stringify(debug.payload, null, 2) : "(no poll yet)"}</pre>
                </div>
                <button onClick={() => { if (debug) navigator.clipboard.writeText(JSON.stringify(debug, null, 2)); }} className="text-primary hover:underline">ចម្លងព័ត៌មាន Debug</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ManualTopupForm({ amount, onClose, onToast }: { amount: number; onClose: () => void; onToast: (m: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = useServerFn(submitManualTopup);

  const onSubmit = async () => {
    if (!file) { onToast("សូមជ្រើសរើសរូបវិក័យបត្រ"); return; }
    if (file.size > 8 * 1024 * 1024) { onToast("ទំហំធំជាង 8MB"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("សូមចូលគណនី");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("topup-receipts").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      await submit({ data: { amountUsd: amount, receiptPath: path, note } });
      onToast("បានផ្ញើសំណើ — រង់ចាំ Admin អនុម័ត");
      onClose();
    } catch (e) { onToast(e instanceof Error ? e.message : "បរាជ័យ"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-muted-foreground">រូបវិក័យបត្រ (JPG/PNG/PDF, max 8MB)</span>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
        {file && <div className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1"><ReceiptIcon className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)</div>}
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">កំណត់ចំណាំ (ស្រេចចិត្ត)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
          className="mt-1 w-full rounded-xl bg-input px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary" />
      </label>
      <button onClick={onSubmit} disabled={busy || !file} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        ផ្ញើសំណើ
      </button>
    </div>
  );
}
