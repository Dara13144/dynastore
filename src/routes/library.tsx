import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, Star, Check, Wallet, Library as LibraryIcon, Download, Loader2 } from "lucide-react";
import { StoreProvider, useStore } from "@/lib/store";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import logoD from "@/assets/dyna-logo.jpeg";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "បណ្ណាល័យ — Dyna Store" },
      { name: "description", content: "ហ្គេមដែលអ្នកមាន និងបញ្ជីចង់លេង។" },
    ],
  }),
  component: () => (<StoreProvider><LibraryPage /></StoreProvider>),
});

function DownloadBtn({ filePath }: { filePath: string | null }) {
  const [busy, setBusy] = useState(false);
  if (!filePath) {
    return <span className="text-[11px] text-muted-foreground">មិនទាន់មានឯកសារ</span>;
  }
  const onClick = async () => {
    setBusy(true);
    const { data, error } = await supabase.storage.from("game-files").createSignedUrl(filePath, 300);
    setBusy(false);
    if (error || !data?.signedUrl) { alert(error?.message ?? "មិនអាច download បាន"); return; }
    window.open(data.signedUrl, "_blank");
  };
  return (
    <button onClick={onClick} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Download
    </button>
  );
}

function LibraryPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const { games, library, balance, removeFromLibrary, refreshLibrary } = useStore();

  useEffect(() => { if (!loading && !session) navigate({ to: "/login" }); }, [loading, session, navigate]);
  useEffect(() => { refreshLibrary(); /* eslint-disable-next-line */ }, []);

  const owned = library.filter((l) => l.kind === "owned").map((l) => ({ l, g: games.find((g) => g.id === l.game_id) })).filter((x) => x.g);
  const wishlist = library.filter((l) => l.kind === "wishlist").map((l) => ({ l, g: games.find((g) => g.id === l.game_id) })).filter((x) => x.g);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoD} alt="" className="h-9 w-9 rounded-xl" />
            <span className="font-display text-xl gradient-text">Dyna Store</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">
            <ArrowLeft className="h-3.5 w-3.5" /> ត្រឡប់
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl inline-flex items-center gap-2"><LibraryIcon className="h-7 w-7 text-primary" /> បណ្ណាល័យរបស់អ្នក</h1>
            <p className="text-sm text-muted-foreground mt-1">មើលហ្គេមដែលអ្នកមាន និងគ្រប់គ្រងបញ្ជីចង់លេង។</p>
          </div>
          <div className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary inline-flex items-center gap-1.5">
            <Wallet className="h-4 w-4" /> {balance.toLocaleString()}
          </div>
        </div>

        <Section title="ហ្គេមជាកម្មសិទ្ធ" icon={<Check className="h-5 w-5 text-emerald-400" />} count={owned.length}>
          {owned.length === 0 ? (
            <Empty text="អ្នកមិនទាន់ទិញហ្គេមណាមួយទេ។" cta="រកមើលហ្គេម" to="/" />
          ) : (
            <Grid>
              {owned.map(({ l, g }) => g && (
                <Card key={l.id} title={g.title} category={g.category} image={g.image}
                  badge={<span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 inline-flex items-center gap-1"><Check className="h-3 w-3" /> ជាកម្មសិទ្ធ</span>}
                  action={<DownloadBtn filePath={g.file_path ?? null} />} />
              ))}
            </Grid>
          )}
        </Section>

        <div className="h-10" />

        <Section title="បញ្ជីចង់លេង" icon={<Star className="h-5 w-5 text-primary" />} count={wishlist.length}>
          {wishlist.length === 0 ? (
            <Empty text="បញ្ជីចង់លេងនៅទទេ។ ចុច ★ លើហ្គេមដើម្បីបន្ថែម។" cta="រកមើលហ្គេម" to="/" />
          ) : (
            <Grid>
              {wishlist.map(({ l, g }) => g && (
                <Card key={l.id} title={g.title} category={g.category} image={g.image}
                  badge={<span className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><Wallet className="h-3.5 w-3.5" /> {g.price_coins.toLocaleString()}</span>}
                  action={
                    <button onClick={() => removeFromLibrary(l.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-destructive hover:text-destructive-foreground hover:border-destructive">
                      <Trash2 className="h-3 w-3" /> ដក
                    </button>
                  } />
              ))}
            </Grid>
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="font-display text-xl">{title}</h2>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function Card({ title, category, image, badge, action }: { title: string; category: string; image: string; badge?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <article className="glass rounded-2xl border border-border/60 overflow-hidden">
      <div className="aspect-[16/10] overflow-hidden"><img src={image} alt={title} className="h-full w-full object-cover" /></div>
      <div className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{category}</div>
        <h3 className="font-display text-lg mt-0.5">{title}</h3>
        <div className="mt-3 flex items-center justify-between gap-2">
          {badge}
          {action}
        </div>
      </div>
    </article>
  );
}

function Empty({ text, cta, to }: { text: string; cta: string; to: string }) {
  return (
    <div className="glass rounded-2xl border border-border/60 p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link to={to} className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">{cta}</Link>
    </div>
  );
}

function DownloadBtn({ filePath }: { filePath: string | null }) {
  const [busy, setBusy] = useState(false);
  if (!filePath) {
    return <span className="text-[11px] text-muted-foreground">មិនទាន់មានឯកសារ</span>;
  }
  const onClick = async () => {
    setBusy(true);
    const { data, error } = await supabase.storage.from("game-files").createSignedUrl(filePath, 300);
    setBusy(false);
    if (error || !data?.signedUrl) { alert(error?.message ?? "មិនអាច download បាន"); return; }
    window.open(data.signedUrl, "_blank");
  };
  return (
    <button onClick={onClick} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Download
    </button>
  );
}
