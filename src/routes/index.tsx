import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, LogIn, LogOut, Star, Send, Gamepad2, Sparkles, X } from "lucide-react";
import { StoreProvider, useStore, GAMES, type Game } from "@/lib/store";
import heroImg from "@/assets/hero-arcade.jpg";
import logoD from "@/assets/dyna-logo.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dyna Store — ហ្គេម PC និង Console" },
      { name: "description", content: "រកមើលហ្គេមពេញនិយមនៅ Dyna Store — PC, Console និងបន្ថែមទៀត។" },
      { property: "og:title", content: "Dyna Store" },
      { property: "og:description", content: "ហាងបង្ហាញហ្គេម PC និង Console។" },
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
  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2200); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onSettings={() => setSettingsOpen(true)} />
      <Hero />
      <GamesSection onToast={showToast} />
      <DealsBanner />
      <Recommendations onToast={showToast} />
      <PlusSection />
      <Footer />

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onToast={showToast} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] rounded-full bg-foreground text-background px-5 py-2 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}

function Header({ onSettings }: { onSettings: () => void }) {
  const { authed, signOut } = useStore();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoD} alt="Dyna Store" className="h-9 w-9 rounded-xl" />
          <span className="font-display text-xl gradient-text">Dyna Store</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#games" className="hover:text-foreground transition">ហ្គេម</a>
          <a href="#deals" className="hover:text-foreground transition">ប្រូម៉ូសិន</a>
          <a href="#community" className="hover:text-foreground transition">សហគមន៍</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onSettings} className="p-2 rounded-full hover:bg-accent transition" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </button>
          {authed ? (
            <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <LogOut className="h-3.5 w-3.5" /> ចេញ
            </button>
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
          <Sparkles className="h-3.5 w-3.5 text-primary" /> ហ្គេមថ្មីជារៀងរាល់សប្តាហ៍
        </div>
        <h1 className="font-display text-4xl md:text-6xl tracking-tight">
          <span className="gradient-text">លេងហ្គេមកម្មវ្វិធី</span> ដែលអ្នកស្រឡាញ់
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          រកមើលហ្គេមពេញនិយម PC និង Console។ បង្កើតបញ្ជីហ្គេមផ្ទាល់ខ្លួនរបស់អ្នក។
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a href="#games" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">មើលហ្គេម</a>
          <a href="#community" className="rounded-full border border-border px-5 py-2.5 text-sm hover:bg-accent">សហគមន៍</a>
        </div>
      </div>
    </section>
  );
}

function GamesSection({ onToast }: { onToast: (m: string) => void }) {
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
        {GAMES.map((g) => <GameCard key={g.id} game={g} onToast={onToast} />)}
      </div>
    </section>
  );
}

function GameCard({ game, onToast }: { game: Game; onToast: (m: string) => void }) {
  return (
    <article className="group glass rounded-2xl border border-border/60 overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={game.image} alt={game.title} className="h-full w-full object-cover transition group-hover:scale-105" />
        {game.badge && (
          <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{game.badge}</span>
        )}
      </div>
      <div className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{game.category}</div>
        <h3 className="font-display text-lg mt-0.5">{game.title}</h3>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{game.description}</p>
        <button
          onClick={() => onToast(`បានបន្ថែម ${game.title} ទៅក្នុងបញ្ជីចង់លេង`)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
        >
          <Star className="h-3.5 w-3.5" /> បន្ថែមទៅបញ្ជី
        </button>
      </div>
    </article>
  );
}

function DealsBanner() {
  return (
    <section id="deals" className="container mx-auto px-4 py-8">
      <div className="rounded-3xl p-8 md:p-10 text-center" style={{ background: "var(--gradient-hero)" }}>
        <h3 className="font-display text-2xl md:text-3xl text-primary-foreground">ប្រូម៉ូសិនពិសេសសប្តាហ៍នេះ</h3>
        <p className="text-sm md:text-base text-primary-foreground/80 mt-2">ហ្គេមថ្មីៗ និងបណ្តុំអាប់ដេតរង់ចាំអ្ន