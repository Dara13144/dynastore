import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, Save, Loader2, Users, Gamepad2, FileArchive, Settings as SettingsIcon, Receipt, Pencil } from "lucide-react";
import { getAppSettings, updateAppSettings, adminSetUserBalance, listAllTransactions } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Dyna Store" }] }),
  component: AdminPage,
});

type GameRow = {
  id: string; title: string; category: string; description: string | null;
  badge: string | null; price_coins: number; visible: boolean;
  image_url: string | null; file_path: string | null; file_size_bytes: number | null;
};

type UserRow = {
  user_id: string; display_name: string; created_at: string;
  email?: string | null; balance: number; owned: number; is_admin: boolean;
};

function AdminPage() {
  const { authed, loading } = useStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"games" | "users" | "payments" | "settings">("games");

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
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="font-display text-lg gradient-text">Admin Dashboard</h1>
          </div>
          <nav className="flex gap-1 rounded-full bg-muted/30 p-1">
            <TabBtn active={tab === "games"} onClick={() => setTab("games")} icon={<Gamepad2 className="h-3.5 w-3.5" />} label="Games" />
            <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-3.5 w-3.5" />} label="Users" />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {tab === "games" ? <GamesTab /> : <UsersTab />}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {icon} {label}
    </button>
  );
}

/* ============ GAMES TAB ============ */
function GamesTab() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<GameRow>({
    id: "", title: "", category: "", description: "", badge: "",
    price_coins: 1000, visible: true, image_url: "", file_path: null, file_size_bytes: null,
  });
  const [draftFile, setDraftFile] = useState<File | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const loadGames = useCallback(async () => {
    const { data, error } = await supabase.from("games").select("*").order("title");
    if (error) { showToast(error.message); return; }
    setGames((data ?? []) as GameRow[]);
  }, []);
  useEffect(() => { loadGames(); }, [loadGames]);

  const uploadFile = async (gameId: string, file: File): Promise<{ path: string; size: number } | null> => {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${gameId}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from("game-files").upload(path, file, { upsert: true });
    if (error) { showToast(`Upload: ${error.message}`); return null; }
    return { path, size: file.size };
  };

  const updateGame = async (id: string, patch: Partial<GameRow>) => {
    setBusy(true);
    const { error } = await supabase.from("games").update(patch).eq("id", id);
    setBusy(false);
    if (error) { showToast(error.message); return; }
    setGames((g) => g.map((x) => x.id === id ? { ...x, ...patch } : x));
    showToast("រក្សាទុករួច");
  };

  const replaceFile = async (game: GameRow, file: File) => {
    setBusy(true);
    if (game.file_path) await supabase.storage.from("game-files").remove([game.file_path]);
    const up = await uploadFile(game.id, file);
    setBusy(false);
    if (up) await updateGame(game.id, { file_path: up.path, file_size_bytes: up.size });
  };

  const deleteGame = async (g: GameRow) => {
    if (!confirm("លុបហ្គេមនេះ?")) return;
    setBusy(true);
    if (g.file_path) await supabase.storage.from("game-files").remove([g.file_path]);
    const { error } = await supabase.from("games").delete().eq("id", g.id);
    setBusy(false);
    if (error) { showToast(error.message); return; }
    setGames((gs) => gs.filter((x) => x.id !== g.id));
    showToast("លុបរួច");
  };

  const createGame = async () => {
    if (!draft.id.trim() || !draft.title.trim()) { showToast("ត្រូវការ id និង title"); return; }
    setBusy(true);
    let file_path: string | null = null;
    let file_size_bytes: number | null = null;
    if (draftFile) {
      const up = await uploadFile(draft.id.trim(), draftFile);
      if (!up) { setBusy(false); return; }
      file_path = up.path; file_size_bytes = up.size;
    }
    const { error } = await supabase.from("games").insert({
      id: draft.id.trim(), title: draft.title.trim(), category: draft.category.trim() || "GAME",
      description: draft.description, badge: draft.badge || null,
      price_coins: Number(draft.price_coins) || 0, visible: draft.visible,
      image_url: draft.image_url || null, file_path, file_size_bytes,
    });
    setBusy(false);
    if (error) { showToast(error.message); return; }
    setCreating(false);
    setDraft({ id: "", title: "", category: "", description: "", badge: "", price_coins: 1000, visible: true, image_url: "", file_path: null, file_size_bytes: null });
    setDraftFile(null);
    loadGames();
    showToast("បន្ថែមរួច");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">ហ្គេមទាំងអស់ ({games.length})</h2>
        <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> បន្ថែមហ្គេម
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl glass p-5 space-y-3">
          <h3 className="font-semibold text-sm">បន្ថែមហ្គេមថ្មី</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="ID (slug)" value={draft.id} onChange={(v) => setDraft({ ...draft, id: v })} />
            <Field label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
            <Field label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} />
            <Field label="Badge" value={draft.badge ?? ""} onChange={(v) => setDraft({ ...draft, badge: v })} />
            <Field label="Description" value={draft.description ?? ""} onChange={(v) => setDraft({ ...draft, description: v })} />
            <Field label="Price (Balance)" type="number" value={String(draft.price_coins)} onChange={(v) => setDraft({ ...draft, price_coins: Number(v) || 0 })} />
            <Field label="Image URL (cover)" value={draft.image_url ?? ""} onChange={(v) => setDraft({ ...draft, image_url: v })} />
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Game File (zip/installer)</span>
              <input type="file" onChange={(e) => setDraftFile(e.target.files?.[0] ?? null)} className="w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground" />
              {draftFile && <span className="text-[10px] text-muted-foreground mt-1 block">{draftFile.name} · {(draftFile.size / 1024 / 1024).toFixed(2)} MB</span>}
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} /> បង្ហាញលើ website
          </label>
          <div className="flex gap-2">
            <button disabled={busy} onClick={createGame} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? "កំពុងផ្ទុកឡើង…" : "រក្សាទុក"}
            </button>
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
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-center px-4 py-3">File</th>
                <th className="text-center px-4 py-3">Visible</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => <GameRowEditor key={g.id} game={g} busy={busy} onSave={(p) => updateGame(g.id, p)} onDelete={() => deleteGame(g)} onReplaceFile={(f) => replaceFile(g, f)} />)}
              {games.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">គ្មានហ្គេម។</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground text-background px-4 py-2 text-xs shadow-lg">{toast}</div>}
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

function GameRowEditor({ game, busy, onSave, onDelete, onReplaceFile }: {
  game: GameRow; busy: boolean;
  onSave: (p: Partial<GameRow>) => void; onDelete: () => void; onReplaceFile: (f: File) => void;
}) {
  const [edit, setEdit] = useState<GameRow>(game);
  useEffect(() => setEdit(game), [game]);
  const dirty = edit.title !== game.title || edit.category !== game.category || edit.badge !== game.badge || edit.price_coins !== game.price_coins || edit.image_url !== game.image_url;

  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{game.id}</td>
      <td className="px-4 py-3">
        <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" />
        <input value={edit.image_url ?? ""} placeholder="Image URL" onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} className="w-full text-[10px] text-muted-foreground bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 mt-0.5" />
      </td>
      <td className="px-4 py-3"><input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="w-24 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3 text-right"><input type="number" value={edit.price_coins} onChange={(e) => setEdit({ ...edit, price_coins: Number(e.target.value) || 0 })} className="w-20 text-right bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3 text-center">
        {game.file_path ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400" title={game.file_path}>
            <FileArchive className="h-3 w-3" /> {game.file_size_bytes ? `${(game.file_size_bytes / 1024 / 1024).toFixed(1)}MB` : "ok"}
          </span>
        ) : <span className="text-[11px] text-muted-foreground">—</span>}
        <label className="block mt-1">
          <span className="text-[10px] text-primary cursor-pointer hover:underline">{game.file_path ? "ប្តូរ" : "ផ្ទុកឡើង"}</span>
          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplaceFile(f); }} />
        </label>
      </td>
      <td className="px-4 py-3 text-center">
        <button disabled={busy} onClick={() => onSave({ visible: !game.visible })} className="rounded-full p-1.5 hover:bg-accent" title={game.visible ? "Hide" : "Show"}>
          {game.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button disabled={!dirty || busy} onClick={() => onSave({ title: edit.title, category: edit.category, badge: edit.badge || null, price_coins: edit.price_coins, image_url: edit.image_url || null })} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold disabled:opacity-30"><Save className="h-3 w-3" /> Save</button>
          <button disabled={busy} onClick={onDelete} className="rounded-full bg-destructive/10 text-destructive px-2 py-1 text-[11px] font-semibold"><Trash2 className="h-3 w-3" /></button>
        </div>
      </td>
    </tr>
  );
}

/* ============ USERS TAB ============ */
function UsersTab() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: profiles }, { data: wallets }, { data: lib }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, created_at"),
        supabase.from("wallets").select("user_id, balance"),
        supabase.from("library").select("user_id, kind"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const wMap = new Map((wallets ?? []).map((w: any) => [w.user_id, w.balance]));
      const oMap = new Map<string, number>();
      (lib ?? []).forEach((l: any) => { if (l.kind === "owned") oMap.set(l.user_id, (oMap.get(l.user_id) ?? 0) + 1); });
      const aSet = new Set((roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
      const merged: UserRow[] = (profiles ?? []).map((p: any) => ({
        user_id: p.user_id, display_name: p.display_name, created_at: p.created_at,
        balance: wMap.get(p.user_id) ?? 0, owned: oMap.get(p.user_id) ?? 0, is_admin: aSet.has(p.user_id),
      })).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      setRows(merged);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">អ្នកប្រើប្រាស់ ({rows.length})</h2>
      <div className="rounded-2xl glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">ឈ្មោះ</th>
                <th className="text-left px-4 py-3">User ID</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-right px-4 py-3">ហ្គេមដែលបាន</th>
                <th className="text-center px-4 py-3">តួនាទី</th>
                <th className="text-left px-4 py-3">បង្កើត</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-center py-8 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
                : rows.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-xs text-muted-foreground">គ្មានអ្នកប្រើ។</td></tr>
                : rows.map((u) => (
                  <tr key={u.user_id} className="border-t border-border/60 hover:bg-muted/10">
                    <td className="px-4 py-3 font-medium">{u.display_name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">{u.user_id}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{u.balance.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{u.owned}</td>
                    <td className="px-4 py-3 text-center">
                      {u.is_admin ? <span className="inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold">Admin</span>
                        : <span className="text-[10px] text-muted-foreground">User</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
