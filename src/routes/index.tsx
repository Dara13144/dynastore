import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode/lib/browser";
import { Coins, ShoppingCart, Settings, LogIn, LogOut, X, Trash2, Check, Star, Zap, Clock, Heart, Send, Gamepad2, Sparkles, ImageIcon } from "lucide-react";
import { StoreProvider, useStore, GAMES, COIN_PACKS, gameFinalPrice, type CoinPack, type Game } from "@/lib/store";
import { createTopup as createTopupFn, checkPayment as checkPaymentFn } from "@/lib/bakong.functions";
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

function CoinShop({ onBuyPack }: { onBuyPack: (p: CoinPack) => void }) {
  return (
    <section id="coins" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-coin/15 px-3 py-1 text-xs font-medium text-coin ring-1 ring-coin/30">
          <Coins className="h-3.5 w-3.5" /> Coin Shop
        </div>
        <h2 className="mt-4 font-display text-4xl md:text-5xl">ទិញ <span className="text-coin">Coins</span> ដើម្បីទិញហ្គេម</h2>
        <p className="mt-3 text-muted-foreground">ជ្រើសរើសកញ្ចប់ Coins ហើយបង់ប្រាក់តាម Bakong KHQR។ Coins នឹងចូល Wallet បន្ទាប់ពីការបង់ប្រាក់ត្រូវបានផ្ទៀងផ្ទាត់។</p>
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
                <button onClick={() => onBuyPack(p)} className="rounded-full px-4 py-2 text-sm font-semibold text-coin-foreground transition hover:scale-105" style={{ background: "var(--gradient-coin)" }}>
                  ទិញ Coins
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
          { t: "ហាង", l: ["ហ្គេម", "Coins", "ប្រូម៉ូសិន"] },
          { t: "ជំនួយ", l: ["ទំនាក់ទំនង", "សំណួរញឹកញាប់", "ការត្រឡប់ Coins"] },
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

function PaymentModal({ pack, onClose, onToast }: { pack: CoinPack; onClose: () => void; onToast: (m: string) => void }) {
  const { authed, refresh } = useStore();
  const createTopup = useServerFn(createTopupFn);
  const checkPayment = useServerFn(checkPaymentFn);
  const [tx, setTx] = useState<{ md5: string; qrPayload: string; coins: number } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "qr" | "verifying" | "paid" | "expired" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(300); // 5 minutes

  useEffect(() => {
    if (!authed) { setStatus("error"); setErrMsg("សូមចូលគណនីសិន"); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await createTopup({ data: { packId: pack.id } });
        if (cancelled) return;
        setTx({ md5: res.md5, qrPayload: res.qrPayload, coins: res.coins });
        const url = await QRCode.toDataURL(res.qrPayload, { margin: 1, width: 280, errorCorrectionLevel: "M" });
        if (!cancelled) { setQrDataUrl(url); setStatus("qr"); }
      } catch (e: any) { if (!cancelled) { setStatus("error"); setErrMsg(e.message || "មានបញ្ហា"); } }
    })();
    return () => { cancelled = true; };
  }, [pack.id, authed, createTopup]);

  // Auto-poll Bakong every 4s for up to 5 minutes
  useEffect(() => {
    if (!tx || (status !== "qr" && status !== "verifying")) return;
    const startedAt = Date.now();
    const WINDOW_MS = 5 * 60 * 1000;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((WINDOW_MS - (Date.now() - startedAt)) / 1000));
      setSecondsLeft(left);
      if (left === 0) setStatus("expired");
    }, 1000);
    const poll = setInterval(async () => {
      if (Date.now() - startedAt > WINDOW_MS) { clearInterval(poll); return; }
      try {
        const r = await checkPayment({ data: { md5: tx.md5 } });
        if (r.status === "paid") {
          setStatus("paid");
          onToast(`បានបន្ថែម ${tx.coins.toLocaleString()} Coins ✓`);
          refresh();
          setTimeout(onClose, 1500);
        } else if (r.status === "expired") {
          setStatus("expired");
        }
      } catch {}
    }, 4000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [tx, status, checkPayment, onClose, onToast, refresh]);

  const manualVerify = async () => {
    if (!tx) return;
    setStatus("verifying");
    try {
      const r = await checkPayment({ data: { md5: tx.md5 } });
      if (r.status === "paid") {
        setStatus("paid"); onToast("ការបង់ប្រាក់ជោគជ័យ ✓"); refresh();
        setTimeout(onClose, 1400);
      } else if (r.status === "expired") setStatus("expired");
      else { setStatus("qr"); onToast("មិនទាន់ទទួលការទូទាត់នៅឡើយទេ"); }
    } catch (e: any) { setStatus("qr"); onToast(e.message || "ផ្ទៀងផ្ទាត់បរាជ័យ"); }
  };

  return (
    <ModalShell onClose={onClose} eyebrow="Bakong KHQR" title="ស្កេនដើម្បីបង់ប្រាក់">
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

      <div className="mt-5 grid place-items-center rounded-2xl bg-white p-5 min-h-[300px]">
        {status === "loading" && <div className="text-sm text-black/60">កំពុងបង្កើត KHQR…</div>}
        {status === "error" && <div className="text-sm text-destructive p-4 text-center">{errMsg}</div>}
        {qrDataUrl && status !== "error" && status !== "loading" && (
          <>
            <img src={qrDataUrl} alt="KHQR" className="h-64 w-64" />
            <div className="mt-2 text-[11px] font-bold text-black tracking-wider">BAKONG KHQR · ${pack.price}</div>
            {(status === "qr" || status === "verifying") && (
              <div className="mt-1 text-[11px] text-black/60">
                ផុតកំណត់ក្នុង {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        ស្កេន KHQR តាម Bakong, ABA, Wing, ACLEDA ឬកម្មវិធីធនាគារផ្សេងទៀត។ Coins នឹងចូល Wallet ស្វ័យប្រវត្តិពេល Bakong បញ្ជាក់។
      </p>

      {tx && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-background/40 p-2 ring-1 ring-border text-xs">
          <span className="font-mono text-muted-foreground">MD5</span>
          <span className="flex-1 truncate font-mono">{tx.md5}</span>
          <button onClick={() => { navigator.clipboard?.writeText(tx.qrPayload); onToast("Copied KHQR"); }} className="rounded-md bg-secondary px-2 py-1 text-[10px]">Copy QR</button>
        </div>
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
        <div className="mt-5 rounded-full bg-primary/20 px-5 py-3 text-center text-sm font-semibold text-primary ring-1 ring-primary/40 inline-flex items-center justify-center gap-2 w-full">
          <Check className="h-4 w-4" /> ការបង់ប្រាក់ជោគជ័យ — Coins បានបន្ថែម
        </div>
      )}
      {status === "expired" && (
        <div className="mt-5 rounded-full bg-destructive/20 px-5 py-3 text-center text-sm font-semibold text-destructive ring-1 ring-destructive/40">
          QR ផុតកំណត់ — សូមបិទ ហើយបង្កើតថ្មី
        </div>
      )}
    </ModalShell>
  );
}

function SettingsModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { profile, setProfile, library } = useStore();
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

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-background/40 p-4 ring-1 ring-border">
          <Stat label="ហ្គេមមាន" v={library.length} />
          <Stat label="Wallet" v={`${useStore().coins}c`} />
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

