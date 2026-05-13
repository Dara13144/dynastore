import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, Save, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Dyna Store" }] }),
  component: AdminPage,
});

type GameRow = {
  id: string; title: string; category: string; description: string | null;
  badge: string | null; price_coins: number; visible: boolean;
};

function AdminPage() {
  const { authed, loading } = useStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<GameRow>({
    id: "", title: "", category: "", description: "", badge: "", price_coins: 1000, visible: true,
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    if (loading) return;
    if (!authed) { navigate({ to: "/login" }); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [authed, loading, navigate]);

  const loadGames = useCallback(async () => {
    const { data, error } = await supabase.from("games").select("*").order("title");
    if (error) { showToast(error.message); return; }
    setGames((data ?? []) as GameRow[]);
  }, []);

  useEffect(() => { if (isAdmin) loadGames(); }, [isAdmin, loadGames]);

  const updateGame = async (id: string, patch: Partial<GameRow>) => {
    setBusy(true);
    const { error } = await supabase.from("games").update(patch).eq("id", id);
    setBusy(false);
    if (error) { showToast(error.message); return; }
    setGames((g) => g.map((x) => x.id === id ? { ...x, ...patch } : x));
    showToast("រក្សាទុករួច");
  };

  const deleteGame = async (id: string) => {
    if (!confirm("លុបហ្គេមនេះ?")) return;
    setBusy(true);
    const { error } = await supabase.from("games").delete().eq("id", id);
    setBusy(false);
    if (error) { showToast(error.message); return; }
    setGames((g) => g.filter((x) => x.id !== id));
    showToast("លុបរួច");
  };

  const createGame = async () => {
    if (!draft.id.trim() || !draft.title.trim()) { showToast("ត្រូវការ id និង title"); return; }
    setBusy(true);
    const { error } = await supabase.from("games").insert({
      id: draft.id.trim(), title: draft.title.trim(), category: draft.category.trim() || "GAME",
      description: draft.description, badge: draft.badge || null,
      price_coins: Number(draft.price_coins) || 0, visible: draft.visible,
    });
    setBusy(false);
    if (error) { showToast(error.message); return; }
    setCreating(false);
    setDraft({ id: "", title: "", category: "", description: "", badge: "", price_coins: 1000, visible: true });
    loadGames();
    showToast("បន្ថែមរួច");
  };

  if (loading || isAdmin === null) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-display text-2xl">មិនមានសិទ្ធិ</h1>
          <p className="text-sm text-muted-foreground">ទំព័រនេះសម្រាប់តែ Admin ប៉ុណ្ណោះ។</p>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"><ArrowLeft className="h-3.5 w-3.5" /> ត្រឡប់</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="font-display text-lg gradient-text">Admin Dashboard</h1>
          </div>
          <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> បន្ថែមហ្គេម
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {creating && (
          <div className="rounded-2xl glass p-5 space-y-3">
            <h2 className="font-semibold text-sm">បន្ថែមហ្គេមថ្មី</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="ID (slug, តែ a-z0-9)" value={draft.id} onChange={(v) => setDraft({ ...draft, id: v })} />
              <Field label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
              <Field label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} />
              <Field label="Badge" value={draft.badge ?? ""} onChange={(v) => setDraft({ ...draft, badge: v })} />
              <Field label="Description" value={draft.description ?? ""} onChange={(v) => setDraft({ ...draft, description: v })} />
              <Field label="Price (Balance)" type="number" value={String(draft.price_coins)} onChange={(v) => setDraft({ ...draft, price_coins: Number(v) || 0 })} />
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />
              បង្ហាញលើ website
            </label>
            <div className="flex gap-2">
              <button disabled={busy} onClick={createGame} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">រក្សាទុក</button>
              <button onClick={() => setCreating(false)} className="rounded-full border border-border px-4 py-2 text-xs">បោះបង់</button>
            </div>
          </div>
        )}

        <div className="rounded-2xl glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Badge</th>
                  <th className="text-right px-4 py-3">Price (Balance)</th>
                  <th className="text-center px-4 py-3">Visible</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => <Row key={g.id} game={g} busy={busy} onSave={(p) => updateGame(g.id, p)} onDelete={() => deleteGame(g.id)} />)}
                {games.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">គ្មានហ្គេម។ ចុច "បន្ថែមហ្គេម" ដើម្បីចាប់ផ្តើម។</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground text-background px-4 py-2 text-xs shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg bg-input px-3 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary" />
    </label>
  );
}

function Row({ game, busy, onSave, onDelete }: { game: GameRow; busy: boolean; onSave: (p: Partial<GameRow>) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState<GameRow>(game);
  useEffect(() => setEdit(game), [game]);
  const dirty = edit.title !== game.title || edit.category !== game.category || edit.badge !== game.badge || edit.price_coins !== game.price_coins;

  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{game.id}</td>
      <td className="px-4 py-3"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3"><input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="w-28 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3"><input value={edit.badge ?? ""} onChange={(e) => setEdit({ ...edit, badge: e.target.value })} placeholder="—" className="w-24 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3 text-right"><input type="number" value={edit.price_coins} onChange={(e) => setEdit({ ...edit, price_coins: Number(e.target.value) || 0 })} className="w-24 text-right bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3 text-center">
        <button disabled={busy} onClick={() => onSave({ visible: !game.visible })} className="inline-flex items-center justify-center rounded-full p-1.5 hover:bg-accent" title={game.visible ? "Hide" : "Show"}>
          {game.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button disabled={!dirty || busy} onClick={() => onSave({ title: edit.title, category: edit.category, badge: edit.badge || null, price_coins: edit.price_coins })} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold disabled:opacity-30"><Save className="h-3 w-3" /> Save</button>
          <button disabled={busy} onClick={onDelete} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-1 text-[11px] font-semibold"><Trash2 className="h-3 w-3" /></button>
        </div>
      </td>
    </tr>
  );
}
