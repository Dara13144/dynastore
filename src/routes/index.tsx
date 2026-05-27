import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Star,
  Send,
  Gamepad2,
  Sparkles,
  X,
  Check,
  Loader2,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreProvider, useStore, type Game } from "@/lib/store";
import { purchaseGame } from "@/lib/payment.functions";
import { recordClick } from "@/lib/tracking.functions";
import { TopupModal } from "@/components/TopupModal";
import { DynastoreAIChat } from "@/components/DynastoreAIChat";
import { SiteHeader } from "@/components/SiteHeader";

import heroImg from "@/assets/dyna-hero.png";


import iconTelegram from "@/assets/social-telegram.png";
import iconTiktok from "@/assets/social-tiktok.png";
import iconFacebook from "@/assets/social-facebook.png";
import payAba from "@/assets/pay-aba.jpg";
import payAcleda from "@/assets/pay-acleda.png";
import payWing from "@/assets/pay-wing.png";
import heroKhqr from "@/assets/static-khqr.png";
import promoBanner from "@/assets/promo-banner.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DYNASTORE — Your trusted store for quality and reliability" },
      {
        name: "description",
        content: "DYNASTORE — premium digital products, software, and entertainment subscriptions with warranty and instant delivery.",
      },
      { property: "og:title", content: "DYNASTORE" },
      {
        property: "og:description",
        content: "Your trusted store for quality and reliability.",
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
      <SiteHeader onTopup={() => setTopupOpen(true)} />
      <main>
        <Hero />
        <GamesSection onToast={showToast} />
        <NewSiteBanner />
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


function Hero() {
  return (
    <section className="container mx-auto px-4 pt-6 pb-2">
      <div className="relative overflow-hidden rounded-3xl shadow-card ring-1 ring-border">
        <img
          src={heroImg}
          alt="Welcome to DYNASTORE"
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
          className="w-full h-auto block"
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {[
          { key: "all", label: "All", active: true },
          { key: "software", label: "Software" },
          { key: "social", label: "Social" },
          { key: "entertainment", label: "Entertainment" },
          { key: "design", label: "Design" },
          { key: "developer", label: "Developer Tools" },
          { key: "vpn", label: "VPN" },
        ].map((c) => (
          <button
            key={c.key}
            className={
              c.active
                ? "inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm"
                : "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition"
            }
          >
            <span className={c.active ? "h-1.5 w-1.5 rounded-full bg-accent-foreground" : "h-1.5 w-1.5 rounded-full bg-muted-foreground"} />
            {c.label}
          </button>
        ))}
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
        if (r.message === "already_owned") {
          onToast("អ្នកមានផលិតផលនេះរួចហើយ");
        } else {
          onToast(
            r.deliveredContent
              ? `✅ Delivered: ${r.deliveredContent}`
              : "ទិញបានជោគជ័យ!",
          );
        }
        await Promise.all([refreshWallet(), refreshLibrary()]);
      } else if (r.message === "insufficient_balance") {
        onToast("Balance មិនគ្រប់គ្រាន់");
      } else if (r.message === "out_of_stock") {
        onToast("អស់ស្តុក — សូមរង់ចាំការបន្ថែម");
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
          <span className="absolute top-2 left-2 sm:top-3 sm:left-3 rounded-full bg-primary px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-primary-foreground">
            {game.badge}
          </span>
        )}
        {owned && (
          <span className="absolute top-2 right-2 sm:top-3 sm:right-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-white inline-flex items-center gap-1">
            <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> ជាកម្មសិទ្ធ
          </span>
        )}
      </Link>
      <div className="p-3 sm:p-4">
        <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">
          {game.category}
        </div>
        <Link to="/games/$id" params={{ id: game.id }} className="block">
          <h3 className="font-display text-sm sm:text-lg mt-0.5 hover:text-primary transition truncate">
            {game.title}
          </h3>
        </Link>
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 line-clamp-2 hidden sm:block">{game.description}</p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="inline-flex items-center gap-1 font-semibold text-primary">
              <Wallet className="h-3.5 w-3.5" /> ${game.price_coins.toLocaleString()}
            </div>
            {authed && !owned && (
              <div
                className={`inline-flex items-center gap-1 ${balance >= game.price_coins ? "text-emerald-400" : "text-amber-400"}`}
              >
                <Wallet className="h-3 w-3" /> Balance: ${balance.toLocaleString()}
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

function NewSiteBanner() {
  const trackClick = useServerFn(recordClick);

  const handleClick = () => {
    trackClick({ data: { button_label: "new-site-banner" } });
  };

  return (
    <section id="deals" className="container mx-auto px-4 py-10">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20 p-8 md:p-12 text-center">
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <h2 className="font-display text-3xl md:text-5xl tracking-tight gradient-text mb-3">
            New Site Design
          </h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto mb-6">
            ទស្សនា Website ថ្មីរបស់យើងឥឡូវនេះ — រចនាសម័យថ្មី ល្បឿនលឿន និងងាយស្រួលប្រើ។
          </p>
          <a
            href="https://www.dynastore.xyz"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-accent to-primary bg-[length:300%_auto] px-10 py-5 text-lg md:text-2xl font-bold text-primary-foreground shadow-2xl ring-2 ring-primary/50 animate-[gradient-x_2.5s_ease_infinite] hover:scale-105 transition-all duration-300"
            style={{ animation: "gradient-x 2.5s ease infinite, pulse-glow 2s ease-in-out infinite, float-y 3s ease-in-out infinite" }}
          >
            <span
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:translate-x-full transition-transform duration-1000"
              style={{ animation: "shimmer-slide 2.5s linear infinite" }}
            />
            <span className="relative flex items-center gap-3">
              <Sparkles className="h-6 w-6 md:h-7 md:w-7 animate-[spin-slow_4s_linear_infinite]" />
              New Site Design — www.dynastore.xyz
              <Sparkles className="h-6 w-6 md:h-7 md:w-7 animate-[spin-slow_4s_linear_infinite_reverse]" />
            </span>
          </a>
        </div>
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

  const Col = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-4 w-0.5 bg-primary rounded-full" />
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">{children}</ul>
    </div>
  );

  const LinkItem = ({ to, href, children }: { to?: string; href?: string; children: React.ReactNode }) =>
    to ? (
      <li>
        <Link to={to} className="hover:text-primary transition">
          {children}
        </Link>
      </li>
    ) : (
      <li>
        <a href={href} className="hover:text-primary transition">
          {children}
        </a>
      </li>
    );

  return (
    <footer className="border-t border-border/60 mt-12 bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <Col title="About DYNASTORE">
            <LinkItem href="#about">Our story</LinkItem>
            <LinkItem to="/">Browse Products</LinkItem>
          </Col>
          <Col title="Quick Links">
            <LinkItem to="/">Home</LinkItem>
            <LinkItem to="/">Browse Products</LinkItem>
            <LinkItem href="#how-to-buy">How to Buy</LinkItem>
            <LinkItem to="/account">Account Settings</LinkItem>
            <LinkItem href="#cart">Cart</LinkItem>
          </Col>
          <Col title="Help">
            <LinkItem href="#how-to-buy">How to Buy</LinkItem>
            <LinkItem href="#faq">FAQ</LinkItem>
            <LinkItem href="#contact">Contact</LinkItem>
          </Col>
          <Col title="Contact">
            <li className="flex items-center gap-2">
              <span>✉️</span>
              <a href="mailto:support@dynastore.fun" className="hover:text-primary transition">
                support@dynastore.fun
              </a>
            </li>
            <li className="flex items-center gap-2">
              <span>📍</span>
              <span>Phnom Penh, Cambodia</span>
            </li>
            <li className="pt-2">
              <div className="flex items-center gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 ring-1 ring-border/60 hover:ring-primary transition"
                  >
                    <img src={s.icon} alt={s.label} className="h-7 w-7 rounded-full object-cover" />
                  </a>
                ))}
              </div>
            </li>
            <li className="pt-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 mb-1.5">
                We Accept
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {payments.map((p) => (
                  <div
                    key={p.label}
                    title={p.label}
                    className="inline-flex h-7 w-10 items-center justify-center rounded-md bg-white ring-1 ring-border/60 px-1"
                  >
                    <img src={p.icon} alt={p.label} className="max-h-5 max-w-full object-contain" />
                  </div>
                ))}
              </div>
            </li>
          </Col>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} <span className="text-foreground font-semibold">DYNASTORE</span>. All Rights Reserved.
            <span className="mx-2 opacity-50">·</span>
            Dev By{" "}
            <a
              href="https://t.me/ismeDara"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @ismeDara
            </a>
          </div>
          <div className="flex items-center gap-5">
            <a href="#privacy" className="hover:text-primary transition">Privacy Policy</a>
            <a href="#terms" className="hover:text-primary transition">Terms of Service</a>
            <a href="#cookies" className="hover:text-primary transition">Cookies</a>
          </div>
        </div>
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
