import { useEffect, useState } from "react";
import { Play, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tutorial = {
  id: string;
  slug: string;
  title: string;
  video_url: string;
  description: string | null;
  visible: boolean;
};

function getYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/"))
        return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
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

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

export function TutorialVideo({
  slug,
  defaultOpen = false,
  className = "",
}: {
  slug: "topup" | "buy_game";
  defaultOpen?: boolean;
  className?: string;
}) {
  const [tut, setTut] = useState<Tutorial | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("tutorial_videos")
        .select("*")
        .eq("slug", slug)
        .eq("visible", true)
        .maybeSingle();
      if (mounted) setTut(data as Tutorial | null);
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (!tut || !tut.video_url?.trim()) return null;

  const embed = getYouTubeEmbed(tut.video_url);
  const direct = !embed && isDirectVideo(tut.video_url);

  return (
    <div
      className={`rounded-xl border border-primary/30 bg-primary/5 overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/10 transition-colors"
      >
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Play className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {tut.title || "Tutorial video"}
          </div>
          {tut.description && (
            <div className="text-xs text-muted-foreground truncate">
              {tut.description}
            </div>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3">
          <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
            {embed ? (
              <iframe
                src={embed}
                title={tut.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : direct ? (
              <video
                src={tut.video_url}
                controls
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <a
                href={tut.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 grid place-items-center text-white text-sm underline"
              >
                Open video
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
