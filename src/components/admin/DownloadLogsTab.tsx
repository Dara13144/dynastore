import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Download, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ============ DOWNLOAD LOGS TAB ============ */
type DownloadLogRow = {
  id: string;
  user_id: string;
  game_id: string;
  via: "direct" | "link";
  url: string;
  file_path: string | null;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
};

export function DownloadLogsTab() {
  const [rows, setRows] = useState<DownloadLogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string }>>({});
  const [games, setGames] = useState<Record<string, { title: string }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "direct" | "link">("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("download_logs")
      .select("id, user_id, game_id, via, url, file_path, user_agent, ip, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      setLoading(false);
      return;
    }
    const logs = (data ?? []) as DownloadLogRow[];
    setRows(logs);
    const userIds = Array.from(new Set(logs.map((r) => r.user_id)));
    const gameIds = Array.from(new Set(logs.map((r) => r.game_id)));
    const [{ data: profs }, { data: gms }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string }> }),
      gameIds.length
        ? supabase.from("games").select("id, title").in("id", gameIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    ]);
    const pMap: Record<string, { display_name: string }> = {};
    (profs ?? []).forEach((p) => {
      pMap[p.user_id] = { display_name: p.display_name };
    });
    setProfiles(pMap);
    const gMap: Record<string, { title: string }> = {};
    (gms ?? []).forEach((g) => {
      gMap[g.id] = { title: g.title };
    });
    setGames(gMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.via !== filter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (profiles[r.user_id]?.display_name ?? "").toLowerCase().includes(q) ||
      (games[r.game_id]?.title ?? r.game_id).toLowerCase().includes(q) ||
      r.url.toLowerCase().includes(q) ||
      (r.ip ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl">កំណត់ហេតុការទាញយក</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            តាមដានអ្នកប្រើដែលបានចុច Download / Download By Link និងតំណដែលត្រូវបានបើក។
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ស្វែងរក…"
              className="pl-8 pr-3 py-1.5 rounded-full bg-muted/30 border border-border text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-full bg-muted/30 border border-border text-xs px-3 py-1.5 outline-none"
          >
            <option value="all">ទាំងអស់</option>
            <option value="direct">Direct</option>
            <option value="link">Link</option>
          </select>
          <button
            onClick={load}
            className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent"
          >
            ធ្វើបច្ចុប្បន្នភាព
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/60 p-10 text-center text-sm text-muted-foreground">
          មិនមានកំណត់ហេតុ
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">ពេលវេលា</th>
                <th className="px-3 py-2 text-left">អ្នកប្រើ</th>
                <th className="px-3 py-2 text-left">ហ្គេម</th>
                <th className="px-3 py-2 text-left">វិធីសាស្ត្រ</th>
                <th className="px-3 py-2 text-left">URL ដែលបានបើក</th>
                <th className="px-3 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-muted/10 align-top">
                  <td className="px-3 py-2 text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{profiles[r.user_id]?.display_name ?? "—"}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {r.user_id.slice(0, 8)}…
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{games[r.game_id]?.title ?? r.game_id}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{r.game_id}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.via === "link" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">
                        <LinkIcon className="h-3 w-3" /> Link
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold">
                        <Download className="h-3 w-3" /> Direct
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[360px]">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline break-all"
                    >
                      {r.url}
                    </a>
                    {r.file_path && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 break-all">
                        path: {r.file_path}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                    {r.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
