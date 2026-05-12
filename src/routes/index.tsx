import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { Coins, ShoppingCart, Settings, LogIn, LogOut, X, Trash2, Check, Star, Zap, Clock, Heart, Send, Gamepad2, Sparkles, ImageIcon, AlertTriangle, RefreshCw, Download, Copy } from "lucide-react";
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
  const [autoCloseIn, setAutoCloseIn] = useState<number>(0);
  const POLL_WINDOW_S = 300;
  const AUTO_CLOSE_S = 6;

  const retry = () => {
    setStatus("confirm");
    setErrMsg("");
    setTx(null);
    setSecondsLeft(300);
  };

  const retryAndRegenerate = async () => {
    if (!authed) { setStatus("login"); return; }
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
    setStatus("loading");
    setErrMsg("");
    setTx(null);
    setSecondsLeft(POLL_WINDOW_S);

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
      setStatus("qr");
    } catch (e: any) {
      setStatus("error");
      setErrMsg(e?.message || "មានបញ្ហាបង្កើតការទូទាត់");
    }
  };

  // 5-minute MD5 validity window — countdown + status polling
  useEffect(() => {
    if (!tx || (status !== "qr" && status !== "verifying")) return;
    const WINDOW_MS = POLL_WINDOW_S * 1000;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((tx.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setStatus("expired");
    }, 1000);
    const poll = setInterval(async () => {
      // Stop polling stale MD5 — server will reject anyway after 5 min
      if (Date.now() >= tx.expiresAt) { clearInterval(poll); setStatus("expired"); return; }
      try {
        const r = await checkPayment({ data: { md5: tx.md5 } });
        setLastChecked(Date.now());
        setPollTick((n) => n + 1);
        if (r.status === "paid") {
          setStatus("paid");
          setPaidAt(Date.now());
          onToast(`បានបន្ថែម ${tx.coins.toLocaleString()} Coins ✓`);
          refresh();
        } else if (r.status === "expired") {
          setStatus("expired");
        }
      } catch {}
    }, 4000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [tx, status, checkPayment, onClose, onToast, refresh]);

  // When MD5 becomes stale/expired, automatically force-generate a fresh KHQR
  const autoRegenRef = useRef(false);
  useEffect(() => {
    if (status !== "expired") { autoRegenRef.current = false; return; }
    if (!authed) return;
    if (autoRegenRef.current) return;
    autoRegenRef.current = true;
    onToast("MD5 ផុតកំណត់ — កំពុងបង្កើត KHQR ថ្មី");
    const t = setTimeout(() => { retryAndRegenerate(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, authed]);

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
    setStatus("verifying");
    try {
      const r = await checkPayment({ data: { md5: tx.md5 } });
      setLastChecked(Date.now());
      setPollTick((n) => n + 1);
      if (r.status === "paid") {
        setStatus("paid"); setPaidAt(Date.now()); onToast("ការបង់ប្រាក់ជោគជ័យ ✓"); refresh();
      } else if (r.status === "expired") setStatus("expired");
      else { setStatus("qr"); onToast("មិនទាន់ទទួលការទូទាត់នៅឡើយទេ"); }
    } catch (e: any) { setStatus("qr"); onToast(e?.message || "ផ្ទៀងផ្ទាត់បរាជ័យ"); }
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
        <button onClick={retryAndRegenerate} disabled={refreshing} className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-destructive/20 px-5 py-3 text-sm font-semibold text-destructive ring-1 ring-destructive/40 hover:bg-destructive/30 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> ផ្ទុក Wallet ឡើងវិញ & បង្កើត KHQR ថ្មី
        </button>
      )}
      {status === "error" && authed && (
        <button onClick={retryAndRegenerate} disabled={refreshing} className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60" style={{ background: "var(--gradient-hero)" }}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> ផ្ទុក Wallet ឡើងវិញ & បង្កើត KHQR ថ្មី
        </button>
      )}
    </ModalShell>
  );
}
