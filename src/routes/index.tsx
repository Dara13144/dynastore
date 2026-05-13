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
            <>
              <Link to="/account" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                គណនី
              </Link>
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
        <p className="text-sm md:text-base text-primary-foreground/80 mt-2">ហ្គេមថ្មីៗ និងបណ្តុំអាប់ដេតរង់ចាំអ្នករាល់សប្តាហ៍។</p>
      </div>
    </section>
  );
}

function Recommendations({ onToast }: { onToast: (m: string) => void }) {
  const { recs, addRec } = useStore();
  const [name, setName] = useState("");
  const [game, setGame] = useState("");
  const [text, setText] = useState("");

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

function PlusSection() {
  return (
    <section className="container mx-auto px-4 py-14">
      <div className="glass rounded-3xl border border-border/60 p-8 md:p-12 text-center">
        <h3 className="font-display text-2xl md:text-3xl">បង្កើតបទពិសោធន៍ហ្គេមផ្ទាល់ខ្លួន</h3>
        <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl mx-auto">
          ភ្ជាប់សហគមន៍ ស្វែងរកហ្គេមថ្មី និងតាមដានព័ត៌មានទាន់ហេតុការណ៍ពី Dyna Store។
        </p>
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
    onToast("បានរក្សាទុក");
    onClose();
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