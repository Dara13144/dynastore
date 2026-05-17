import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Settings,
  LogIn,
  LogOut,
  Star,
  Send,
  Gamepad2,
  Sparkles,
  X,
  Library,
  Check,
  Loader2,
  Wallet,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreProvider, useStore, type Game } from "@/lib/store";
import { purchaseGame } from "@/lib/payment.functions";
import { TopupModal } from "@/components/TopupModal";
import { DynastoreAIChat } from "@/components/DynastoreAIChat";

import heroImg from "@/assets/hero-arcade.jpg";
import logoD from "@/assets/dyna-logo.jpeg";
import iconTelegram from "@/assets/social-telegram.png";
import iconTiktok from "@/assets/social-tiktok.png";
import iconFacebook from "@/assets/social-facebook.png";
import payAba from "@/assets/pay-aba.jpg";
import payAcleda from "@/assets/pay-acleda.png";
import payWing from "@/assets/pay-wing.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dyna Store — ហាងហ្គេម PC និង Console" },
      {
        name: "description",
        content: "ហាងហ្គេម PC និង Console នៅកម្ពុជា — ទាញយកហ្គេមបានភ្លាមៗបន្ទាប់ពីការទិញ។",
      },
      { property: "og:title", content: "Dyna Store — ហាងហ្គេម PC និង Console" },
      {
        property: "og:description",
        content: "ហាងហ្គេម PC និង Console នៅកម្ពុជា — ទាញយកហ្គេមបានភ្លាមៗបន្ទាប់ពីការទិញ។",
      },
      { property: "og:url", content: "https://dynastore.lovable.app/" },
    ],
    links: [
      { rel: "preload", as: "image", href: heroImg, fetchpriority: "high" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bayon&family=Noto+Sans+Khmer:wght@400;500;600;700&display=swap",
      },
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
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onSettings={() => setSettingsOpen(true)} onTopup={() => setTopupOpen(true)} />
      <main>
        <Hero />
        <GamesSection onToast={showToast} />
        <DealsBanner />
        <Recommendations onToast={showToast} />
      </main>
      <Footer />

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onToast={showToast} />}
      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} onToast={showToast} />}

      <DynastoreAIChat />

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
          <a href="#games" className="hover:text-foreground transition">
            ហ្គេម
          </a>
          <a href="#deals" className="hover:text-foreground transition">
            ប្រូម៉ូសិន
          </a>
          <a href="#community" className="hover:text-foreground transition">
            សហគមន៍
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {authed && (
            <button
              onClick={onTopup}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              <Wallet className="h-3.5 w-3.5" /> {balance.toLocaleString()}{" "}
              <Plus className="h-3 w-3" />
            </button>
          )}
          {authed && (
            <Link
              to="/library"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Library className="h-3.5 w-3.5" /> បណ្ណាល័យ
            </Link>
          )}
          <button
            onClick={onSettings}
            className="p-2 rounded-full hover:bg-accent transition"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          {authed ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  Admin
                </Link>
              )}
              <Link
                to="/account"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                គណនី
              </Link>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <LogOut className="h-3.5 w-3.5" /> ចេញ
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
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
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>
      <div className="relative container mx-auto px-4 py-20 md:py-28 max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground mb-5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> ហ្គេម PC និង Console
        </div>
        <h1 className="font-display text-4xl md:text-6xl tracking-tight">
          <span className="gradient-text">ទិញហ្គេម</span> ដោយ Balance
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          ទិញហ្គេម PC/Console ភ្លាមៗដោយ Balance របស់អ្នក។
        </p>
      </div>
    </section>
  );
}

function GamesSection({ onToast }: { onToast: (m: string) => void }) {
  const { games } = useStore();
  return (
    <section id="games" className="container mx-auto px-4 py-14">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl md:text-3xl">ហ្គេមពេញនិយម</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ច្រើនជំនាន់ ច្រើនប្រភេទ — រកមួយដែលសាកសម។
          </p>
        </div>
        <Gamepad2 className="h-6 w-6 text-primary hidden sm:block" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((g) => (
          <GameCard key={g.id} game={g} onToast={onToast} />
        ))}
      </div>
    </section>
  );
}

function GameCard({ game, onToast }: { game: Game; onToast: (m: string) => void }) {
  const { authed, balance, library, toggleWishlist, refreshWallet, refreshLibrary } = useStore();
  const owned = library.some((l) => l.game_id === game.id && l.kind === "owned");
  const wished = library.some((l) => l.game_id === game.id && l.kind === "wishlist");
  const [busy, setBusy] = useState(false);
  const purchaseFn = useServerFn(purchaseGame);

  const buy = async () => {
    if (!authed) {
      onToast("សូមចូលគណនីជាមុនសិន");
      return;
    }
    if (balance < game.price_coins) {
      onToast("Balance មិនគ្រប់គ្រាន់");
      return;
    }
    setBusy(true);
    try {
      const r = await purchaseFn({ data: { gameId: game.id } });
      if (r.ok) {
        onToast(r.message === "already_owned" ? "អ្នកមានហ្គេមនេះរួចហើយ" : "ទិញបានជោគជ័យ!");
        await Promise.all([refreshWallet(), refreshLibrary()]);
      } else if (r.message === "insufficient_balance") {
        onToast("Balance មិនគ្រប់គ្រាន់");
      } else onToast(r.message || "បរាជ័យ");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "បរាជ័យ");
    } finally {
      setBusy(false);
    }
  };

  const wish = async () => {
    if (!authed) {
      onToast("សូមចូលគណនីជាមុនសិន");
      return;
    }
    const r = await toggleWishlist(game.id);
    if (r.error) onToast(r.error);
    else onToast(r.added ? "បានបន្ថែមទៅបញ្ជី" : "បានដក");
  };

  return (
    <article className="group glass rounded-2xl border border-border/60 overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <Link
        to="/games/$id"
        params={{ id: game.id }}
        className="block relative aspect-[16/10] overflow-hidden"
      >
        <img
          src={game.image}
          alt={game.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        {game.badge && (
          <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {game.badge}
          </span>
        )}
        {owned && (
          <span className="absolute top-3 right-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-white inline-flex items-center gap-1">
            <Check className="h-3 w-3" /> ជាកម្មសិទ្ធ
          </span>
        )}
      </Link>
      <div className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {game.category}
        </div>
        <Link to="/games/$id" params={{ id: game.id }} className="block">
          <h3 className="font-display text-lg mt-0.5 hover:text-primary transition">
            {game.title}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{game.description}</p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="inline-flex items-center gap-1 font-semibold text-primary">
              <Wallet className="h-3.5 w-3.5" /> {game.price_coins.toLocaleString()}
            </div>
            {authed && !owned && (
              <div
                className={`inline-flex items-center gap-1 ${balance >= game.price_coins ? "text-emerald-400" : "text-amber-400"}`}
              >
                <Wallet className="h-3 w-3" /> Balance: {balance.toLocaleString()}
              </div>
            )}
          </div>
          {authed && !owned && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/40">
              <div
                className={`h-full transition-all ${balance >= game.price_coins ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${Math.min(100, (balance / game.price_coins) * 100)}%` }}
              />
            </div>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={wish}
              aria-label={
                wished
                  ? `ដកចេញពីបញ្ជីចង់លេង — ${game.title}`
                  : `បន្ថែមទៅបញ្ជីចង់លេង — ${game.title}`
              }
              aria-pressed={wished}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs hover:bg-accent ${wished ? "border-primary text-primary" : "border-border"}`}
            >
              <Star className={`h-3.5 w-3.5 ${wished ? "fill-primary" : ""}`} />
            </button>
            {owned ? (
              <button
                disabled
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 px-3 py-1.5 text-xs font-semibold"
              >
                មាន
              </button>
            ) : authed && balance < game.price_coins ? (
              <button
                disabled
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 text-amber-300 px-3 py-1.5 text-xs font-semibold opacity-80"
              >
                Balance មិនគ្រប់គ្រាន់
              </button>
            ) : (
              <button
                onClick={buy}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
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
  const [promo, setPromo] = useState<{ title: string; subtitle: string | null } | null>(null);
  useEffect(() => {
    supabase
      .from("promotions")
      .select("title, subtitle")
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPromo(data as any);
      });
  }, []);
  if (!promo) return null;
  return (
    <section id="deals" className="container mx-auto px-4 py-8">
      <div
        className="rounded-3xl p-8 md:p-10 text-center"
        style={{ background: "var(--gradient-hero)" }}
      >
        <h3 className="font-display text-2xl md:text-3xl text-primary-foreground">{promo.title}</h3>
        {promo.subtitle && (
          <p className="text-sm md:text-base text-primary-foreground/80 mt-2">{promo.subtitle}</p>
        )}
      </div>
    </section>
  );
}

type DbRec = { id: string; name: string; game: string | null; text: string };
function Recommendations({ onToast }: { onToast: (m: string) => void }) {
  const [recs, setRecs] = useState<DbRec[]>([]);
  const [name, setName] = useState("");
  const [game, setGame] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    supabase
      .from("testimonials")
      .select("id, name, game, text")
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setRecs((data ?? []) as DbRec[]));
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    onToast("អរគុណចំពោះមតិរបស់អ្នក! នឹងបង្ហាញបន្ទាប់ពីការអនុម័ត។");
    setName("");
    setGame("");
    setText("");
  };
  return (
    <section id="community" className="container mx-auto px-4 py-14">
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div>
          <h2 className="font-display text-2xl md:text-3xl">មតិសហគមន៍</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">សួរស្តីពីហ្គេមដែលអ្នកចូលចិត្ត។</p>
          <ul className="space-y-3">
            {recs.length === 0 && <li className="text-sm text-muted-foreground">គ្មានមតិនៅឡើយ។</li>}
            {recs.map((r) => (
              <li key={r.id} className="glass rounded-2xl border border-border/60 p-4 flex gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full grid place-items-center bg-primary/15 text-primary font-semibold">
                  {(r.name.charAt(0) || "?").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {r.name}{" "}
                    <span className="text-muted-foreground font-normal">· {r.game || "—"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <form onSubmit={submit} className="glass rounded-2xl border border-border/60 p-5 space-y-3">
          <h3 className="font-semibold text-sm">ចែករំលែកមតិ</h3>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ឈ្មោះអ្នក"
            className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
          />
          <input
            value={game}
            onChange={(e) => setGame(e.target.value)}
            placeholder="ហ្គេម (ស្រេច)"
            className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="មតិរបស់អ្នក..."
            className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary resize-none"
          />
          <button className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
            <Send className="h-3.5 w-3.5" /> ផ្ញើ
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  const socials = [
    { label: "Telegram @Maodyna0110", href: "https://t.me/Maodyna0110", icon: iconTelegram },
    {
      label: "TikTok @dynastore0",
      href: "https://www.tiktok.com/@dynastore0?_r=1&_t=ZS-96Ki1RwLOSK",
      icon: iconTiktok,
    },
    { label: "Facebook", href: "https://www.facebook.com/share/17miM2zVxY/", icon: iconFacebook },
  ];
  const payments = [
    { label: "ABA Bank", icon: payAba },
    { label: "ACLEDA Bank", icon: payAcleda },
    { label: "Wing Bank", icon: payWing },
  ];
  return (
    <footer className="border-t border-border/60 mt-10">
      <div className="container mx-auto px-4 py-8 flex flex-col items-center gap-5 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-3">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              title={s.label}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-border/60 transition-transform hover:scale-110 hover:ring-primary"
            >
              <img src={s.icon} alt={s.label} className="h-9 w-9 rounded-full object-cover" />
            </a>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
            We Accept
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {payments.map((p) => (
              <div
                key={p.label}
                title={p.label}
                aria-label={p.label}
                className="inline-flex h-10 w-14 items-center justify-center rounded-lg bg-white ring-1 ring-border/60 px-1.5"
              >
                <img src={p.icon} alt={p.label} className="max-h-8 max-w-full object-contain" />
              </div>
            ))}
          </div>
        </div>

        <div>© {new Date().getFullYear()} Dyna Store. All rights reserved.</div>
      </div>
    </footer>
  );
}

function SettingsModal({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const { profile, updateProfile, authed } = useStore();
  const [name, setName] = useState(profile.display_name);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!authed) {
      onToast("សូមចូលគណនីជាមុនសិន");
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({ display_name: name.trim() || "Player" });
    setSaving(false);
    if (error) {
      onToast(error);
      return;
    }
    onToast("បានរក្សាទុក");
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl glass border border-border/60 shadow-[var(--shadow-card)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold">ការកំណត់</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">ឈ្មោះបង្ហាញ</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
            />
          </div>
          {authed ? (
            <Link
              to="/account"
              onClick={onClose}
              className="block text-xs text-primary hover:underline"
            >
              មើលគណនីពេញលេញ →
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">
              សូមចូលគណនីដើម្បីរក្សាការកំណត់នៅគ្រប់ឧបករណ៍។
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-full border border-border px-4 py-1.5 text-xs hover:bg-accent"
            >
              បោះបង់
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "កំពុងរក្សាទុក…" : "រក្សាទុក"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
