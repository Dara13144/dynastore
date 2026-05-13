import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Settings, LogIn, LogOut, Star, Send, Gamepad2, Sparkles, X, Coins, Plus, Library, Check, Loader2, AlertTriangle, RefreshCw, Wallet, Copy, ShieldCheck } from "lucide-react";
import { StoreProvider, useStore, type Game } from "@/lib/store";
import { createTopup, checkTopup, purchaseGame } from "@/lib/payment.functions";
import heroImg from "@/assets/hero-arcade.jpg";
import logoD from "@/assets/dyna-logo.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dyna Store — ទិញហ្គេមដោយ KHQR" },
      { name: "description", content: "ទិញហ្គេម PC និង Console ដោយ Bakong KHQR។ បន្ថែម coins ហើយចាប់ផ្តើមលេង។" },
      { property: "og:title", content: "Dyna Store" },
      { property: "og:description", content: "ហាងហ្គេមជាមួយ KHQR top-up។" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bayon&family=Noto+Sans+Khmer:wght@400;500;600;700&display=swap" },
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
      <Hero />
      <GamesSection onToast={showToast} onTopup={() => setTopupOpen(true)} />
      <DealsBanner />
      <Recommendations onToast={showToast} />
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
  const { authed, signOut, balance } = useStore();
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
            <button onClick={onTopup} title="បន្ថែម Balance" className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20">
              <Wallet className="h-3.5 w-3.5" /> {balance.toLocaleString()} <Plus className="h-3 w-3" />
            </button>
          )}
          {authed && (
            <Link to="/library" className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <Library className="h-3.5 w-3.5" /> បណ្ណាល័យ
            </Link>
          )}
          <button onClick={onSettings} className="p-2 rounded-full hover:bg-accent transition" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </button>
          {authed ? (
            <>
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
        <img src={heroImg} alt="" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>
      <div className="relative container mx-auto px-4 py-20 md:py-28 max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground mb-5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> បង់ប្រាក់ភ្លាមៗដោយ Bakong KHQR
        </div>
        <h1 className="font-display text-4xl md:text-6xl tracking-tight">
          <span className="gradient-text">ទិញហ្គេម</span> ដោយ coins
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          បន្ថែម coins តាម KHQR ហើយទិញហ្គេម PC/Console ភ្លាមៗ។ 1 USD = 100 coins។
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
    if (balance < game.price_coins) { onToast("Coins មិនគ្រប់គ្រាន់ — សូមបន្ថែម"); onTopup(); return; }
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
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={game.image} alt={game.title} className="h-full w-full object-cover transition group-hover:scale-105" />
        {game.badge && <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{game.badge}</span>}
        {owned && <span className="absolute top-3 right-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-white inline-flex items-center gap-1"><Check className="h-3 w-3" /> ជាកម្មសិទ្ធ</span>}
      </div>
      <div className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{game.category}</div>
        <h3 className="font-display text-lg mt-0.5">{game.title}</h3>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{game.description}</p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="inline-flex items-center gap-1 font-semibold text-primary">
              <Coins className="h-3.5 w-3.5" /> {game.price_coins.toLocaleString()}
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
            <button onClick={wish} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs hover:bg-accent ${wished ? "border-primary text-primary" : "border-border"}`}>
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
        <p className="text-sm md:text-base text-primary-foreground/80 mt-2">បន្ថែម 10 USD នឹងទទួលបាន 1,000 coins ភ្លាមៗ។</p>
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

function TopupModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { authed, refreshWallet } = useStore();
  const [amount, setAmount] = useState(5);
  const [stage, setStage] = useState<"choose" | "qr" | "paid">("choose");
  const [qr, setQr] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [md5, setMd5] = useState<string | null>(null);
  const [coins, setCoins] = useState(0);
  const [creating, setCreating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef<number | null>(null);

  const createFn = useServerFn(createTopup);
  const checkFn = useServerFn(checkTopup);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);
  useEffect(() => {
    if (stage !== "qr") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  const start = async () => {
    if (!authed) { onToast("សូមចូលគណនីជាមុនសិន"); return; }
    setCreating(true);
    try {
      const r = await createFn({ data: { amountUsd: amount } });
      setQr(r.qr); setMd5(r.md5); setCoins(r.coins); setExpiresAt(new Date(r.expiresAt).getTime());
      const dataUrl = await QRCode.toDataURL(r.qr, { width: 320, margin: 1 });
      setQrDataUrl(dataUrl);
      setStage("qr");
      // start polling every 3s
      setPolling(true);
      pollRef.current = window.setInterval(async () => {
        try {
          const c = await checkFn({ data: { md5: r.md5 } });
          if (c.status === "paid") {
            if (pollRef.current) window.clearInterval(pollRef.current);
            setPolling(false);
            setStage("paid");
            await refreshWallet();
            onToast(`បានបន្ថែម ${r.coins.toLocaleString()} coins!`);
          } else if (c.status === "expired") {
            if (pollRef.current) window.clearInterval(pollRef.current);
            setPolling(false);
            onToast("QR ផុតកំណត់ — សូមបង្កើតថ្មី");
          }
        } catch { /* ignore */ }
      }, 3000) as unknown as number;
    } catch (e) {
      onToast(e instanceof Error ? e.message : "បរាជ័យ");
    } finally { setCreating(false); }
  };

  const remain = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;
  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl glass border border-border/60 shadow-[var(--shadow-card)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> បន្ថែម Coins</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        {stage === "choose" && (
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground">1 USD = 100 coins។ បង់ប្រាក់តាម Bakong KHQR។</p>
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
              <span className="font-semibold inline-flex items-center gap-1 text-primary"><Coins className="h-3.5 w-3.5" /> {(amount * 100).toLocaleString()}</span>
            </div>
            <button onClick={start} disabled={creating} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} បង្កើត KHQR
            </button>
          </div>
        )}

        {stage === "qr" && qrDataUrl && (
          <div className="p-5 space-y-3 text-center">
            <div className="text-xs text-muted-foreground">ស្កេនជាមួយកម្មវិធី Bakong / ABA / ធនាគារផ្សេងៗ</div>
            <div className="mx-auto inline-block rounded-xl bg-white p-3"><img src={qrDataUrl} alt="KHQR" className="h-64 w-64" /></div>
            <div className="text-sm font-semibold">${amount} → {coins.toLocaleString()} coins</div>
            <div className="text-xs text-muted-foreground">ផុតកំណត់ក្នុង <span className="font-mono text-foreground">{mm}:{ss}</span> {polling && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</div>
            <button onClick={async () => { if (!md5) return; const c = await checkFn({ data: { md5 } }); if (c.status === "paid") { setStage("paid"); await refreshWallet(); onToast(`បានបន្ថែម ${coins.toLocaleString()} coins!`); } else onToast("មិនទាន់ទទួលបាន"); }}
              className="w-full rounded-xl border border-border py-2 text-xs hover:bg-accent">ផ្ទៀងផ្ទាត់ដោយខ្លួនឯង</button>
          </div>
        )}

        {stage === "paid" && (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/20 grid place-items-center"><Check className="h-7 w-7 text-emerald-400" /></div>
            <div className="font-display text-xl">បន្ថែមជោគជ័យ!</div>
            <div className="text-sm text-muted-foreground">បាន {coins.toLocaleString()} coins ត្រូវបានបន្ថែមទៅ wallet របស់អ្នក។</div>
            <button onClick={onClose} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">បិទ</button>
          </div>
        )}
      </div>
    </div>
  );
}
