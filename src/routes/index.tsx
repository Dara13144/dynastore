import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { Coins, ShoppingCart, Settings, LogIn, LogOut, X, Trash2, Check, Star, Zap, Clock, Heart, Send, Gamepad2, Sparkles, ImageIcon, AlertTriangle, RefreshCw, Download, Copy, Loader2, QrCode as QrCodeIcon } from "lucide-react";
import { StoreProvider, useStore, GAMES, COIN_PACKS, gameFinalPrice, type CoinPack, type Game } from "@/lib/store";
import { createTopup as createTopupFn, checkPayment as checkPaymentFn, getMerchantInfo as getMerchantInfoFn } from "@/lib/bakong.functions";
import { md5Hex } from "@/lib/md5";
import heroImg from "@/assets/hero-arcade.jpg";
import logoD from "@/assets/dyna-logo.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dyna Store — ទិញហ្គេម និង Coins តាម Bakong KHQR" },
      { name: "description", content: "ហាងហ្គេម PC និង Console ជាមួយការបង់ប្រាក់តាម Bakong KHQR។ Coins, ប្រូម៉ូសិន, និងហ្គេមពេញនិយម។" },
      { property: "og:title", content: "Dyna Store" },
      { property: "og:description", content: "ហាងហ្គេម PC និង Console ជាមួយការបង់ប្រាក់តាម Bakong KHQR។" },
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
  const [cartOpen, setCartOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paymentPack, setPaymentPack] = useState<CoinPack | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Restore pending topup after page refresh so polling resumes automatically.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bakong:pendingTopup");
      if (!raw) return;
      const data = JSON.parse(raw) as { packId: string; expiresAt: number };
      if (!data?.packId || !data?.expiresAt || Date.now() >= data.expiresAt) {
        localStorage.removeItem("bakong:pendingTopup");
        return;
      }
      const pack = COIN_PACKS.find((p) => p.id === data.packId);
      if (pack) setPaymentPack(pack);
      else localStorage.removeItem("bakong:pendingTopup");
    } catch {
      try { localStorage.removeItem("bakong:pendingTopup"); } catch {}
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="min-h-screen">
      <Header onCart={() => setCartOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <Hero />
      <CoinShop onBuyPack={(p) => setPaymentPack(p)} />
      <GamesSection onToast={showToast} onOpenCart={() => setCartOpen(true)} />
      <DealsBanner />
      <Recommendations onToast={showToast} />
      <PlusSection />
      <Footer />

      {cartOpen && <CartModal onClose={() => setCartOpen(false)} onToast={showToast} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onToast={showToast} />}
      {paymentPack && <PaymentModal pack={paymentPack} onClose={() => setPaymentPack(null)} onToast={showToast} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full glass px-5 py-3 text-sm shadow-[var(--shadow-card)] animate-in fade-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </div>
  );
}

function Header({ onCart, onSettings }: { onCart: () => void; onSettings: () => void }) {
  const { cart, authed, signOut } = useStore();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 glass border-b border-border/50">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
        <a href="#" className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-background/40 ring-1 ring-primary/40">
            <img src={logoD} alt="Dyna Store logo" className="h-7 w-7" />
          </div>
          <span className="font-display text-2xl tracking-wide gradient-text">Dyna Store</span>
        </a>
        <nav className="hidden items-center gap-1 md:flex ml-4">
          {[
            { href: "#games", label: "ហ្គេម" },
            { href: "#coins", label: "Coins" },
            { href: "#deals", label: "ប្រូម៉ូសិន" },
            { href: "#recs", label: "ណែនាំ" },
            { href: "#plus", label: "សមាជិកភាព" },
          ].map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {authed ? (
            <button onClick={signOut} className="hidden rounded-full px-4 py-2 text-sm font-medium ring-1 ring-border bg-secondary/70 hover:bg-secondary md:inline-flex items-center gap-2">
              <LogOut className="h-4 w-4" /> ចាកចេញ
            </button>
          ) : (
            <button onClick={() => navigate({ to: "/login" })} className="hidden rounded-full px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 md:inline-flex items-center gap-2" style={{ background: "var(--gradient-hero)" }}>
              <LogIn className="h-4 w-4" /> ចូលប្រើ
            </button>
          )}
          <button onClick={onSettings} className="grid h-10 w-10 place-items-center rounded-full bg-secondary/70 ring-1 ring-border transition hover:bg-secondary" title="Settings" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </button>
          <button onClick={onCart} className="relative grid h-10 w-10 place-items-center rounded-full bg-secondary/70 ring-1 ring-border transition hover:bg-secondary" aria-label={`កន្ត្រក ${cart.length}`}>
            <ShoppingCart className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{cart.length}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg} alt="" className="h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:gap-12 md:px-6 md:py-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/40">
            <Sparkles className="h-3.5 w-3.5" /> ទាញយកភ្លាមៗ • ប្រូម៉ូសិនរៀងរាល់សប្តាហ៍
          </div>
          <h1 className="mt-5 font-display text-5xl leading-tight md:text-7xl">
            <span className="gradient-text glow-text">ទិញហ្គេម</span> ដែលអ្នកចូលចិត្ត<br />បន្ទាប់បានយ៉ាងរហ័ស។
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            ស្វែងរកហ្គេម PC និង Console គុណភាពខ្ពស់ ទទួលបានការបញ្ចុះតម្លៃពិសេស ហើយរក្សាបណ្ណាល័យហ្គេមរបស់អ្នកឱ្យរួចរាល់គ្រប់ពេល។
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#games" className="rounded-full px-6 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-neon)] transition hover:scale-[1.02]" style={{ background: "var(--gradient-hero)" }}>
              ទិញហ្គេម
            </a>
            <a href="#deals" className="rounded-full border border-border bg-secondary/40 px-6 py-3 font-semibold backdrop-blur transition hover:bg-secondary">
              មើលប្រូម៉ូសិន
            </a>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 rounded-2xl glass p-5">
            {[
              { v: "2,500+", l: "ហ្គេមមានលក់" },
              { v: "24/7", l: "ដឹកជញ្ជូនឌីជីថលភ្លាមៗ" },
              { v: "4.9/5", l: "ការវាយតម្លៃពីអ្នកលេង" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-display text-2xl text-foreground md:text-3xl">{s.v}</div>
                <div className="mt-1 text-xs text-muted-foreground md:text-sm">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <FeaturedCard />
      </div>
    </section>
  );
}

function FeaturedCard() {
  const featured = GAMES[1];
  const { addToCart } = useStore();
  return (
    <div className="relative overflow-hidden rounded-3xl ring-1 ring-border shadow-[var(--shadow-card)]">
      <img src={featured.image} alt={featured.title} className="h-[420px] w-full object-cover md:h-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <span className="absolute left-5 top-5 rounded-full bg-coin px-3 py-1 text-xs font-bold text-coin-foreground">ពិសេស</span>
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <h3 className="font-display text-3xl text-white">{featured.title}</h3>
        <p className="mt-2 text-sm text-white/80">{featured.description}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-white/60">តម្លៃ</div>
            <div className="font-display text-2xl text-coin">{gameFinalPrice(featured).toLocaleString()} Coins</div>
          </div>
          <button onClick={() => addToCart(featured.id)} className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-background hover:bg-white">
            បន្ថែមកន្ត្រក
          </button>
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent">
          <Zap className="h-3.5 w-3.5" /> បញ្ចុះ 20% ថ្ងៃនេះ
        </div>
      </div>
    </div>
  );
}


const CATEGORIES = ["ទាំងអស់", "Action", "Racing", "RPG", "Strategy", "Adventure", "ប្រណាំង"];

function GamesSection({ onToast, onOpenCart }: { onToast: (m: string) => void; onOpenCart: () => void }) {
  const [cat, setCat] = useState("ទាំងអស់");
  const filtered = useMemo(() => (cat === "ទាំងអស់" ? GAMES : GAMES.filter((g) => g.category === cat)), [cat]);
  return (
    <section id="games" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/30">
            <Gamepad2 className="h-3.5 w-3.5" /> លក់ដាច់ជាងគេ
          </div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">ហ្គេមពេញនិយម</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">ជ្រើសរើសហ្គេមដែលបានណែនាំ រួមមានប្រភេទ Action, Racing, Strategy និង RPG។</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-sm transition ${cat === c ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((g) => <GameCard key={g.id} game={g} onToast={onToast} onOpenCart={onOpenCart} />)}
      </div>
    </section>
  );
}

function GameCard({ game, onToast, onOpenCart }: { game: Game; onToast: (m: string) => void; onOpenCart: () => void }) {
  const { cart, addToCart, removeFromCart, library, buyGame } = useStore();
  const inCart = cart.includes(game.id);
  const owned = library.includes(game.id);
  const price = gameFinalPrice(game);
  const handleBuy = async () => {
    const r = await buyGame(game.id);
    onToast(r.msg);
  };
  return (
    <article className="group relative overflow-hidden rounded-2xl ring-1 ring-border transition hover:ring-primary/60 hover:-translate-y-1" style={{ background: "var(--gradient-card)" }}>
      <div className="relative aspect-[4/5] overflow-hidden">
        <img src={game.image} alt={game.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        {game.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground shadow-lg">{game.badge}</span>
        )}
        <span className="absolute right-3 top-3 rounded-full glass px-2.5 py-1 text-[11px] text-foreground">{game.category}</span>
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl">{game.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{game.description}</p>
        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            {game.discount && <div className="text-xs text-muted-foreground line-through">{game.price} Coins</div>}
            <div className="font-display text-xl text-coin">{price.toLocaleString()} Coins</div>
          </div>
          <div className="flex gap-2">
            {owned ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-2 text-xs font-medium text-primary ring-1 ring-primary/40">
                <Check className="h-3.5 w-3.5" /> បានទិញ
              </span>
            ) : (
              <>
                {inCart ? (
                  <button onClick={() => { removeFromCart(game.id); onOpenCart(); }} className="rounded-full bg-secondary px-3 py-2 text-xs font-semibold ring-1 ring-border hover:bg-secondary/80">
                    ក្នុងកន្ត្រក
                  </button>
                ) : (
                  <button onClick={() => { addToCart(game.id); onToast("បានបន្ថែមទៅកន្ត្រក"); }} className="rounded-full bg-secondary px-3 py-2 text-xs font-semibold ring-1 ring-border hover:bg-secondary/80">
                    កន្ត្រក
                  </button>
                )}
                <button onClick={handleBuy} className="rounded-full px-3 py-2 text-xs font-semibold text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
                  ទិញហ្គេម
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function DealsBanner() {
  return (
    <section id="deals" className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 ring-1 ring-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-background/40 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/30 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/30">
            <Clock className="h-3.5 w-3.5" /> ប្រូម៉ូសិនចុងសប្តាហ៍
          </div>
          <h2 className="mt-4 font-display text-3xl text-white md:text-5xl">សន្សំបានរហូតដល់ 60% លើហ្គេមលេងជាក្រុម</h2>
          <p className="mt-3 text-white/85">ប្រមូលក្រុមរបស់អ្នកមកលេងហ្គេម Multiplayer, Party និង Online Adventure ដ៏ពេញនិយម។</p>
          <a href="#games" className="mt-6 inline-flex rounded-full bg-background px-6 py-3 font-semibold text-foreground transition hover:scale-105">
            មើលការផ្តល់ជូន
          </a>
        </div>
      </div>
    </section>
  );
}

function Recommendations({ onToast }: { onToast: (m: string) => void }) {
  const { recs, addRec } = useStore();
  const [name, setName] = useState("");
  const [game, setGame] = useState(GAMES[0].title);
  const [text, setText] = useState("");
  return (
    <section id="recs" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/30">
          <Heart className="h-3.5 w-3.5" /> Customer Recommend
        </div>
        <h2 className="mt-4 font-display text-4xl md:text-5xl">អតិថិជនណែនាំ</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">មើលមតិយោបល់ពីអ្នកលេងដែលបានទិញហ្គេម និង Coins ពី Dyna Store។</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {recs.slice(0, 6).map((r) => (
          <div key={r.id} className="rounded-2xl p-6 ring-1 ring-border" style={{ background: "var(--gradient-card)" }}>
            <div className="flex gap-1 text-coin">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
            <p className="mt-4 text-sm text-foreground/90">{r.text}</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full font-display text-lg text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>{r.initial}</div>
              <div>
                <div className="text-sm font-semibold">{r.name}</div>
                <div className="text-xs text-muted-foreground">បានណែនាំ {r.game}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl glass p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary"><Send className="h-3.5 w-3.5" /> Write Recommend</div>
        <h3 className="mt-2 font-display text-2xl">សរសេរការណែនាំរបស់អ្នក</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ឈ្មោះរបស់អ្នក" className="rounded-xl bg-input px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          <select value={game} onChange={(e) => setGame(e.target.value)} className="rounded-xl bg-input px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary">
            {GAMES.map((g) => <option key={g.id} value={g.title}>{g.title}</option>)}
          </select>
          <button
            onClick={() => {
              if (!name.trim() || !text.trim()) return onToast("សូមបំពេញឈ្មោះ និងអត្ថបទ");
              addRec({ name: name.trim(), game, text: text.trim() });
              setName(""); setText("");
              onToast("អរគុណសម្រាប់ការណែនាំ");
            }}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            បង្ហោះការណែនាំ
          </button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="ចែករំលែកបទពិសោធន៍របស់អ្នក..." className="mt-3 w-full resize-none rounded-xl bg-input px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary" />
      </div>
    </section>
  );
}

function PlusSection() {
  return (
    <section id="plus" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
      <div className="grid gap-8 rounded-3xl ring-1 ring-border p-8 md:grid-cols-2 md:p-12" style={{ background: "var(--gradient-card)" }}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/30">
            <Sparkles className="h-3.5 w-3.5" /> Dyna Store Plus
          </div>
          <h2 className="mt-4 font-display text-3xl md:text-5xl">ទទួលបានអត្ថប្រយោជន៍ច្រើនជាងមុនរាល់ការទិញ។</h2>
          <p className="mt-3 text-muted-foreground">សមាជិកនឹងទទួលបានពិន្ទុបន្ថែម សិទ្ធិចូលប្រើហ្គេមថ្មីមុនគេ និងការផ្តល់ជូនពិសេសប្រចាំខែ។</p>
        </div>
        <ul className="space-y-3">
          {[
            "ទទួលបាន 5% ជាក្រេឌីតហាងរាល់ការបញ្ជាទិញ",
            "បញ្ចុះតម្លៃពិសេសសម្រាប់សមាជិកប៉ុណ្ណោះ",
            "សេវាជំនួយអតិថិជនអាទិភាព",
            "Coins Bonus ប្រចាំខែ +500",
          ].map((t) => (
            <li key={t} className="flex items-start gap-3 rounded-xl bg-background/30 p-4 ring-1 ring-border">
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></div>
              <span className="text-sm">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border mt-10">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-4 md:px-6">
        <div>
          <div className="flex items-center gap-2.5">
            <img src={logoD} alt="" className="h-7 w-7" />
            <span className="font-display text-xl gradient-text">Dyna Store</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">ហាងហ្គេមឌីជីថលគុណភាពខ្ពស់ ជាមួយការបង់ប្រាក់តាម Bakong KHQR។</p>
        </div>
        {[
          { t: "ហាង", l: ["ហ្គេម", "ប្រូម៉ូសិន"] },
          { t: "ជំនួយ", l: ["ទំនាក់ទំនង", "សំណួរញឹកញាប់"] },
          { t: "តាមដាន", l: ["Facebook", "Telegram", "TikTok"] },
        ].map((c) => (
          <div key={c.t}>
            <div className="text-sm font-semibold text-foreground">{c.t}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.l.map((x) => <li key={x}><a href="#" className="hover:text-foreground">{x}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Dyna Store. All rights reserved.</div>
    </footer>
  );
}

/* ============== MODALS ============== */

function ModalShell({ children, onClose, title, eyebrow }: { children: React.ReactNode; onClose: () => void; title: string; eyebrow: string }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/70 p-4 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl glass p-6 md:p-8 shadow-[var(--shadow-card)] animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-secondary/70 hover:bg-secondary" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs uppercase tracking-wider text-primary">{eyebrow}</div>
        <h3 className="mt-1 font-display text-2xl md:text-3xl">{title}</h3>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function CartModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { cart, removeFromCart, checkoutCart, coins, library } = useStore();
  const items = cart.map((id) => GAMES.find((g) => g.id === id)!).filter(Boolean);
  const total = items.filter((g) => !library.includes(g.id)).reduce((s, g) => s + gameFinalPrice(g), 0);
  return (
    <ModalShell onClose={onClose} eyebrow="Shopping Cart" title="កន្ត្រករបស់អ្នក">
      {items.length === 0 ? (
        <div className="rounded-2xl bg-background/40 p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
          កន្ត្រកទទេ — សូមជ្រើសរើសហ្គេមណាមួយ។
        </div>
      ) : (
        <>
          <ul className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {items.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-xl bg-background/40 p-3 ring-1 ring-border">
                <img src={g.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold">{g.title}</div>
                  <div className="text-xs text-muted-foreground">{g.category} {library.includes(g.id) && "· (បានទិញរួច)"}</div>
                </div>
                <div className="text-sm font-display text-coin">{gameFinalPrice(g)}</div>
                <button onClick={() => removeFromCart(g.id)} className="grid h-8 w-8 place-items-center rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-background/40 p-4 ring-1 ring-border">
            <div className="text-sm text-muted-foreground">សរុប</div>
            <div className="font-display text-2xl text-coin">{total.toLocaleString()} Coins</div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Wallet មាន: {coins.toLocaleString()} Coins</div>
          <button
            onClick={async () => { const r = await checkoutCart(); onToast(r.msg); if (r.ok) onClose(); }}
            className="mt-5 w-full rounded-full px-5 py-3 font-semibold text-primary-foreground transition hover:scale-[1.01]" style={{ background: "var(--gradient-hero)" }}>
            បង់ប្រាក់ឥឡូវ
          </button>
        </>
      )}
    </ModalShell>
  );
}


function SettingsModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { profile, setProfile, library, coins } = useStore();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <ModalShell onClose={onClose} eyebrow="Player Settings" title="Customize Profile">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground">Display Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl bg-input px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Avatar Image</label>
          <div className="mt-1 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-secondary ring-1 ring-border">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold ring-1 ring-border hover:bg-secondary/80">Choose image</button>
              <div className="mt-1 text-[10px] text-muted-foreground">JPG, PNG, or WebP</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-5 ring-1 ring-coin/30" style={{ background: "var(--gradient-card)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-coin">
                <Coins className="h-3 w-3" /> Wallet Balance
              </div>
              <div className="mt-1 font-display text-3xl text-coin">{coins.toLocaleString()} <span className="text-sm text-muted-foreground">Coins</span></div>
              <div className="mt-1 text-[11px] text-muted-foreground">បណ្ណាល័យហ្គេម: {library.length}</div>
            </div>
            <button
              onClick={() => { onClose(); setTimeout(() => { document.getElementById("coins")?.scrollIntoView({ behavior: "smooth" }); }, 50); }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-coin-foreground transition hover:scale-105"
              style={{ background: "var(--gradient-coin)" }}>
              <Coins className="h-4 w-4" /> Topup Coins
            </button>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {COIN_PACKS.map((p) => (
              <div key={p.id} className="rounded-lg bg-background/40 px-2 py-2 text-center ring-1 ring-border">
                <div className="text-[10px] text-muted-foreground">{p.name.replace(" Pack", "")}</div>
                <div className="text-[11px] font-semibold text-coin">{p.coins.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">${p.price}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setProfile({ name: name.trim() || "Player", avatar }); onToast("បានរក្សាទុក"); onClose(); }} className="flex-1 rounded-full px-5 py-3 font-semibold text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            Save Profile
          </button>
          <button onClick={() => { setName("Player"); setAvatar(null); }} className="rounded-full bg-secondary px-5 py-3 text-sm ring-1 ring-border hover:bg-secondary/80">Reset</button>
        </div>
      </div>
    </ModalShell>
  );
}


function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="text-center">
      <div className="font-display text-lg text-foreground">{v}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}


function CoinShop({ onBuyPack }: { onBuyPack: (p: CoinPack) => void }) {
  return (
    <section id="coins" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-coin/15 px-3 py-1 text-xs font-medium text-coin ring-1 ring-coin/30">
          <Coins className="h-3.5 w-3.5" /> Coin Shop
        </div>
        <h2 className="mt-4 font-display text-4xl md:text-5xl">Topup <span className="text-coin">Coins</span></h2>
        <p className="mt-3 text-muted-foreground">ជ្រើសរើសកញ្ចប់តម្លៃ ហើយបង់ប្រាក់តាម Bakong KHQR។ Coins នឹងចូល Wallet បន្ទាប់ពីការបង់ប្រាក់ត្រូវបានផ្ទៀងផ្ទាត់។</p>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {COIN_PACKS.map((p, i) => (
          <div key={p.id} className="group relative overflow-hidden rounded-2xl ring-1 ring-border p-6 transition hover:ring-coin/60 hover:-translate-y-1" style={{ background: "var(--gradient-card)" }}>
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-coin/15 blur-2xl transition group-hover:bg-coin/30" />
            <div className="relative">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl text-coin">{p.coins.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">Coins</span>
              </div>
              {p.bonus && <div className="mt-1 inline-flex rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">+{p.bonus.toLocaleString()} Bonus</div>}
              <p className="mt-3 text-sm text-muted-foreground">{p.tag}</p>
              <div className="mt-5 flex items-center justify-between">
                <div className="font-display text-2xl">${p.price}</div>
                <button onClick={() => onBuyPack(p)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-coin-foreground transition hover:scale-105" style={{ background: "var(--gradient-coin)" }}>
                  <Coins className="h-4 w-4" /> Topup ${p.price}
                </button>
              </div>
              {i === 1 && <span className="absolute -top-3 right-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">POPULAR</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaymentModal({ pack, onClose, onToast }: { pack: CoinPack; onClose: () => void; onToast: (m: string) => void }) {
  const navigate = useNavigate();
  const { authed, refresh, coins } = useStore();
  const createTopup = useServerFn(createTopupFn);
  const checkPayment = useServerFn(checkPaymentFn);
  const getMerchantInfo = useServerFn(getMerchantInfoFn);
  const [merchantInfo, setMerchantInfo] = useState<Awaited<ReturnType<typeof getMerchantInfoFn>> | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  useEffect(() => {
    if (!authed) { setMerchantInfo(null); return; }
    let cancelled = false;
    getMerchantInfo().then((r) => { if (!cancelled) setMerchantInfo(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [authed, getMerchantInfo]);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);
  type Tx = { md5: string; qrPayload: string; coins: number; createdAt: number; expiresAt: number };
  const [tx, setTx] = useState<Tx | null>(null);
  const [prevTx, setPrevTx] = useState<Tx | null>(null);
  const [status, setStatus] = useState<"confirm" | "loading" | "login" | "qr" | "verifying" | "paid" | "expired" | "error">("confirm");
  const [errMsg, setErrMsg] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const [paidAt, setPaidAt] = useState<number | null>(null);
  const [paidInfo, setPaidInfo] = useState<{ bakongRef: string | null; newBalance: number | null; creditedNow: boolean } | null>(null);
  type TimelineEvent = { at: number; kind: "khqr" | "md5" | "bakong" | "credited" | "expired" | "error"; label: string; detail?: string };
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const pushEvent = (e: Omit<TimelineEvent, "at">) =>
    setEvents((prev) => [...prev, { ...e, at: Date.now() }].slice(-50));
  const [mismatch, setMismatch] = useState<{ scanned: string; active: string } | null>(null);
  const [autoCloseIn, setAutoCloseIn] = useState<number>(0);
  const POLL_WINDOW_S = 300;
  const AUTO_CLOSE_S = 6;
  const STORAGE_KEY = "bakong:pendingTopup";

  const clearPersistedTx = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const closeAndClear = () => {
    clearPersistedTx();
    onClose();
  };

  const retry = () => {
    clearPersistedTx();
    setStatus("confirm");
    setErrMsg("");
    setTx(null);
    setSecondsLeft(300);
  };

  const retryAndRegenerate = async () => {
    if (!authed) { setStatus("login"); return; }
    clearPersistedTx();
    setErrMsg("");
    setTx(null);
    setSecondsLeft(300);
    setRefreshing(true);
    try { await Promise.resolve(refresh()); } catch {}
    setRefreshing(false);
    await startPayment();
  };

  useEffect(() => {
    setErrMsg("");
    setTx(null);
    setSecondsLeft(300);
    setStatus("confirm");
  }, [authed]);

  // Restore tx from localStorage on mount (e.g. after page refresh)
  useEffect(() => {
    if (!authed) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Tx & { packId: string };
      if (!data || data.packId !== pack.id) return;
      if (!data.md5 || !data.qrPayload || !data.expiresAt) return;
      if (Date.now() >= data.expiresAt) { clearPersistedTx(); return; }
      setTx({
        md5: data.md5,
        qrPayload: data.qrPayload,
        coins: data.coins,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
      });
      setSecondsLeft(Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000)));
      setStatus("qr");
      pushEvent({ kind: "khqr", label: "Restored from session", detail: `MD5 ${data.md5.slice(0, 10)}…` });
    } catch {
      clearPersistedTx();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tx whenever it's active so refresh can resume polling
  useEffect(() => {
    if (!tx) return;
    if (status === "paid" || status === "expired" || status === "error") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...tx, packId: pack.id }));
    } catch {}
  }, [tx, status, pack.id]);

  // Clear persisted tx on terminal states
  useEffect(() => {
    if (status === "paid" || status === "expired") clearPersistedTx();
  }, [status]);

  // Auto-refresh wallet whenever a payment fails/expires so user sees latest balance before retrying
  useEffect(() => {
    if (status !== "error" && status !== "expired") return;
    if (!authed) return;
    let cancelled = false;
    setRefreshing(true);
    Promise.resolve(refresh())
      .catch(() => {})
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [status, authed, refresh]);

  const startPayment = async () => {
    if (!authed) {
      setStatus("login");
      return;
    }

    // Move current tx into history before regenerating
    setPrevTx(tx);
    setMismatch(null);
    setStatus("loading");
    setErrMsg("");
    setTx(null);
    setSecondsLeft(POLL_WINDOW_S);
    setEvents([]);

    try {
      const res = await createTopup({ data: { packId: pack.id } });
      const now = Date.now();
      setTx({
        md5: res.md5,
        qrPayload: res.qrPayload,
        coins: res.coins,
        createdAt: now,
        expiresAt: now + POLL_WINDOW_S * 1000,
      });
      pushEvent({ kind: "khqr", label: "KHQR generated", detail: `${res.coins} Coins · MD5 ${res.md5.slice(0, 10)}…` });
      const clientMatch = md5Hex(res.qrPayload) === res.md5;
      pushEvent({ kind: "md5", label: clientMatch ? "Client MD5 match ✓" : "Client MD5 mismatch ✗", detail: clientMatch ? "payload hash = server md5" : "hash mismatch" });
      setStatus("qr");
    } catch (e: any) {
      setStatus("error");
      setErrMsg(e?.message || "មានបញ្ហាបង្កើតការទូទាត់");
      pushEvent({ kind: "error", label: "KHQR generation failed", detail: e?.message });
    }
  };

  // 5-minute MD5 validity window — countdown + status polling
  useEffect(() => {
    if (!tx || (status !== "qr" && status !== "verifying")) return;
    let cancelled = false;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((tx.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setStatus("expired");
    }, 1000);

    const runPoll = async () => {
      if (cancelled) return;
      if (Date.now() >= tx.expiresAt) { setStatus("expired"); return; }
      const checkingMd5 = tx.md5;
      try {
        const r = await checkPayment({ data: { md5: checkingMd5 } });
        if (cancelled) return;
        setLastChecked(Date.now());
        setPollTick((n) => n + 1);
        setTx((cur) => {
          if (!cur || cur.md5 !== checkingMd5) return cur;
          if (Date.now() >= cur.expiresAt) { setStatus("expired"); return cur; }
          if (r.status === "paid") {
            setStatus("paid");
            setPaidAt(Date.now());
            const ref = (r as any).bakongRef ?? null;
            const nb = (r as any).newBalance ?? null;
            const cn = !!(r as any).creditedNow;
            setPaidInfo({ bakongRef: ref, newBalance: nb, creditedNow: cn });
            pushEvent({ kind: "bakong", label: "Bakong check: SUCCESS", detail: `responseCode=${(r as any).responseCode ?? 0}${ref ? ` · ref ${String(ref).slice(0, 14)}…` : ""}` });
            pushEvent({ kind: "credited", label: cn ? `Wallet credited (+${cur.coins})` : "Already credited (idempotent)", detail: nb != null ? `new balance ${nb} Coins` : undefined });
            onToast(`បានបន្ថែម ${cur.coins.toLocaleString()} Coins ✓`);
            refresh();
          } else if (r.status === "expired") {
            setStatus("expired");
            pushEvent({ kind: "expired", label: "MD5 expired (server)" });
          } else {
            pushEvent({ kind: "bakong", label: `Bakong poll #${pollTick + 1}: pending`, detail: `responseCode=${(r as any).responseCode ?? "—"}` });
          }
          return cur;
        });
      } catch {}
    };

    // Immediate poll, then every 2s for fast PAID flip.
    runPoll();
    const poll = setInterval(runPoll, 2000);
    const onVis = () => { if (document.visibilityState === "visible") runPoll(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, status]);

  // When MD5 becomes stale/expired, ask the user to confirm regen with a 5s cancellable countdown
  const REGEN_CONFIRM_S = 5;
  const [regenIn, setRegenIn] = useState<number | null>(null);
  const regenCancelledRef = useRef(false);
  useEffect(() => {
    if (status !== "expired" || !authed) {
      setRegenIn(null);
      regenCancelledRef.current = false;
      return;
    }
    regenCancelledRef.current = false;
    setRegenIn(REGEN_CONFIRM_S);
    onToast("MD5 ផុតកំណត់ — បង្កើត KHQR ថ្មីក្នុង 5s (អាចបោះបង់)");
    const t = setInterval(() => {
      setRegenIn((s) => {
        if (regenCancelledRef.current) { clearInterval(t); return null; }
        if (s === null) { clearInterval(t); return null; }
        if (s <= 1) {
          clearInterval(t);
          if (!regenCancelledRef.current) setTimeout(() => retryAndRegenerate(), 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, authed]);
  const cancelAutoRegen = () => { regenCancelledRef.current = true; setRegenIn(null); };

  // Auto-close countdown after successful payment
  useEffect(() => {
    if (status !== "paid") return;
    setAutoCloseIn(AUTO_CLOSE_S);
    const t = setInterval(() => {
      setAutoCloseIn((s) => {
        if (s <= 1) { clearInterval(t); onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status, onClose]);

  const manualVerify = async () => {
    if (!tx) return;
    if (Date.now() >= tx.expiresAt) { setStatus("expired"); return; }
    const checkingMd5 = tx.md5;
    setStatus("verifying");
    pushEvent({ kind: "bakong", label: "Manual verify started" });
    try {
      const r = await checkPayment({ data: { md5: checkingMd5 } });
      setLastChecked(Date.now());
      setPollTick((n) => n + 1);
      let mismatched = false;
      let expired = false;
      setTx((cur) => {
        if (!cur || cur.md5 !== checkingMd5) { mismatched = true; return cur; }
        if (Date.now() >= cur.expiresAt) { expired = true; return cur; }
        if (r.status === "paid") {
          setStatus("paid");
          setPaidAt(Date.now());
          const ref = (r as any).bakongRef ?? null;
          const nb = (r as any).newBalance ?? null;
          const cn = !!(r as any).creditedNow;
          setPaidInfo({ bakongRef: ref, newBalance: nb, creditedNow: cn });
          pushEvent({ kind: "bakong", label: "Bakong check: SUCCESS", detail: `responseCode=${(r as any).responseCode ?? 0}${ref ? ` · ref ${String(ref).slice(0, 14)}…` : ""}` });
          pushEvent({ kind: "credited", label: cn ? `Wallet credited (+${cur.coins})` : "Already credited (idempotent)", detail: nb != null ? `new balance ${nb} Coins` : undefined });
          onToast(`ការបង់ប្រាក់ជោគជ័យ ✓ — បន្ថែម ${cur.coins.toLocaleString()} Coins`);
          refresh();
        } else if (r.status === "expired") {
          setStatus("expired");
          pushEvent({ kind: "expired", label: "MD5 expired (server)" });
        } else {
          setStatus("qr");
          pushEvent({ kind: "bakong", label: "Bakong check: pending", detail: `responseCode=${(r as any).responseCode ?? "—"}` });
          onToast("មិនទាន់ទទួលការទូទាត់នៅឡើយទេ");
        }
        return cur;
      });
      if (mismatched) {
        setStatus("qr");
        setMismatch({ scanned: checkingMd5, active: tx?.md5 ?? "" });
        onToast("MD5 មិនត្រូវនឹង QR ដែលកំពុងសកម្ម — សូមស្កេន QR ថ្មី");
      } else if (expired) {
        setStatus("expired");
      }
    } catch (e: any) { setStatus("qr"); pushEvent({ kind: "error", label: "Manual verify error", detail: e?.message }); onToast(e?.message || "ផ្ទៀងផ្ទាត់បរាជ័យ"); }
  };

  return (
    <ModalShell onClose={closeAndClear} eyebrow="Bakong KHQR" title="ស្កេនដើម្បីបង់ប្រាក់">
      <div className="rounded-2xl bg-background/40 p-5 ring-1 ring-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{pack.name}</div>
            <div className="font-display text-xl text-coin">{(pack.coins + (pack.bonus ?? 0)).toLocaleString()} Coins</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">ប្រាក់ត្រូវបង់</div>
            <div className="font-display text-2xl">${pack.price}</div>
          </div>
        </div>
      </div>

      {/* Unified payment status panel */}
      {(() => {
        type S = { tone: string; ring: string; iconBg: string; icon: any; label: string; hint: string; action?: { label: string; onClick: () => void } | null };
        let s: S | null = null;
        if (status === "confirm") s = { tone: "text-foreground", ring: "ring-border", iconBg: "bg-muted text-muted-foreground", icon: ShoppingCart, label: "ត្រៀមបង់ប្រាក់", hint: "ពិនិត្យព័ត៌មានកញ្ចប់ មុនបង្កើត KHQR" };
        else if (status === "loading") s = { tone: "text-primary", ring: "ring-primary/30", iconBg: "bg-primary/15 text-primary animate-pulse", icon: Loader2, label: "កំពុងបង្កើត KHQR…", hint: "សូមរង់ចាំបន្តិច" };
        else if (status === "login") s = { tone: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30", iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: LogIn, label: "ត្រូវការចូលគណនី", hint: "ចូលគណនីដើម្បីបង្កើត KHQR និងផ្ទៀងផ្ទាត់" };
        else if (mismatch) s = { tone: "text-destructive", ring: "ring-destructive/40", iconBg: "bg-destructive/15 text-destructive", icon: AlertTriangle, label: "MD5 មិនត្រូវនឹង QR សកម្ម", hint: "QR ដែលបានស្កេនមិនមែនជា QR បច្ចុប្បន្ន — សូមស្កេនថ្មី", action: { label: "ស្កេន QR ថ្មី", onClick: () => {
          setMismatch(null);
          requestAnimationFrame(() => {
            const wrap = qrWrapRef.current;
            if (wrap) {
              wrap.scrollIntoView({ behavior: "smooth", block: "center" });
              wrap.classList.add("ring-4", "ring-emerald-500/60");
              setTimeout(() => wrap.classList.remove("ring-4", "ring-emerald-500/60"), 1600);
            }
          });
          onToast("សូមស្កេន KHQR ខាងក្រោម");
        } } };
        else if (status === "qr") s = { tone: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30", iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: QrCodeIcon, label: "កំពុងរង់ចាំការស្កេន", hint: "ស្កេន KHQR ខាងក្រោម — យើងពិនិត្យរៀងរាល់ ៤ វិនាទី" };
        else if (status === "verifying") s = { tone: "text-primary", ring: "ring-primary/30", iconBg: "bg-primary/15 text-primary animate-pulse", icon: Loader2, label: "កំពុងផ្ទៀងផ្ទាត់…", hint: "កំពុងសួរទៅ Bakong សម្រាប់ការទូទាត់" };
        else if (status === "paid") s = { tone: "text-primary", ring: "ring-primary/40", iconBg: "bg-primary text-primary-foreground", icon: Check, label: "បង់ប្រាក់ជោគជ័យ", hint: "Coins បានបន្ថែមចូល Wallet ដោយស្វ័យប្រវត្តិ" };
        else if (status === "expired") s = { tone: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/40", iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock, label: "KHQR ផុតកំណត់", hint: "MD5 មានសុពលភាព ៥ នាទី — ត្រូវបង្កើត QR ថ្មី", action: { label: "បង្កើត KHQR ថ្មី", onClick: retryAndRegenerate } };
        else if (status === "error") s = { tone: "text-destructive", ring: "ring-destructive/40", iconBg: "bg-destructive/15 text-destructive", icon: AlertTriangle, label: "មានបញ្ហា", hint: errMsg || "បង្កើត KHQR មិនបាន", action: authed ? { label: "ព្យាយាមម្ដងទៀត", onClick: retryAndRegenerate } : null };
        if (!s) return null;
        const Icon = s.icon;
        return (
          <div className={`mt-3 flex items-center gap-3 rounded-2xl bg-background/40 px-4 py-3 ring-1 ${s.ring}`}>
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${s.iconBg}`}>
              <Icon className={`h-4 w-4 ${status === "loading" || status === "verifying" ? "animate-spin" : ""}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-bold ${s.tone}`}>{s.label}</div>
              <div className="truncate text-[11px] text-muted-foreground">{s.hint}</div>
            </div>
            {s.action && (
              <button
                onClick={s.action.onClick}
                disabled={refreshing}
                className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-60"
              >
                {s.action.label}
              </button>
            )}
          </div>
        );
      })()}

      <div className="mt-5 grid place-items-center rounded-2xl bg-white p-5 min-h-[300px]">
        {tx && status !== "error" && status !== "loading" && status !== "confirm" && status !== "login" && (
          <div ref={qrWrapRef} className="rounded-xl bg-white p-2">
            <QRCode
              value={tx.qrPayload}
              size={256}
              bgColor="#FFFFFF"
              fgColor="#111111"
              level="M"
            />
          </div>
        )}
        {status === "confirm" && (
          <div className="flex w-full max-w-sm flex-col gap-4 text-center">
            <div className="grid gap-3 rounded-2xl border border-black/10 bg-black/[0.03] p-4 text-left">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-black/60">កញ្ចប់</span>
                <span className="text-sm font-semibold text-black">{pack.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-black/60">Coins ទទួលបាន</span>
                <span className="text-sm font-semibold text-black">{(pack.coins + (pack.bonus ?? 0)).toLocaleString()} Coins</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-black/60">តម្លៃត្រូវបង់</span>
                <span className="text-base font-semibold text-black">${pack.price}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-black/60">Wallet បច្ចុប្បន្ន</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-black">{authed ? `${coins.toLocaleString()} Coins` : "សូមចូលគណនីសិន"}</span>
                  {authed && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (refreshing) return;
                        setRefreshing(true);
                        try { await refresh(); onToast("បានធ្វើបច្ចុប្បន្នភាព Wallet"); }
                        catch { onToast("ធ្វើបច្ចុប្បន្នភាពបរាជ័យ"); }
                        finally { setRefreshing(false); }
                      }}
                      disabled={refreshing}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-black transition hover:bg-black/10 disabled:opacity-50"
                      title="ផ្ទុក Wallet ឡើងវិញ"
                    >
                      <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="text-xs text-black/60">ពិនិត្យព័ត៌មានខាងលើសិន មុនបង្កើត KHQR សម្រាប់ការទូទាត់នេះ។</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="inline-flex items-center justify-center rounded-full bg-black/5 px-4 py-3 text-sm font-semibold text-black transition hover:bg-black/10">
                បោះបង់
              </button>
              <button onClick={startPayment} className="inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90" style={{ background: "var(--gradient-hero)" }}>
                {authed ? "បង្កើត KHQR" : "បន្តទៅចូលគណនី"}
              </button>
            </div>
          </div>
        )}
        {status === "loading" && <div className="text-sm text-black/60">កំពុងបង្កើត KHQR…</div>}
        {status === "login" && (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
              <LogIn className="h-6 w-6" />
            </div>
            <div className="text-sm font-semibold text-black">សូមចូលគណនីសិន</div>
            <div className="text-xs text-black/60 max-w-xs">ត្រូវចូលគណនីជាមុនសិន ដើម្បីបង្កើត KHQR និងផ្ទៀងផ្ទាត់ការទូទាត់។</div>
            <button
              onClick={() => {
                onClose();
                navigate({ to: "/login" });
              }}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
            >
              <LogIn className="h-3.5 w-3.5" /> ចូលគណនីសិន
            </button>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="text-sm font-semibold text-black">បង្កើត KHQR មិនបាន</div>
            <div className="text-xs text-black/60 max-w-xs">{errMsg}</div>
            {authed ? (
              <button onClick={retryAndRegenerate} disabled={refreshing} className="mt-2 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> ផ្ទុក Wallet ឡើងវិញ & បង្កើត KHQR ថ្មី
              </button>
            ) : null}
          </div>
        )}
        {tx && status !== "error" && status !== "loading" && status !== "confirm" && status !== "login" && (
          <>
            <div className="mt-2 text-[11px] font-bold text-black tracking-wider">BAKONG KHQR · ${pack.price}</div>
            {(status === "qr" || status === "verifying") && (() => {
              const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
              const ss = String(secondsLeft % 60).padStart(2, "0");
              const pct = Math.max(0, Math.min(100, (secondsLeft / POLL_WINDOW_S) * 100));
              const lcSec = lastChecked ? Math.max(0, Math.round((Date.now() - lastChecked) / 1000)) : null;
              const _ = pollTick; // re-render trigger for "Xs ago"
              const lowTime = secondsLeft <= 30;
              return (
                <div className="mt-3 w-full max-w-[260px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/30">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      {status === "verifying" ? "កំពុងផ្ទៀងផ្ទាត់…" : "ផ្ទៀងផ្ទាត់ផ្ទាល់"}
                    </div>
                    <div className={`font-mono text-[12px] font-bold tabular-nums ${lowTime ? "text-destructive" : "text-black/80"}`}>
                      {mm}:{ss}
                    </div>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-black/10">
                    <div
                      className={`h-full transition-[width] duration-1000 ease-linear ${lowTime ? "bg-destructive" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-black/50">
                    <span>ពិនិត្យរៀងរាល់ ៤ វិនាទី</span>
                    <span>{lcSec === null ? "កំពុងចាប់ផ្ដើម…" : `ពិនិត្យចុងក្រោយ ${lcSec}s មុន`}</span>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        ស្កេន KHQR តាម Bakong, ABA, Wing, ACLEDA ឬកម្មវិធីធនាគារផ្សេងទៀត។ Coins នឹងចូល Wallet ស្វ័យប្រវត្តិពេល Bakong បញ្ជាក់។
      </p>

      {tx && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-background/40 p-2 ring-1 ring-border text-xs">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">NEW</span>
            <span className="font-mono text-muted-foreground">MD5</span>
            <span className="flex-1 truncate font-mono">{tx.md5}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              ផុត {new Date(tx.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>

          {/* Bakong API status: end-to-end pipeline indicator */}
          {(() => {
            const genOk = !!(tx.qrPayload && tx.md5);
            const clientOk = genOk && md5Hex(tx.qrPayload) === tx.md5;
            const verifyState: "paid" | "checking" | "polling" | "expired" | "idle" =
              status === "paid" ? "paid"
              : status === "verifying" ? "checking"
              : status === "expired" ? "expired"
              : (lastChecked ? "polling" : "idle");
            const Pill = ({ tone, label }: { tone: "ok" | "warn" | "bad" | "muted"; label: string }) => {
              const map = {
                ok: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/40",
                warn: "bg-amber-500/15 text-amber-500 ring-amber-500/40",
                bad: "bg-rose-500/15 text-rose-500 ring-rose-500/40",
                muted: "bg-muted text-muted-foreground ring-border",
              } as const;
              return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${map[tone]}`}>{label}</span>;
            };
            const verifyPill =
              verifyState === "paid" ? <Pill tone="ok" label="PAID ✓" />
              : verifyState === "checking" ? <Pill tone="warn" label="CHECKING…" />
              : verifyState === "polling" ? <Pill tone="warn" label={`POLLING · ${pollTick}`} />
              : verifyState === "expired" ? <Pill tone="bad" label="EXPIRED" />
              : <Pill tone="muted" label="IDLE" />;
            return (
              <div className="mt-2 rounded-lg bg-background/40 p-2.5 ring-1 ring-border/70 text-xs">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-400 ring-1 ring-cyan-500/30">BAKONG API</span>
                  <span className="font-mono text-muted-foreground">end-to-end status</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {lastChecked ? `last check ${new Date(lastChecked).toLocaleTimeString()}` : "no checks yet"}
                  </span>
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3 rounded bg-background/40 px-2 py-1.5">
                    <span className="text-[11px] font-semibold">1 · KHQR Generation</span>
                    {genOk ? <Pill tone="ok" label="SUCCESS ✓" /> : <Pill tone="bad" label="FAILED" />}
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded bg-background/40 px-2 py-1.5">
                    <span className="text-[11px] font-semibold">2 · Client MD5 Match</span>
                    {clientOk ? <Pill tone="ok" label="MATCH ✓" /> : <Pill tone="bad" label="MISMATCH ✗" />}
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded bg-background/40 px-2 py-1.5">
                    <span className="text-[11px] font-semibold">3 · Bakong MD5 Verify</span>
                    {verifyPill}
                  </div>
                </div>
                {errMsg && (
                  <div className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-[11px] text-rose-400 ring-1 ring-rose-500/30">
                    {errMsg}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Payment timeline: chronological log of every verification step */}
          {events.length > 0 && (
            <div className="mt-2 rounded-lg bg-background/40 p-2.5 ring-1 ring-border/70 text-xs">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-400 ring-1 ring-violet-500/30">TIMELINE</span>
                <span className="font-mono text-muted-foreground">verification steps</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{events.length} event{events.length === 1 ? "" : "s"}</span>
              </div>
              <ol className="relative space-y-1.5 border-l border-border/60 pl-3">
                {events.map((e, i) => {
                  const dot =
                    e.kind === "khqr" ? "bg-cyan-400"
                    : e.kind === "md5" ? "bg-blue-400"
                    : e.kind === "bakong" ? "bg-amber-400"
                    : e.kind === "credited" ? "bg-emerald-400"
                    : e.kind === "expired" ? "bg-rose-400"
                    : "bg-rose-500";
                  const t0 = events[0].at;
                  const dt = e.at - t0;
                  return (
                    <li key={i} className="relative">
                      <span className={`absolute -left-[15px] top-1.5 h-2 w-2 rounded-full ring-2 ring-background ${dot}`} />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">{e.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(e.at).toLocaleTimeString([], { hour12: false })}
                          <span className="ml-1 opacity-60">+{(dt / 1000).toFixed(2)}s</span>
                        </span>
                      </div>
                      {e.detail && <div className="font-mono text-[10px] text-muted-foreground">{e.detail}</div>}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Debug panel: merchant config + final MD5 used to verify with Bakong */}
          <details
            open={debugOpen}
            onToggle={(e) => setDebugOpen((e.target as HTMLDetailsElement).open)}
            className="mt-2 rounded-lg bg-background/30 p-2 ring-1 ring-dashed ring-border/70 text-xs"
          >
            <summary className="flex cursor-pointer select-none items-center gap-2">
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500 ring-1 ring-amber-500/30">DEBUG</span>
              <span className="font-mono text-muted-foreground">KHQR config & MD5</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{debugOpen ? "បិទ" : "បើក"}</span>
            </summary>
            <div className="mt-2 grid gap-1.5">
              {[
                ["Merchant Name", merchantInfo?.merchantName],
                ["Merchant City", merchantInfo?.merchantCity],
                ["Merchant Phone", merchantInfo?.merchantPhone],
                ["Acquiring Bank", merchantInfo?.acquiringBank],
                ["Bakong Account", merchantInfo?.bakongAccountIdMasked],
                ["Amount", `$${pack.price} USD`],
                ["Coins", `${(pack.coins + (pack.bonus ?? 0)).toLocaleString()}`],
                ["Tx Created", new Date(tx.createdAt).toLocaleTimeString()],
                ["Tx Expires", new Date(tx.expiresAt).toLocaleTimeString()],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-start justify-between gap-3 rounded bg-background/40 px-2 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</span>
                  <span className="max-w-[60%] truncate text-right font-mono text-[11px]">{v ?? <span className="text-destructive">— not set —</span>}</span>
                </div>
              ))}
              <div className="rounded bg-background/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Final MD5 (verify)</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(tx.md5); onToast("បានចម្លង MD5"); }
                      catch { onToast("ចម្លងបរាជ័យ"); }
                    }}
                    className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold hover:bg-secondary/80"
                  >
                    <Copy className="h-2.5 w-2.5" /> Copy
                  </button>
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-foreground">{tx.md5}</div>
              </div>
              {(() => {
                const recomputed = md5Hex(tx.qrPayload);
                const ok = recomputed === tx.md5;
                return (
                  <div
                    className={`rounded p-2 ring-1 ${
                      ok
                        ? "bg-emerald-500/10 ring-emerald-500/40"
                        : "bg-rose-500/10 ring-rose-500/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Client MD5 Verify
                      </span>
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ok
                            ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40"
                            : "bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/40"
                        }`}
                      >
                        {ok ? "MATCH ✓" : "MISMATCH ✗"}
                      </span>
                    </div>
                    <div className="mt-1 break-all font-mono text-[11px] text-foreground">
                      {recomputed}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {ok
                        ? "MD5 ដែលគណនាពី QR payload ផ្ទាល់ ត្រូវនឹង MD5 របស់ server។"
                        : "MD5 ខុសគ្នា — QR payload អាចត្រូវបានកែប្រែ។"}
                    </div>
                  </div>
                );
              })()}
              <div className="rounded bg-background/40 p-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">QR Payload</div>
                <div className="mt-1 max-h-24 overflow-auto break-all font-mono text-[10px] leading-relaxed">{tx.qrPayload}</div>
              </div>
            </div>
          </details>

          {prevTx && prevTx.md5 !== tx.md5 && (
            <details className="mt-2 rounded-lg bg-background/30 p-2 ring-1 ring-border/60 text-xs">
              <summary className="flex cursor-pointer items-center gap-2 select-none">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">PREVIOUS</span>
                <span className="font-mono text-muted-foreground truncate">{prevTx.md5.slice(0, 16)}…</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  ផុត {new Date(prevTx.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </summary>
              <div className="mt-2 grid gap-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>បានបង្កើត: {new Date(prevTx.createdAt).toLocaleTimeString()}</span>
                  <span>{prevTx.coins.toLocaleString()} Coins</span>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="font-mono text-[10px] text-muted-foreground">PAYLOAD</div>
                  <div className="mt-1 max-h-20 overflow-auto break-all font-mono text-[10px] leading-relaxed">{prevTx.qrPayload}</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(prevTx.qrPayload); onToast("បានចម្លង KHQR មុន"); }
                    catch { onToast("ចម្លងបរាជ័យ"); }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-secondary px-2 py-1.5 text-[11px] font-semibold hover:bg-secondary/80"
                >
                  <Copy className="h-3 w-3" /> ចម្លង payload មុន
                </button>
              </div>
            </details>
          )}
          {status !== "error" && status !== "loading" && status !== "confirm" && status !== "login" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  try {
                    const svgEl = qrWrapRef.current?.querySelector("svg");
                    if (!svgEl) throw new Error("svg");
                    // Clone & normalize SVG so it has explicit width/height + viewBox
                    const clone = svgEl.cloneNode(true) as SVGSVGElement;
                    let vb = clone.getAttribute("viewBox");
                    if (!vb) {
                      const w = clone.getAttribute("width") || "256";
                      const h = clone.getAttribute("height") || "256";
                      vb = `0 0 ${parseFloat(w)} ${parseFloat(h)}`;
                      clone.setAttribute("viewBox", vb);
                    }
                    const [, , vbW, vbH] = vb.split(/\s+/).map(Number);
                    const scale = Math.max(1, Math.floor(1024 / Math.max(vbW, vbH)));
                    const qrPx = Math.round(Math.max(vbW, vbH) * scale);
                    const padding = Math.round(qrPx * 0.08);
                    const size = qrPx + padding * 2;
                    clone.setAttribute("width", String(qrPx));
                    clone.setAttribute("height", String(qrPx));
                    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                    const svgMarkup = new XMLSerializer().serializeToString(clone);
                    const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
                    const svgUrl = URL.createObjectURL(svgBlob);
                    const img = new Image();
                    img.decoding = "sync";
                    img.width = qrPx;
                    img.height = qrPx;
                    img.src = svgUrl;
                    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); });
                    const drawW = img.naturalWidth || qrPx;
                    const drawH = img.naturalHeight || qrPx;
                    const canvas = document.createElement("canvas");
                    canvas.width = size; canvas.height = size;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) throw new Error("canvas");
                    ctx.imageSmoothingEnabled = false;
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, size, size);
                    const dx = Math.round((size - drawW) / 2);
                    const dy = Math.round((size - drawH) / 2);
                    ctx.drawImage(img, dx, dy, drawW, drawH);
                    URL.revokeObjectURL(svgUrl);
                    const blob: Blob = await new Promise((res, rej) =>
                      canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png")
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `khqr-${pack.id}-${tx.md5.slice(0, 8)}.png`;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    onToast("បានទាញយក QR (PNG)");
                  } catch { onToast("ទាញយកបរាជ័យ"); }
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80"
              >
                <Download className="h-3.5 w-3.5" /> ទាញយក PNG
              </button>
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(tx.qrPayload); onToast("បានចម្លង KHQR payload"); }
                  catch { onToast("ចម្លងបរាជ័យ"); }
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80"
              >
                <Copy className="h-3.5 w-3.5" /> ចម្លង KHQR
              </button>
            </div>
          )}
        </>
      )}

      {status === "qr" && (
        <button onClick={manualVerify} className="mt-5 w-full rounded-full px-5 py-3 font-semibold text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
          ខ្ញុំបានបង់ប្រាក់រួច — ផ្ទៀងផ្ទាត់ឥឡូវ
        </button>
      )}
      {status === "verifying" && (
        <div className="mt-5 rounded-full bg-background/40 px-5 py-3 text-center text-sm text-muted-foreground ring-1 ring-border animate-pulse">កំពុងផ្ទៀងផ្ទាត់…</div>
      )}
      {status === "paid" && (
        <div className="mt-5 overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/30">
          <div className="flex items-center gap-3 bg-primary/20 px-4 py-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-primary">ការបង់ប្រាក់ជោគជ័យ</div>
              <div className="text-[11px] text-primary/80">Coins បានបន្ថែមចូល Wallet ដោយស្វ័យប្រវត្តិ</div>
            </div>
            <div className="text-right">
              <div className="font-display text-xl text-primary leading-none">+{(tx?.coins ?? pack.coins + (pack.bonus ?? 0)).toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-primary/70">Coins</div>
            </div>
          </div>
          <div className="grid gap-1.5 px-4 py-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">កញ្ចប់</span>
              <span className="font-semibold">{pack.name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">តម្លៃ</span>
              <span className="font-semibold">${pack.price}</span>
            </div>
            {tx && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">MD5</span>
                <span className="truncate font-mono text-[10px]">{tx.md5}</span>
              </div>
            )}
            {paidInfo?.bakongRef && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Bakong Ref / Hash</span>
                <span className="truncate font-mono text-[10px]" title={paidInfo.bakongRef}>{paidInfo.bakongRef}</span>
              </div>
            )}
            {paidInfo?.newBalance != null && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Wallet ថ្មី</span>
                <span className="font-display text-sm text-coin">{paidInfo.newBalance.toLocaleString()} Coins</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">ស្ថានភាព</span>
              <span className="font-semibold text-primary">
                {paidInfo?.creditedNow ? "Credited ✓ (Bakong API)" : "Confirmed ✓ (Bakong API)"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">ពេលវេលា</span>
              <span className="font-mono text-[11px]">
                {paidAt ? new Date(paidAt).toLocaleString([], { dateStyle: "short", timeStyle: "medium" }) : "—"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-primary/20 bg-background/30 px-4 py-2">
            <div className="flex-1 text-[11px] text-muted-foreground">
              បិទដោយស្វ័យប្រវត្តិក្នុង <span className="font-mono font-semibold text-primary">{autoCloseIn}s</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
            >
              បិទឥឡូវ
            </button>
          </div>
        </div>
      )}
      {status === "expired" && (
        <div className="mt-5 space-y-2">
          {regenIn !== null && regenIn > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-xs ring-1 ring-amber-500/30">
              <span className="font-medium text-amber-600 dark:text-amber-400">
                បង្កើត KHQR ថ្មីដោយស្វ័យប្រវត្តិក្នុង <span className="font-bold">{regenIn}s</span>
              </span>
              <button
                onClick={cancelAutoRegen}
                className="rounded-full bg-background/60 px-3 py-1 text-[11px] font-semibold ring-1 ring-border hover:bg-background"
              >
                បោះបង់
              </button>
            </div>
          )}
          <button onClick={() => { cancelAutoRegen(); retryAndRegenerate(); }} disabled={refreshing} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-destructive/20 px-5 py-3 text-sm font-semibold text-destructive ring-1 ring-destructive/40 hover:bg-destructive/30 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> ផ្ទុក Wallet ឡើងវិញ & បង្កើត KHQR ថ្មីឥឡូវ
          </button>
        </div>
      )}
      {status === "error" && authed && (
        <button onClick={retryAndRegenerate} disabled={refreshing} className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60" style={{ background: "var(--gradient-hero)" }}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> ផ្ទុក Wallet ឡើងវិញ & បង្កើត KHQR ថ្មី
        </button>
      )}
    </ModalShell>
  );
}
