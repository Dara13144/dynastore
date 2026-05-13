import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, Save, Loader2, Users, Gamepad2, FileArchive, Settings as SettingsIcon, Pencil, History, ChevronDown, ChevronUp, Search, Check, Wallet, X } from "lucide-react";
import { StoreProvider } from "@/lib/store";
import { getAppSettings, updateAppSettings, adminSetUserBalance, listBalanceChanges, listSettingsAudit, adminSetUserRole } from "@/lib/admin.functions";
import { validateGameFile, validateGameFileUrl } from "@/lib/validate-game-file";
import { submitCreateGame } from "@/lib/create-game";
import { adminListTopupRequests, adminApproveTopup, adminRejectTopup } from "@/lib/topup.functions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Dyna Store" },
      { name: "description", content: "ផ្ទាំងគ្រប់គ្រង Dyna Store សម្រាប់ admin: គ្រប់គ្រងអ្នកប្រើ, ប្រតិបត្តិការ, ផលិតផល, និងសំណើបញ្ចូលលុយ។" },
      { property: "og:title", content: "Admin — Dyna Store" },
      { property: "og:description", content: "ផ្ទាំងគ្រប់គ្រង Dyna Store សម្រាប់ admin: អ្នកប្រើ, ប្រតិបត្តិការ, និងផលិតផល។" },
      { property: "og:url", content: "https://dynastore.lovable.app/admin" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dynastore.lovable.app/admin" }],
  }),
  component: () => (<StoreProvider><AdminPage /></StoreProvider>),
});

type GameRow = {
  id: string; title: string; category: string; description: string | null;
  badge: string | null; price_coins: number; visible: boolean;
  image_url: string | null; file_path: string | null; file_size_bytes: number | null;
  created_at?: string;
};

type UserRow = {
  user_id: string; display_name: string; created_at: string;
  email?: string | null; balance: number; owned: number; is_admin: boolean;
};

function AdminPage() {
  const { authed, loading } = useStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"games" | "users" | "topups" | "content" | "settings">("games");

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
            <h1 className="font-display text-lg gradient-text">ផ្ទាំងគ្រប់គ្រង Admin</h1>
          </div>
          <nav className="flex gap-1 rounded-full bg-muted/30 p-1 overflow-x-auto">
            <TabBtn active={tab === "games"} onClick={() => setTab("games")} icon={<Gamepad2 className="h-3.5 w-3.5" />} label="ហ្គេម" />
            <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-3.5 w-3.5" />} label="អ្នកប្រើ" />
            <TabBtn active={tab === "topups"} onClick={() => setTab("topups")} icon={<Wallet className="h-3.5 w-3.5" />} label="សំណើ Topup" />
            <TabBtn active={tab === "content"} onClick={() => setTab("content")} icon={<Pencil className="h-3.5 w-3.5" />} label="មាតិកា" />
            <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<SettingsIcon className="h-3.5 w-3.5" />} label="កំណត់" />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {tab === "games" && <GamesTab />}
        {tab === "users" && <UsersTab />}
        {tab === "topups" && <TopupsTab />}
        {tab === "content" && <ContentTab />}
        {tab === "settings" && <SettingsTab />}
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
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [visFilter, setVisFilter] = useState<"all" | "visible" | "hidden">("all");
  const [sortKey, setSortKey] = useState<"title" | "category" | "price_coins" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [draft, setDraft] = useState<GameRow>({
    id: "", title: "", category: "", description: "", badge: "",
    price_coins: 0, visible: true, image_url: "", file_path: null, file_size_bytes: null,
  });
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftFileError, setDraftFileError] = useState<string | null>(null);
  const [draftUrlError, setDraftUrlError] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const loadGames = useCallback(async () => {
    const { data, error } = await supabase.from("games").select("*").order("title");
    if (error) { showToast(error.message); return; }
    setGames((data ?? []) as GameRow[]);
  }, []);
  useEffect(() => { loadGames(); }, [loadGames]);

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const validateFile = (file: File): string | null => validateGameFile(file);
  const uploadFile = async (gameId: string, file: File): Promise<{ path: string; size: number } | null> => {
    const err = validateFile(file);
    if (err) { showToast(err); return null; }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${gameId}/${Date.now()}_${safe}`;
    const RESUMABLE_THRESHOLD = 6 * 1024 * 1024; // 6MB
    if (file.size <= RESUMABLE_THRESHOLD) {
      const { error } = await supabase.storage.from("game-files").upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (error) { showToast(`Upload: ${error.message}`); return null; }
      return { path, size: file.size };
    }
    // Resumable upload via TUS for large files
    const tus = await import("tus-js-client");
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { showToast("Upload: not authenticated"); return null; }
    const projectUrl = (import.meta as any).env.VITE_SUPABASE_URL as string;
    return await new Promise((resolve) => {
      setUploadPct(0);
      const upload = new tus.Upload(file, {
        endpoint: `${projectUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        headers: {
          authorization: `Bearer ${token}`,
          "x-upsert": "true",
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: "game-files",
          objectName: path,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        chunkSize: 6 * 1024 * 1024,
        onError: (err: Error) => { setUploadPct(null); showToast(`Upload: ${err.message}`); resolve(null); },
        onProgress: (sent: number, total: number) => { setUploadPct(Math.round((sent / total) * 100)); },
        onSuccess: () => { setUploadPct(null); resolve({ path, size: file.size }); },
      });
      upload.findPreviousUploads().then((prev: any[]) => {
        if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
        upload.start();
      });
    });
  };

  const uploadCoverImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) { showToast("សូមជ្រើសរូបភាព"); return null; }
    if (file.size > 10 * 1024 * 1024) { showToast("រូបភាពធំជាង 10MB"); return null; }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `covers/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error } = await supabase.storage.from("game-images").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { showToast(`Upload: ${error.message}`); return null; }
    const { data } = supabase.storage.from("game-images").getPublicUrl(path);
    return data.publicUrl;
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
    if (draftFile) {
      const preErr = validateFile(draftFile);
      if (preErr) setDraftFileError(preErr);
    }
    setBusy(true);
    const result = await submitCreateGame(
      {
        id: draft.id, title: draft.title, category: draft.category,
        description: draft.description ?? "", badge: draft.badge ?? "",
        price_coins: Number(draft.price_coins) || 0, visible: draft.visible,
        image_url: draft.image_url ?? "",
        file_url: draft.file_path ?? null,
      },
      draftFile,
      {
        uploadFile: (gameId, file) => uploadFile(gameId, file as File),
        insertGame: async (row) => {
          const { error } = await supabase.from("games").insert(row);
          return { error: error ? { message: error.message } : null };
        },
        onError: showToast,
      },
    );
    setBusy(false);
    if (!result.ok) return;
    setCreating(false);
    setDraft({ id: "", title: "", category: "", description: "", badge: "", price_coins: 0, visible: true, image_url: "", file_path: null, file_size_bytes: null });
    setDraftFile(null);
    setDraftFileError(null);
    loadGames();
    showToast("បន្ថែមរួច");
  };

  const categories = Array.from(new Set(games.map((g) => g.category).filter(Boolean))).sort();
  const q = query.trim().toLowerCase();
  const filtered = games.filter((g) => {
    if (catFilter !== "all" && g.category !== catFilter) return false;
    if (visFilter === "visible" && !g.visible) return false;
    if (visFilter === "hidden" && g.visible) return false;
    if (!q) return true;
    return (
      g.id.toLowerCase().includes(q) ||
      g.title.toLowerCase().includes(q) ||
      (g.description ?? "").toLowerCase().includes(q) ||
      (g.badge ?? "").toLowerCase().includes(q)
    );
  }).slice().sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "price_coins") return (a.price_coins - b.price_coins) * dir;
    if (sortKey === "created_at") return ((a.created_at ?? "").localeCompare(b.created_at ?? "")) * dir;
    return String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? "")) * dir;
  });

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "created_at" || k === "price_coins" ? "desc" : "asc"); }
  };
  const sortIcon = (k: typeof sortKey) => sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl">ហ្គេមទាំងអស់ ({filtered.length}/{games.length})</h2>
        <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> បន្ថែមហ្គេម
        </button>
      </div>

      <div className="rounded-2xl glass p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ស្វែងរក title, id, badge…"
            className="w-full rounded-full bg-input pl-9 pr-9 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm">×</button>
          )}
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="rounded-full bg-input px-3 py-2 text-xs ring-1 ring-border focus:ring-primary outline-none">
          <option value="all">គ្រប់ប្រភេទ</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="inline-flex rounded-full bg-muted/30 p-1 text-[11px] font-semibold">
          {(["all", "visible", "hidden"] as const).map((v) => (
            <button key={v} onClick={() => setVisFilter(v)} className={`px-3 py-1 rounded-full ${visFilter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {v === "all" ? "ទាំងអស់" : v === "visible" ? "បង្ហាញ" : "លាក់"}
            </button>
          ))}
        </div>
        {(query || catFilter !== "all" || visFilter !== "all") && (
          <button onClick={() => { setQuery(""); setCatFilter("all"); setVisFilter("all"); }} className="text-[11px] text-muted-foreground hover:text-foreground underline">សម្អាត</button>
        )}
        <button onClick={() => toggleSort("created_at")} className={`text-[11px] px-3 py-1.5 rounded-full ring-1 ring-border ${sortKey === "created_at" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          ថ្មីៗ{sortIcon("created_at")}
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl glass p-5 space-y-3">
          <h3 className="font-semibold text-sm">បន្ថែមហ្គេមថ្មី</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="លេខសម្គាល់ (slug)" value={draft.id} onChange={(v) => setDraft({ ...draft, id: v })} />
            <Field label="ចំណងជើង" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
            <Field label="ប្រភេទ" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} />
            <Field label="ស្លាក" value={draft.badge ?? ""} onChange={(v) => setDraft({ ...draft, badge: v })} />
            <Field label="ការពិពណ៌នា" value={draft.description ?? ""} onChange={(v) => setDraft({ ...draft, description: v })} />
            <Field label="តម្លៃ (Balance)" type="number" value={draft.price_coins ? String(draft.price_coins) : ""} placeholder="ឧ. 1500" onChange={(v) => setDraft({ ...draft, price_coins: Number(v) || 0 })} />
            <div className="block">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">URL រូបភាព (cover)</span>
              <div className="flex items-center gap-2">
                <input value={draft.image_url ?? ""} placeholder="https://… ឬ ផ្ទុករូបឡើង" onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} className="flex-1 rounded-lg bg-input px-3 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary" />
                <label className="shrink-0 cursor-pointer rounded-full bg-primary/10 text-primary px-3 py-2 text-[11px] font-semibold hover:bg-primary/20">
                  ផ្ទុករូប
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadCoverImage(f); if (url) setDraft({ ...draft, image_url: url }); e.target.value = ""; }} />
                </label>
              </div>
              {draft.image_url && <img src={draft.image_url} alt="cover" className="mt-2 h-20 rounded-lg object-cover ring-1 ring-border" />}
            </div>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">ឯកសារហ្គេម (zip/installer)</span>
              <input type="file" accept=".zip,.rar,.7z,.tar,.gz,.tgz" onChange={(e) => { const f = e.target.files?.[0] ?? null; const err = f ? validateFile(f) : null; setDraftFileError(err); setDraftFile(f); }} className="w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground" />
              {draftFile && !draftFileError && <span className="text-[10px] text-muted-foreground mt-1 block">{draftFile.name} · {(draftFile.size / 1024 / 1024).toFixed(2)} MB</span>}
              {draftFileError && <span className="text-[10px] text-destructive mt-1 block">{draftFileError}</span>}
              {uploadPct !== null && (
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
              )}
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1">ឬ​បិទភ្ជាប់​តំណ (URL)</span>
              <input
                type="url"
                placeholder="https://… link to zip/installer"
                value={draft.file_path ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({ ...draft, file_path: v || null });
                  setDraftUrlError(v.trim() ? validateGameFileUrl(v) : null);
                }}
                disabled={!!draftFile}
                className="w-full rounded-lg bg-muted/40 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              {draftUrlError && !draftFile && (
                <span className="text-[10px] text-destructive mt-1 block">{draftUrlError}</span>
              )}
              {draft.file_path && !draftFile && !draftUrlError && (
                <span className="text-[10px] text-emerald-400 mt-1 block">តំណបានកំណត់ — នឹងរក្សាទុកជា file_path</span>
              )}
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} /> បង្ហាញលើ website
          </label>
          <div className="flex gap-2">
            <button disabled={busy || !!draftFileError} onClick={createGame} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
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
                <th className="text-left px-4 py-3">លេខ</th>
                <th className="text-left px-4 py-3"><button onClick={() => toggleSort("title")} className="uppercase tracking-wider hover:text-foreground">ចំណងជើង{sortIcon("title")}</button></th>
                <th className="text-left px-4 py-3"><button onClick={() => toggleSort("category")} className="uppercase tracking-wider hover:text-foreground">ប្រភេទ{sortIcon("category")}</button></th>
                <th className="text-right px-4 py-3"><button onClick={() => toggleSort("price_coins")} className="uppercase tracking-wider hover:text-foreground">តម្លៃ{sortIcon("price_coins")}</button></th>
                <th className="text-center px-4 py-3">ឯកសារ</th>
                <th className="text-center px-4 py-3">បង្ហាញ</th>
                <th className="text-right px-4 py-3">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => <GameRowEditor key={g.id} game={g} busy={busy} onSave={(p) => updateGame(g.id, p)} onDelete={() => deleteGame(g)} onReplaceFile={(f) => replaceFile(g, f)} validateFile={validateFile} onValidationError={showToast} onUploadCover={uploadCoverImage} />)}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">{games.length === 0 ? "គ្មានហ្គេម។" : "រកមិនឃើញ។"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground text-background px-4 py-2 text-xs shadow-lg">{toast}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg bg-input px-3 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary" />
    </label>
  );
}

function GameRowEditor({ game, busy, onSave, onDelete, onReplaceFile, validateFile, onValidationError, onUploadCover }: {
  game: GameRow; busy: boolean;
  onSave: (p: Partial<GameRow>) => void; onDelete: () => void; onReplaceFile: (f: File) => void;
  validateFile: (f: File) => string | null; onValidationError: (m: string) => void;
  onUploadCover: (f: File) => Promise<string | null>;
}) {
  const [edit, setEdit] = useState<GameRow>(game);
  useEffect(() => setEdit(game), [game]);
  const dirty = edit.title !== game.title || edit.category !== game.category || edit.badge !== game.badge || edit.price_coins !== game.price_coins || edit.image_url !== game.image_url;

  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{game.id}</td>
      <td className="px-4 py-3">
        <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" />
        <div className="flex items-center gap-1 mt-0.5">
          <input value={edit.image_url ?? ""} placeholder="URL រូបភាព" onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} className="flex-1 text-[10px] text-muted-foreground bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" />
          <label className="text-[10px] text-primary cursor-pointer hover:underline shrink-0" title="ផ្ទុករូបឡើង">📷
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await onUploadCover(f); if (url) setEdit((p) => ({ ...p, image_url: url })); e.target.value = ""; }} />
          </label>
        </div>
      </td>
      <td className="px-4 py-3"><input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="w-24 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3 text-right"><input type="number" value={edit.price_coins} onChange={(e) => setEdit({ ...edit, price_coins: Number(e.target.value) || 0 })} className="w-20 text-right bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3 text-center">
        {game.file_path ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400" title={game.file_path}>
            <FileArchive className="h-3 w-3" /> {game.file_size_bytes ? (game.file_size_bytes >= 1024 ** 3 ? `${(game.file_size_bytes / 1024 ** 3).toFixed(2)}GB` : `${(game.file_size_bytes / 1024 / 1024).toFixed(1)}MB`) : "ok"}
          </span>
        ) : <span className="text-[11px] text-muted-foreground">—</span>}
        <div className="flex items-center justify-center gap-2 mt-1">
          {game.file_path && (
            <button
              type="button"
              onClick={async () => {
                if (/^https?:\/\//i.test(game.file_path!)) {
                  window.open(game.file_path!, "_blank");
                  return;
                }
                const { data, error } = await supabase.storage.from("game-files").createSignedUrl(game.file_path!, 300, { download: true });
                if (error || !data?.signedUrl) return;
                window.open(data.signedUrl, "_blank");
              }}
              className="text-[10px] text-emerald-400 hover:underline"
            >ទាញយក</button>
          )}
          <label title="ផ្ទុកឯកសារគ្រប់ប្រភេទ • គ្មានកំណត់ទំហំ">
            <span className="text-[10px] text-primary cursor-pointer hover:underline">{game.file_path ? "ប្តូរ" : "ផ្ទុកឡើង"}</span>
            <input
              type="file"
              accept=".zip,.rar,.7z,.tar,.gz,.tgz"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const err = validateFile(f);
                if (err) { onValidationError(err); e.target.value = ""; return; }
                onReplaceFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <button disabled={busy} onClick={() => onSave({ visible: !game.visible })} className="rounded-full p-1.5 hover:bg-accent" title={game.visible ? "លាក់" : "បង្ហាញ"}>
          {game.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button disabled={!dirty || busy} onClick={() => onSave({ title: edit.title, category: edit.category, badge: edit.badge || null, price_coins: edit.price_coins, image_url: edit.image_url || null })} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold disabled:opacity-30"><Save className="h-3 w-3" /> រក្សាទុក</button>
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
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setMeId(user?.id ?? null);
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
                <th className="text-left px-4 py-3">លេខអ្នកប្រើ</th>
                <th className="text-right px-4 py-3">សមតុល្យ</th>
                <th className="text-right px-4 py-3">ហ្គេមដែលបាន</th>
                <th className="text-center px-4 py-3">តួនាទី</th>
                <th className="text-left px-4 py-3">បង្កើត</th>
                <th className="text-right px-4 py-3">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center py-8 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
                : rows.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">គ្មានអ្នកប្រើ។</td></tr>
                : rows.map((u) => (
                  <UserRowEditor
                    key={u.user_id}
                    user={u}
                    isMe={meId === u.user_id}
                    onUpdate={(b) => setRows(rs => rs.map(x => x.user_id === u.user_id ? { ...x, balance: b } : x))}
                    onRoleChange={(isAdmin) => setRows(rs => rs.map(x => x.user_id === u.user_id ? { ...x, is_admin: isAdmin } : x))}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserRowEditor({ user, isMe, onUpdate, onRoleChange }: { user: UserRow; isMe: boolean; onUpdate: (b: number) => void; onRoleChange: (isAdmin: boolean) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(user.balance));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; old_balance: number; new_balance: number; reason: string | null; created_at: string; changed_by_name: string }> | null>(null);
  const [loadingHist, setLoadingHist] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const setBalance = useServerFn(adminSetUserBalance);
  const fetchHistory = useServerFn(listBalanceChanges);
  const setRole = useServerFn(adminSetUserRole);

  const toggleAdmin = async () => {
    const next = !user.is_admin;
    if (!confirm(next ? `ផ្តល់សិទ្ធិ Admin ដល់ ${user.display_name}?` : `ដកសិទ្ធិ Admin ពី ${user.display_name}?`)) return;
    setRoleBusy(true);
    try {
      const r = await setRole({ data: { user_id: user.user_id, is_admin: next } });
      onRoleChange(r.is_admin);
    } catch (e) { alert(e instanceof Error ? e.message : "បរាជ័យ"); }
    finally { setRoleBusy(false); }
  };


  const parsedNextBalance = Math.floor(Number(val));
  const isValidNextBalance = Number.isFinite(parsedNextBalance) && parsedNextBalance >= 0;
  const delta = isValidNextBalance ? parsedNextBalance - user.balance : 0;
  const deltaLabel = `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;

  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const rows = await fetchHistory({ data: { user_id: user.user_id } });
      setHistory(rows);
    } catch (e) { alert(e instanceof Error ? e.message : "បរាជ័យ"); }
    finally { setLoadingHist(false); }
  }, [fetchHistory, user.user_id]);

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history === null) loadHistory();
  };

  const save = async () => {
    if (!isValidNextBalance) return;
    setBusy(true);
    try {
      const r = await setBalance({ data: { user_id: user.user_id, new_balance: parsedNextBalance, reason: reason.trim() || undefined } });
      onUpdate(r.balance);
      setEditing(false);
      setConfirmOpen(false);
      setReason("");
      if (showHistory) await loadHistory();
      else setHistory(null);
    } catch (e) { alert(e instanceof Error ? e.message : "បរាជ័យ"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <tr className="border-t border-border/60 hover:bg-muted/10">
        <td className="px-4 py-3 font-medium">{user.display_name}</td>
        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">{user.user_id}</td>
        <td className="px-4 py-3 text-right font-semibold text-primary">
          {editing ? (
            <div className="inline-flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1">
                <input type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} className="w-24 text-right rounded bg-input px-2 py-1 text-xs ring-1 ring-border focus:ring-primary outline-none" />
                <button disabled={busy || !isValidNextBalance} onClick={() => setConfirmOpen(true)} className="rounded-full bg-primary/10 text-primary px-2 py-1 text-[11px] font-semibold disabled:opacity-50">រក្សាទុក</button>
                <button onClick={() => { setEditing(false); setConfirmOpen(false); setVal(String(user.balance)); setReason(""); }} className="text-[11px] text-muted-foreground">×</button>
              </span>
              <input type="text" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="មូលហេតុ (សេចក្តីពន្យល់)" className="w-56 text-left rounded bg-input px-2 py-1 text-[11px] ring-1 ring-border focus:ring-primary outline-none" />
            </div>
          ) : (
            <button onClick={() => { setVal(String(user.balance)); setEditing(true); }} className="inline-flex items-center gap-1 hover:underline">
              {user.balance.toLocaleString()} <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-right">{user.owned}</td>
        <td className="px-4 py-3 text-center">
          <div className="inline-flex flex-col items-center gap-1">
            {user.is_admin ? <span className="inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold">អ្នកគ្រប់គ្រង</span>
              : <span className="text-[10px] text-muted-foreground">អ្នកប្រើ</span>}
            {!isMe && (
              <button disabled={roleBusy} onClick={toggleAdmin} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold disabled:opacity-50 ${user.is_admin ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                {roleBusy ? "..." : user.is_admin ? "ដក Admin" : "ផ្តល់ Admin"}
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</td>
        <td className="px-4 py-3 text-right">
          <button onClick={toggleHistory} className="inline-flex items-center gap-1 rounded-full bg-muted/30 hover:bg-muted/50 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            <History className="h-3 w-3" /> ប្រវត្តិ {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </td>
      </tr>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>បញ្ជាក់ការផ្លាស់ប្តូរ Balance</AlertDialogTitle>
            <AlertDialogDescription>
              សូមពិនិត្យព័ត៌មានខាងក្រោម មុនអនុវត្តការកែប្រែសមតុល្យរបស់អ្នកប្រើ។
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 bg-muted/20 p-3">
              <span className="text-muted-foreground">អ្នកប្រើ</span>
              <span className="text-right font-medium break-all">{user.display_name}</span>
              <span className="text-muted-foreground">Balance បច្ចុប្បន្ន</span>
              <span className="text-right font-medium">{user.balance.toLocaleString()}</span>
              <span className="text-muted-foreground">Balance ថ្មី</span>
              <span className="text-right font-medium">{isValidNextBalance ? parsedNextBalance.toLocaleString() : "—"}</span>
              <span className="text-muted-foreground">Delta</span>
              <span className={`text-right font-semibold ${delta > 0 ? "text-primary" : delta < 0 ? "text-destructive" : "text-foreground"}`}>{deltaLabel}</span>
              <span className="text-muted-foreground">មូលហេតុ</span>
              <span className="text-right break-words">{reason.trim() || "—"}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>បោះបង់</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !isValidNextBalance} onClick={(e) => { e.preventDefault(); void save(); }}>
              {busy ? "កំពុងអនុវត្ត..." : "បញ្ជាក់"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {showHistory && (
        <tr className="border-t border-border/40 bg-muted/5">
          <td colSpan={7} className="px-4 py-3">
            {loadingHist ? (
              <div className="text-center text-xs text-muted-foreground py-3"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
            ) : !history || history.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-3">គ្មានប្រវត្តិការផ្លាស់ប្តូរ Balance។</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1.5">កាលបរិច្ឆេទ</th>
                      <th className="text-left px-2 py-1.5">ដោយ Admin</th>
                      <th className="text-right px-2 py-1.5">ពី</th>
                      <th className="text-right px-2 py-1.5">ទៅ</th>
                      <th className="text-right px-2 py-1.5">ផ្លាស់ប្តូរ</th>
                      <th className="text-left px-2 py-1.5">មូលហេតុ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const diff = h.new_balance - h.old_balance;
                      return (
                        <tr key={h.id} className="border-t border-border/40">
                          <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(h.created_at).toLocaleString()}</td>
                          <td className="px-2 py-1.5">{h.changed_by_name}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{h.old_balance.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right font-mono font-semibold text-primary">{h.new_balance.toLocaleString()}</td>
                          <td className={`px-2 py-1.5 text-right font-mono font-semibold ${diff > 0 ? "text-emerald-500" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {diff > 0 ? "+" : ""}{diff.toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{h.reason ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ============ SETTINGS TAB ============ */
type Settings = {
  coins_per_usd: number; tx_ttl_min: number;
};
function SettingsTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const get = useServerFn(getAppSettings);
  const upd = useServerFn(updateAppSettings);

  useEffect(() => { (async () => {
    try { const r = await get({}); setS(r as Settings); }
    catch (e) { setMsg(e instanceof Error ? e.message : "បរាជ័យ"); }
  })(); }, [get]);

  const save = async () => {
    if (!s) return;
    setBusy(true); setMsg(null);
    try {
      await upd({ data: {
        coins_per_usd: Number(s.coins_per_usd) || 1,
        tx_ttl_min: Number(s.tx_ttl_min) || 5,
      }});
      setMsg("រក្សាទុករួច");
    } catch (e) { setMsg(e instanceof Error ? e.message : "បរាជ័យ"); }
    finally { setBusy(false); setTimeout(() => setMsg(null), 2500); }
  };

  if (!s) return <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="font-display text-xl">ការកំណត់ប្រព័ន្ធ</h2>
      <div className="rounded-2xl glass p-5 space-y-4">
        <h3 className="font-semibold text-sm">អត្រាប្តូរ</h3>
        <div className="grid grid-cols-1 gap-3">
          <Field label="១ ដុល្លារ = ? សមតុល្យ" type="number" value={String(s.coins_per_usd)} onChange={(v) => setS({ ...s, coins_per_usd: Number(v) || 1 })} />
          <Field label="TTL (នាទី)" type="number" value={String(s.tx_ttl_min)} onChange={(v) => setS({ ...s, tx_ttl_min: Number(v) || 5 })} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={busy} onClick={save} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {busy ? "កំពុងរក្សាទុក…" : "រក្សាទុក"}
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
      <SettingsAuditLog refreshKey={msg === "រក្សាទុករួច" ? 1 : 0} />
    </div>
  );
}

function SettingsAuditLog({ refreshKey }: { refreshKey: number }) {
  type AuditRow = { id: string; changed_by: string; field: string; old_value: string | null; new_value: string | null; created_at: string; changed_by_name: string };
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const list = useServerFn(listSettingsAudit);
  useEffect(() => { (async () => {
    setLoading(true);
    try { const r = await list({}); setRows(r as AuditRow[]); }
    catch { setRows([]); }
    finally { setLoading(false); }
  })(); }, [list, refreshKey]);

  return (
    <div className="rounded-2xl glass p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><History className="h-4 w-4" /> ប្រវត្តិការផ្លាស់ប្តូរ Settings</h3>
        <span className="text-[10px] text-muted-foreground">{rows?.length ?? 0} entries</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1.5">ពេលវេលា</th>
              <th className="text-left px-2 py-1.5">ដោយ</th>
              <th className="text-left px-2 py-1.5">វាល</th>
              <th className="text-left px-2 py-1.5">ពី</th>
              <th className="text-left px-2 py-1.5">ទៅ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              : !rows || rows.length === 0 ? <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">គ្មានប្រវត្តិ។</td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1.5">{r.changed_by_name}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{r.field}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground max-w-[180px] truncate" title={r.old_value ?? ""}>{r.old_value ?? "—"}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-primary max-w-[180px] truncate" title={r.new_value ?? ""}>{r.new_value ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ============ CONTENT TAB ============ */
type Promo = { id: string; title: string; subtitle: string | null; visible: boolean; created_at: string };
type Testi = { id: string; name: string; game: string | null; text: string; visible: boolean; created_at: string };

function ContentTab() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [testis, setTestis] = useState<Testi[]>([]);
  const [loading, setLoading] = useState(true);
  const [pTitle, setPTitle] = useState(""); const [pSub, setPSub] = useState("");
  const [tName, setTName] = useState(""); const [tGame, setTGame] = useState(""); const [tText, setTText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [p, t] = await Promise.all([
      supabase.from("promotions").select("*").order("created_at", { ascending: false }),
      supabase.from("testimonials").select("*").order("created_at", { ascending: false }),
    ]);
    setPromos((p.data ?? []) as Promo[]);
    setTestis((t.data ?? []) as Testi[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const addPromo = async () => {
    if (!pTitle.trim()) return;
    const { error } = await supabase.from("promotions").insert({ title: pTitle.trim(), subtitle: pSub.trim() || null, visible: true });
    if (error) return toast.error(error.message);
    setPTitle(""); setPSub(""); toast.success("បន្ថែមរួច"); load();
  };
  const updPromo = async (id: string, patch: Partial<Promo>) => {
    const { error } = await supabase.from("promotions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setPromos((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } as Promo : r));
  };
  const delPromo = async (id: string) => {
    if (!confirm("លុបប្រូម៉ូសិន?")) return;
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPromos((rs) => rs.filter((r) => r.id !== id));
  };

  const addTesti = async () => {
    if (!tName.trim() || !tText.trim()) return;
    const { error } = await supabase.from("testimonials").insert({ name: tName.trim(), game: tGame.trim() || null, text: tText.trim(), visible: true });
    if (error) return toast.error(error.message);
    setTName(""); setTGame(""); setTText(""); toast.success("បន្ថែមរួច"); load();
  };
  const updTesti = async (id: string, patch: Partial<Testi>) => {
    const { error } = await supabase.from("testimonials").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setTestis((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } as Testi : r));
  };
  const delTesti = async (id: string) => {
    if (!confirm("លុបមតិ?")) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTestis((rs) => rs.filter((r) => r.id !== id));
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-8">
      {/* Promotions */}
      <section className="space-y-3">
        <h2 className="font-display text-xl">ប្រូម៉ូសិន ({promos.length})</h2>
        <div className="rounded-2xl glass p-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="ចំណងជើង" className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none" />
          <input value={pSub} onChange={(e) => setPSub(e.target.value)} placeholder="សេចក្តីរង (ស្រេច)" className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none" />
          <button onClick={addPromo} className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"><Plus className="h-3 w-3" /> បន្ថែម</button>
        </div>
        <div className="rounded-2xl glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">ចំណងជើង</th>
                <th className="text-left px-4 py-3">សេចក្តីរង</th>
                <th className="text-center px-4 py-3">បង្ហាញ</th>
                <th className="text-right px-4 py-3">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {promos.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-xs text-muted-foreground">គ្មានទិន្នន័យ</td></tr>}
              {promos.map((p) => <PromoRow key={p.id} p={p} onUpd={(patch) => updPromo(p.id, patch)} onDel={() => delPromo(p.id)} />)}
            </tbody>
          </table>
        </div>
      </section>

      {/* Testimonials */}
      <section className="space-y-3">
        <h2 className="font-display text-xl">មតិសហគមន៍ ({testis.length})</h2>
        <div className="rounded-2xl glass p-4 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="ឈ្មោះ" className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none" />
          <input value={tGame} onChange={(e) => setTGame(e.target.value)} placeholder="ហ្គេម (ស្រេច)" className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none" />
          <input value={tText} onChange={(e) => setTText(e.target.value)} placeholder="មតិ" className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none" />
          <button onClick={addTesti} className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"><Plus className="h-3 w-3" /> បន្ថែម</button>
        </div>
        <div className="rounded-2xl glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">ឈ្មោះ</th>
                <th className="text-left px-4 py-3">ហ្គេម</th>
                <th className="text-left px-4 py-3">មតិ</th>
                <th className="text-center px-4 py-3">បង្ហាញ</th>
                <th className="text-right px-4 py-3">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {testis.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-xs text-muted-foreground">គ្មានទិន្នន័យ</td></tr>}
              {testis.map((t) => <TestiRow key={t.id} t={t} onUpd={(patch) => updTesti(t.id, patch)} onDel={() => delTesti(t.id)} />)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PromoRow({ p, onUpd, onDel }: { p: Promo; onUpd: (patch: Partial<Promo>) => void; onDel: () => void }) {
  const [e, setE] = useState(p);
  useEffect(() => setE(p), [p]);
  const dirty = e.title !== p.title || e.subtitle !== p.subtitle;
  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-4 py-3"><input value={e.title} onChange={(ev) => setE({ ...e, title: ev.target.value })} className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3"><input value={e.subtitle ?? ""} onChange={(ev) => setE({ ...e, subtitle: ev.target.value })} className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3 text-center">
        <button onClick={() => onUpd({ visible: !p.visible })} className="rounded-full p-1.5 hover:bg-accent">{p.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}</button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button disabled={!dirty} onClick={() => onUpd({ title: e.title, subtitle: e.subtitle || null })} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold disabled:opacity-30"><Save className="h-3 w-3" /> រក្សាទុក</button>
          <button onClick={onDel} className="rounded-full bg-destructive/10 text-destructive px-2 py-1 text-[11px] font-semibold"><Trash2 className="h-3 w-3" /></button>
        </div>
      </td>
    </tr>
  );
}

function TestiRow({ t, onUpd, onDel }: { t: Testi; onUpd: (patch: Partial<Testi>) => void; onDel: () => void }) {
  const [e, setE] = useState(t);
  useEffect(() => setE(t), [t]);
  const dirty = e.name !== t.name || e.game !== t.game || e.text !== t.text;
  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-4 py-3"><input value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} className="w-32 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3"><input value={e.game ?? ""} onChange={(ev) => setE({ ...e, game: ev.target.value })} className="w-32 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3"><input value={e.text} onChange={(ev) => setE({ ...e, text: ev.target.value })} className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1" /></td>
      <td className="px-4 py-3 text-center">
        <button onClick={() => onUpd({ visible: !t.visible })} className="rounded-full p-1.5 hover:bg-accent">{t.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}</button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button disabled={!dirty} onClick={() => onUpd({ name: e.name, game: e.game || null, text: e.text })} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold disabled:opacity-30"><Save className="h-3 w-3" /> រក្សាទុក</button>
          <button onClick={onDel} className="rounded-full bg-destructive/10 text-destructive px-2 py-1 text-[11px] font-semibold"><Trash2 className="h-3 w-3" /></button>
        </div>
      </td>
    </tr>
  );
}


/* ============ TOPUPS TAB ============ */
type TopupRow = {
  id: string; user_id: string; user_name: string;
  amount_usd: number; coins: number; status: "pending" | "approved" | "rejected";
  slip_path: string; slip_url: string | null; note: string | null;
  created_at: string; reviewed_at: string | null; reject_reason: string | null;
};

function TopupsTab() {
  const listFn = useServerFn(adminListTopupRequests);
  const approveFn = useServerFn(adminApproveTopup);
  const rejectFn = useServerFn(adminRejectTopup);
  const [rows, setRows] = useState<TopupRow[]>([]);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [previewSlip, setPreviewSlip] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Record<string, "approved" | "already" | "rejected">>({});

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await listFn({ data: { status, limit: 200 } });
      setRows(r as unknown as TopupRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally { setBusy(false); }
  }, [listFn, status]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setActing(id);
    try {
      const r = await approveFn({ data: { id } });
      if (r.status === "rejected") {
        setOutcome((o) => ({ ...o, [id]: "rejected" }));
        toast.error(`Already rejected${r.reject_reason ? ` · ${r.reject_reason}` : ""}`);
      } else if (r.already_reviewed) {
        setOutcome((o) => ({ ...o, [id]: "already" }));
        toast(`Already approved · balance ${r.new_balance.toLocaleString()}`);
      } else {
        setOutcome((o) => ({ ...o, [id]: "approved" }));
        toast.success(`✓ Approved · +${r.credited.toLocaleString()} coins · balance ${r.new_balance.toLocaleString()}`);
      }
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(null); }
  };
  const reject = async (id: string) => {
    const reason = prompt("Reject reason?")?.trim();
    if (!reason) return;
    setActing(id);
    try {
      await rejectFn({ data: { id, reason } });
      setOutcome((o) => ({ ...o, [id]: "rejected" }));
      toast("Rejected");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">សំណើបញ្ចូល Balance</h2>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-full bg-input px-3 py-1.5 text-xs ring-1 ring-border outline-none">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">ទាំងអស់</option>
          </select>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-right p-3">USD</th>
              <th className="text-right p-3">Coins</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Slip</th>
              <th className="text-left p-3">Note</th>
              <th className="text-left p-3">Created</th>
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !busy && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground text-xs">គ្មានសំណើ</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="p-3">
                  <div className="font-medium">{r.user_name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{r.user_id.slice(0, 8)}</div>
                </td>
                <td className="p-3 text-right font-mono">${Number(r.amount_usd).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{r.coins.toLocaleString()}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
                      r.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                      "bg-destructive/20 text-destructive"
                    }`}>{r.status}</span>
                    {outcome[r.id] === "approved" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold">
                        <Check className="h-2.5 w-2.5" /> Just approved
                      </span>
                    )}
                    {outcome[r.id] === "already" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 text-muted-foreground ring-1 ring-border px-2 py-0.5 text-[10px] font-semibold">
                        Already approved
                      </span>
                    )}
                    {outcome[r.id] === "rejected" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/30 px-2 py-0.5 text-[10px] font-semibold">
                        <X className="h-2.5 w-2.5" /> Rejected
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  {r.slip_url ? (
                    <button onClick={() => setPreviewSlip(r.slip_url)} className="text-xs text-primary hover:underline">មើល</button>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-[160px] truncate" title={r.note ?? ""}>{r.note ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3 text-right">
                  {r.status === "pending" ? (
                    <div className="inline-flex gap-1">
                      <button onClick={() => approve(r.id)} disabled={acting === r.id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1 text-[11px] font-semibold disabled:opacity-50">
                        {acting === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
                      </button>
                      <button onClick={() => reject(r.id)} disabled={acting === r.id}
                        className="inline-flex items-center gap-1 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 px-3 py-1 text-[11px] font-semibold disabled:opacity-50">
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground" title={r.reject_reason ?? ""}>
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewSlip && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setPreviewSlip(null)}>
          <div className="relative">
            <button className="absolute -top-10 right-0 rounded-full bg-card p-2" onClick={() => setPreviewSlip(null)}><X className="h-4 w-4" /></button>
            <img src={previewSlip} alt="slip" className="max-h-[80vh] max-w-[90vw] rounded-xl ring-1 ring-border" />
          </div>
        </div>
      )}
    </div>
  );
}
