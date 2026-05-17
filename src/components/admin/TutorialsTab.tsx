import { useEffect, useState } from "react";
import { Loader2, Save, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tutorial = {
  id: string;
  slug: string;
  title: string;
  video_url: string;
  description: string | null;
  visible: boolean;
};

const SLUGS: { slug: string; label: string; hint: string }[] = [
  {
    slug: "topup",
    label: "How to top up balance",
    hint: "Shown at the top of the Topup (បញ្ចូល Balance) modal.",
  },
  {
    slug: "buy_game",
    label: "How to buy a game",
    hint: "Shown on the game detail page next to the buy button.",
  },
];

export function TutorialsTab() {
  const [items, setItems] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tutorial_videos")
      .select("*")
      .order("slug");
    if (error) {
      setToast(error.message);
    } else {
      setItems((data as Tutorial[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // ensure rows exist for known slugs
  useEffect(() => {
    if (loading) return;
    const missing = SLUGS.filter((s) => !items.find((i) => i.slug === s.slug));
    if (!missing.length) return;
    (async () => {
      await supabase.from("tutorial_videos").insert(
        missing.map((m) => ({
          slug: m.slug,
          title: m.label,
          video_url: "",
          visible: true,
        })),
      );
      load();
    })();
  }, [loading, items]);

  const update = (slug: string, patch: Partial<Tutorial>) => {
    setItems((prev) =>
      prev.map((i) => (i.slug === slug ? { ...i, ...patch } : i)),
    );
  };

  const save = async (slug: string) => {
    const item = items.find((i) => i.slug === slug);
    if (!item) return;
    const { error } = await supabase
      .from("tutorial_videos")
      .update({
        title: item.title,
        video_url: item.video_url,
        description: item.description,
        visible: item.visible,
      })
      .eq("slug", slug);
    setToast(error ? `Error: ${error.message}` : "Saved ✓");
    setTimeout(() => setToast(""), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Tutorial videos</h2>
        <p className="text-sm text-muted-foreground">
          Paste a YouTube, Vimeo, or direct video URL (.mp4 / .webm). Users see
          a collapsed banner that expands to play.
        </p>
      </div>

      {toast && (
        <div className="rounded-lg bg-primary/15 text-primary px-3 py-2 text-sm">
          {toast}
        </div>
      )}

      {SLUGS.map((cfg) => {
        const item = items.find((i) => i.slug === cfg.slug);
        if (!item) return null;
        return (
          <div
            key={cfg.slug}
            className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <Play className="h-4 w-4 text-primary" />
                  {cfg.label}
                </div>
                <div className="text-xs text-muted-foreground">{cfg.hint}</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.visible}
                  onChange={(e) =>
                    update(cfg.slug, { visible: e.target.checked })
                  }
                />
                Visible
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="text-xs text-muted-foreground mb-1">Title</div>
                <input
                  value={item.title}
                  onChange={(e) => update(cfg.slug, { title: e.target.value })}
                  className="w-full rounded-lg bg-background/60 border border-border/60 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="text-xs text-muted-foreground mb-1">
                  Video URL
                </div>
                <input
                  value={item.video_url}
                  onChange={(e) =>
                    update(cfg.slug, { video_url: e.target.value })
                  }
                  placeholder="https://youtu.be/... or https://.../video.mp4"
                  className="w-full rounded-lg bg-background/60 border border-border/60 px-3 py-2"
                />
              </label>
            </div>

            <label className="text-sm block">
              <div className="text-xs text-muted-foreground mb-1">
                Description (optional)
              </div>
              <textarea
                value={item.description ?? ""}
                onChange={(e) =>
                  update(cfg.slug, { description: e.target.value })
                }
                rows={2}
                className="w-full rounded-lg bg-background/60 border border-border/60 px-3 py-2"
              />
            </label>

            <div className="flex justify-end">
              <button
                onClick={() => save(cfg.slug)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>

            {item.video_url && (
              <div className="rounded-lg overflow-hidden border border-border/60 aspect-video bg-black">
                <iframe
                  src={toEmbed(item.video_url) ?? item.video_url}
                  title="preview"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function toEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be"))
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}
