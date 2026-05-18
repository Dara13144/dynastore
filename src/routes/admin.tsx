import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Save,
  Loader2,
  Users,
  Gamepad2,
  FileArchive,
  Settings as SettingsIcon,
  Pencil,
  Play,
  History,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Wallet,
  X,
  Download,
  Link as LinkIcon,
  LayoutDashboard,
  Activity,
} from "lucide-react";
import { StoreProvider } from "@/lib/store";
import {
  getAppSettings,
  updateAppSettings,
  adminSetUserBalance,
  listBalanceChanges,
  listSettingsAudit,
  adminSetUserRole,
} from "@/lib/admin.functions";
import { validateGameFile, validateGameFileUrl, MAX_GAME_FILE_BYTES } from "@/lib/validate-game-file";
import { submitCreateGame } from "@/lib/create-game";
import { parseBulkLinks, summarizeParse, dedupeAgainstExisting, type ParsedLinkRow } from "@/lib/bulk-link-import";
import { getGameFilesBucketLimit } from "@/lib/bucket-limit.functions";
import {
  formatBytes,
  friendlyUploadError as friendlyUploadErrorPure,
  oversizeForBucketMessage,
} from "@/lib/upload-error-messages";
import { logUploadEvent } from "@/lib/upload-audit";
import { DownloadLogsTab } from "@/components/admin/DownloadLogsTab";
import { UploadAuditTab } from "@/components/admin/UploadAuditTab";
import { DiagnosticsTab } from "@/components/admin/DiagnosticsTab";
import { SplitFileGuideDialog } from "@/components/admin/SplitFileGuideDialog";
import { isPlatformCapError } from "@/lib/chunk-plan";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { TutorialsTab } from "@/components/admin/TutorialsTab";
import { adminListTopupRequests, adminApproveTopup, adminRejectTopup } from "@/lib/topup.functions";
import { getKhqrSettings, setKhqrAccountId, previewKhqr } from "@/lib/khqr-settings.functions";
import { HardDrive } from "lucide-react";
import QRCode from "react-qr-code";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Dyna Store" },
      {
        name: "description",
        content:
          "ផ្ទាំងគ្រប់គ្រង Dyna Store សម្រាប់ admin: គ្រប់គ្រងអ្នកប្រើ, ប្រតិបត្តិការ, ផលិតផល, និងសំណើបញ្ចូលលុយ។",
      },
      { property: "og:title", content: "Admin — Dyna Store" },
      {
        property: "og:description",
        content: "ផ្ទាំងគ្រប់គ្រង Dyna Store សម្រាប់ admin: អ្នកប្រើ, ប្រតិបត្តិការ, និងផលិតផល។",
      },
      { property: "og:url", content: "https://dynastore.lovable.app/admin" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dynastore.lovable.app/admin" }],
  }),
  component: () => (
    <StoreProvider>
      <AdminPage />
    </StoreProvider>
  ),
});

type GameRow = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  badge: string | null;
  price_coins: number;
  visible: boolean;
  image_url: string | null;
  screenshots: string[];
  preview_video_url: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  created_at?: string;
};

type UserRow = {
  user_id: string;
  display_name: string;
  created_at: string;
  email?: string | null;
  balance: number;
  owned: number;
  is_admin: boolean;
};

function AdminPage() {
  const { authed, loading } = useStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"dashboard" | "games" | "users" | "topups" | "content" | "tutorials" | "settings" | "logs" | "uploads" | "diagnostics">(
    "dashboard",
  );

  useEffect(() => {
    if (loading) return;
    if (!authed) {
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [authed, loading, navigate]);

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-display text-2xl">មិនមានសិទ្ធិ</h1>
          <p className="text-sm text-muted-foreground">ទំព័រនេះសម្រាប់តែ Admin ប៉ុណ្ណោះ។</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> ត្រឡប់
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="font-display text-lg gradient-text">ផ្ទាំងគ្រប់គ្រង Admin</h1>
          </div>
          <nav className="flex gap-1 rounded-full bg-muted/30 p-1 overflow-x-auto">
            <TabBtn
              active={tab === "dashboard"}
              onClick={() => setTab("dashboard")}
              icon={<LayoutDashboard className="h-3.5 w-3.5" />}
              label="Dashboard"
            />
            <TabBtn
              active={tab === "games"}
              onClick={() => setTab("games")}
              icon={<Gamepad2 className="h-3.5 w-3.5" />}
              label="ហ្គេម"
            />
            <TabBtn
              active={tab === "users"}
              onClick={() => setTab("users")}
              icon={<Users className="h-3.5 w-3.5" />}
              label="អ្នកប្រើ"
            />
            <TabBtn
              active={tab === "topups"}
              onClick={() => setTab("topups")}
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="សំណើ Topup"
            />
            <TabBtn
              active={tab === "content"}
              onClick={() => setTab("content")}
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="មាតិកា"
            />
            <TabBtn
              active={tab === "tutorials"}
              onClick={() => setTab("tutorials")}
              icon={<Play className="h-3.5 w-3.5" />}
              label="វីដេអូ"
            />
            <TabBtn
              active={tab === "settings"}
              onClick={() => setTab("settings")}
              icon={<SettingsIcon className="h-3.5 w-3.5" />}
              label="កំណត់"
            />
            <TabBtn
              active={tab === "logs"}
              onClick={() => setTab("logs")}
              icon={<Download className="h-3.5 w-3.5" />}
              label="Logs"
            />
            <TabBtn
              active={tab === "uploads"}
              onClick={() => setTab("uploads")}
              icon={<History className="h-3.5 w-3.5" />}
              label="Uploads"
            />
            <TabBtn
              active={tab === "diagnostics"}
              onClick={() => setTab("diagnostics")}
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Diagnostics"
            />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "games" && <GamesTab />}
        {tab === "users" && <UsersTab />}
        {tab === "topups" && <TopupsTab />}
        {tab === "content" && <ContentTab />}
        {tab === "tutorials" && <TutorialsTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "logs" && <DownloadLogsTab />}
        {tab === "uploads" && <UploadAuditTab />}
        {tab === "diagnostics" && <DiagnosticsTab />}
      </main>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
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
  const [sortKey, setSortKey] = useState<"title" | "category" | "price_coins" | "created_at">(
    "created_at",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [draft, setDraft] = useState<GameRow>({
    id: "",
    title: "",
    category: "",
    description: "",
    badge: "",
    price_coins: 0,
    visible: true,
    image_url: "",
    screenshots: [],
    preview_video_url: null,
    file_path: null,
    file_size_bytes: null,
  });
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftFileError, setDraftFileError] = useState<string | null>(null);
  const [draftUrlError, setDraftUrlError] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<"file" | "library">("file");
  const [signedUrl, setSignedUrl] = useState<{ url: string; expiresAt: number } | null>(null);
  const [signing, setSigning] = useState(false);

  // --- Batch multi-file upload state ---
  type BatchStatus = "pending" | "uploading" | "done" | "error" | "skipped";
  type BatchItem = {
    id: string;
    file: File;
    title: string;
    slug: string;
    status: BatchStatus;
    pct: number;
    message?: string;
    path?: string;
    size?: number;
  };
  const [batchOpen, setBatchOpen] = useState(false);
  const [bulkLinksOpen, setBulkLinksOpen] = useState(false);
  const [bulkLinksText, setBulkLinksText] = useState("");
  const [bulkLinksParsed, setBulkLinksParsed] = useState<ParsedLinkRow[]>([]);
  const [bulkLinksRunning, setBulkLinksRunning] = useState(false);
  const [bulkLinksLog, setBulkLinksLog] = useState<
    Array<{ id: string; status: "ok" | "fail"; message?: string }>
  >([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchPrice, setBatchPrice] = useState<number>(0);
  const [batchCategory, setBatchCategory] = useState<string>("Game");
  const [batchVisible, setBatchVisible] = useState<boolean>(true);
  const batchCurrentRef = useRef<string | null>(null);
  const [batchPaused, setBatchPaused] = useState(false);
  const batchPausedRef = useRef(false);
  const batchResumeWaiterRef = useRef<(() => void) | null>(null);
  const waitWhilePaused = () =>
    batchPausedRef.current
      ? new Promise<void>((res) => {
          batchResumeWaiterRef.current = () => {
            batchResumeWaiterRef.current = null;
            res();
          };
        })
      : Promise.resolve();
  const pauseBatch = () => {
    batchPausedRef.current = true;
    setBatchPaused(true);
    // Pause the currently-running TUS upload too.
    if (uploadRef.current?.pause) uploadRef.current.pause();
  };
  const resumeBatch = () => {
    batchPausedRef.current = false;
    setBatchPaused(false);
    if (uploadRef.current?.resume) uploadRef.current.resume();
    batchResumeWaiterRef.current?.();
  };

  const showToast = (m: string) => {

    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const loadGames = useCallback(async () => {
    const { data, error } = await supabase.from("games").select("*").order("title");
    if (error) {
      showToast(error.message);
      return;
    }
    setGames((data ?? []) as GameRow[]);
  }, []);
  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadStats, setUploadStats] = useState<{
    sent: number;
    total: number;
    speedBps: number;
    etaSec: number;
  } | null>(null);
  type UploadStage = "idle" | "preparing" | "uploading" | "paused" | "processing" | "done" | "error";
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedInfo, setUploadedInfo] = useState<{
    path: string;
    size: number;
    mime: string;
    provider: "supabase" | "external_url";
    bucket?: string;
    uploadedAt?: string;
    processedAt?: string;
    checksum?: string;
    checksumAlgo?: string;
    checksumSkippedReason?: string;
  } | null>(null);
  const [splitGuideOpen, setSplitGuideOpen] = useState(false);
  const uploadRef = useRef<{
    abort: () => void;
    pause?: () => void;
    resume?: () => void;
  } | null>(null);

  // Admin-tunable TUS retry config (fetched once from app_settings on mount).
  // Defaults match the prior hardcoded values so behavior is unchanged until
  // an admin overrides them in Settings.
  const retryCfgRef = useRef<{
    maxNetRetries: number;
    retryDelaysMs: number[];
    backoffBaseMs: number;
    backoffStepMs: number;
    backoffCapMs: number;
  }>({
    maxNetRetries: 50,
    retryDelaysMs: [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 120000],
    backoffBaseMs: 3000,
    backoffStepMs: 2000,
    backoffCapMs: 30000,
  });
  const fetchAppSettings = useServerFn(getAppSettings);
  useEffect(() => {
    (async () => {
      try {
        const s = (await fetchAppSettings({})) as Record<string, unknown>;
        const delays = Array.isArray(s.tus_retry_delays_ms)
          ? (s.tus_retry_delays_ms as unknown[])
              .map((n) => Number(n))
              .filter((n) => Number.isFinite(n) && n >= 0)
          : retryCfgRef.current.retryDelaysMs;
        retryCfgRef.current = {
          maxNetRetries: Number(s.tus_max_net_retries) || retryCfgRef.current.maxNetRetries,
          retryDelaysMs: delays.length ? delays : retryCfgRef.current.retryDelaysMs,
          backoffBaseMs: Number(s.tus_backoff_base_ms) || retryCfgRef.current.backoffBaseMs,
          backoffStepMs: Number(s.tus_backoff_step_ms) || retryCfgRef.current.backoffStepMs,
          backoffCapMs: Number(s.tus_backoff_cap_ms) || retryCfgRef.current.backoffCapMs,
        };
      } catch {
        /* keep defaults */
      }
    })();
  }, [fetchAppSettings]);

  // Auto-open the split-file guide when an upload fails with a platform
  // per-upload cap (413 / ~50GB) error.
  useEffect(() => {
    if (uploadStage === "error" && isPlatformCapError(uploadError)) {
      setSplitGuideOpen(true);
    }
  }, [uploadStage, uploadError]);

  // Startup check: read game-files bucket's file_size_limit so we can block
  // oversize uploads BEFORE starting TUS (which would otherwise fail with 413
  // after wasting bandwidth on the create-upload request).
  const BUCKET_LIMIT_CACHE_KEY = "admin:game-files:limitBytes";
  const BUCKET_LIMIT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
  const [bucketLimitBytes, setBucketLimitBytes] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(BUCKET_LIMIT_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { limitBytes: number | null; at: number };
      if (Date.now() - parsed.at > BUCKET_LIMIT_CACHE_TTL_MS) return null;
      return parsed.limitBytes;
    } catch {
      return null;
    }
  });
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [lastLimitFetchAt, setLastLimitFetchAt] = useState<number | null>(null);
  const [lastLimitFetchError, setLastLimitFetchError] = useState<string | null>(null);
  const fetchBucketLimit = useServerFn(getGameFilesBucketLimit);
  useEffect(() => {
    let alive = true;
    fetchBucketLimit()
      .then((r) => {
        if (!alive) return;
        setBucketLimitBytes(r.limitBytes);
        setLastLimitFetchAt(Date.now());
        setLastLimitFetchError(null);
        try {
          window.localStorage.setItem(
            BUCKET_LIMIT_CACHE_KEY,
            JSON.stringify({ limitBytes: r.limitBytes, at: Date.now() }),
          );
        } catch {
          /* ignore quota */
        }
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLastLimitFetchError(e instanceof Error ? e.message : String(e));
        /* keep cached or null; upload will fall back to static MAX */
      });
    return () => {
      alive = false;
    };
  }, [fetchBucketLimit]);

  const effectiveMaxBytes = (): number =>
    bucketLimitBytes && bucketLimitBytes > 0
      ? Math.min(MAX_GAME_FILE_BYTES, bucketLimitBytes)
      : MAX_GAME_FILE_BYTES;

  // Diagnostics: log limit values to console whenever they change.
  useEffect(() => {
    const eff =
      bucketLimitBytes && bucketLimitBytes > 0
        ? Math.min(MAX_GAME_FILE_BYTES, bucketLimitBytes)
        : MAX_GAME_FILE_BYTES;
    // eslint-disable-next-line no-console
    console.log("[admin/upload-limits]", {
      MAX_GAME_FILE_BYTES,
      bucketLimitBytes,
      effectiveMaxBytes: eff,
      constrainedByBucket:
        bucketLimitBytes != null && bucketLimitBytes < MAX_GAME_FILE_BYTES,
      lastLimitFetchAt,
      lastLimitFetchError,
    });
  }, [bucketLimitBytes, lastLimitFetchAt, lastLimitFetchError]);

  const validateFile = (file: File): string | null => {
    const base = validateGameFile(file);
    if (base) return base;
    const max = effectiveMaxBytes();
    if (file.size > max) return oversizeForBucketMessage(file.size, max);
    return null;
  };

  // Map raw upload errors to friendlier Khmer messages.
  const friendlyUploadError = (raw: string, ctx?: { fileSize?: number }): string =>
    friendlyUploadErrorPure(raw, { fileSize: ctx?.fileSize, bucketLimitBytes });

  // Warn before closing/refreshing tab while an upload is in flight.
  useEffect(() => {
    if (uploadStage !== "uploading" && uploadStage !== "processing" && uploadStage !== "paused") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploadStage]);

  const cancelUpload = () => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    setUploadPct(null);
    setUploadStats(null);
    setUploadStage("idle");
    setUploadError(null);
    showToast("Upload បានបោះបង់");
  };

  const pauseUpload = () => {
    if (!uploadRef.current?.pause) return;
    uploadRef.current.pause();
  };

  const resumeUpload = () => {
    if (!uploadRef.current?.resume) return;
    uploadRef.current.resume();
  };

  const uploadFile = async (
    gameId: string,
    file: File,
  ): Promise<{ path: string; size: number } | null> => {
    const err = validateFile(file);
    if (err) {
      setUploadStage("error");
      setUploadError(err);
      showToast(err);
      return null;
    }
    setUploadStage("preparing");
    setUploadError(null);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${gameId}/${Date.now()}_${safe}`;
    const RESUMABLE_THRESHOLD = 1 * 1024 * 1024; // 1MB — files >1MB use TUS resumable
    if (file.size <= RESUMABLE_THRESHOLD) {
      setUploadStage("uploading");
      setUploadPct(0);
      setUploadStats({ sent: 0, total: file.size, speedBps: 0, etaSec: 0 });
      const { error } = await supabase.storage
        .from("game-files")
        .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (error) {
        const friendly = friendlyUploadError(error.message, { fileSize: file.size });
        setUploadStage("error");
        setUploadError(friendly);
        setUploadPct(null);
        setUploadStats(null);
        showToast(`Upload: ${friendly}`);
        return null;
      }
      setUploadPct(100);
      setUploadStats({ sent: file.size, total: file.size, speedBps: 0, etaSec: 0 });
      return { path, size: file.size };
    }
    const tus = await import("tus-js-client");
    // Always refresh before a long-running upload so we start with a full TTL on
    // the access token; otherwise a near-expiry token can 401 mid-stream.
    let { data: sess } = await supabase.auth.getSession();
    try {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session) sess = { session: refreshed.data.session };
    } catch {
      /* keep existing session if refresh fails */
    }
    let currentToken = sess.session?.access_token;
    if (!currentToken) {
      setUploadStage("error");
      setUploadError("សិទ្ធិផុតកំណត់ — សូមចូលគណនីឡើងវិញ");
      showToast("Upload: not authenticated");
      return null;
    }
    const projectUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const GB = 1024 * 1024 * 1024;
    const chunkSize =
      file.size >= 50 * GB
        ? 64 * 1024 * 1024
        : file.size >= 5 * GB
          ? 32 * 1024 * 1024
          : file.size >= 200 * 1024 * 1024
            ? 16 * 1024 * 1024
            : 8 * 1024 * 1024;
    return await new Promise((resolve) => {
      setUploadStage("uploading");
      setUploadPct(0);
      setUploadStats({ sent: 0, total: file.size, speedBps: 0, etaSec: 0 });
      let lastTs = performance.now();
      let lastSent = 0;
      let aborted = false;
      let paused = false;
      let netRetryCount = 0;
      const MAX_NET_RETRIES = retryCfgRef.current.maxNetRetries;
      let currentUpload: import("tus-js-client").Upload | null = null;
      let pendingOnlineHandler: (() => void) | null = null;
      let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
      const tusHeaders: Record<string, string> = {
        authorization: `Bearer ${currentToken}`,
        "x-upsert": "true",
      };

      // Audit helper: fire-and-forget, captures gameId + file metadata + latest offset.
      const audit = (event_type: Parameters<typeof logUploadEvent>[0]["event_type"], extra?: { message?: string; attempt?: number }) => {
        void logUploadEvent({
          event_type,
          game_id: gameId,
          file_name: file.name,
          file_size_bytes: file.size,
          offset_bytes: lastSent,
          attempt: extra?.attempt ?? (netRetryCount > 0 ? netRetryCount : null),
          message: extra?.message ?? null,
        });
      };
      audit("start");

      const cleanupPending = () => {
        if (pendingOnlineHandler) {
          try { window.removeEventListener("online", pendingOnlineHandler); } catch { /* ignore */ }
          pendingOnlineHandler = null;
        }
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
      };

      const onTusError = (err: Error) => {
        if (aborted || paused) return;
        const status =
          (err as import("tus-js-client").DetailedError).originalResponse?.getStatus?.() ?? 0;
        const msg = err.message ?? "";
        const isNetwork =
          status === 0 ||
          /Failed to fetch|NetworkError|network|offline|timeout|ECONN|ENET|disconnected/i.test(msg) ||
          (typeof navigator !== "undefined" && !navigator.onLine);

        if (isNetwork && netRetryCount < MAX_NET_RETRIES) {
          netRetryCount++;
          setUploadStage("uploading");
          setUploadError(
            `បាត់សញ្ញាបណ្ដាញ — រង់ចាំការតភ្ជាប់ឡើងវិញ ហើយបន្តពីចំណុចបច្ចុប្បន្ន (ព្យាយាម #${netRetryCount})`,
          );
          audit("network_lost", { message: msg, attempt: netRetryCount });
          const offline = typeof navigator !== "undefined" && !navigator.onLine;
          const resumeNow = () => {
            cleanupPending();
            if (aborted) return;
            audit("network_restored", { attempt: netRetryCount });
            audit("retry", { attempt: netRetryCount });
            buildAndStart();
          };
          if (offline && typeof window !== "undefined") {
            pendingOnlineHandler = resumeNow;
            window.addEventListener("online", resumeNow, { once: true });
          } else {
            const cfg = retryCfgRef.current;
            const delay = Math.min(cfg.backoffBaseMs + netRetryCount * cfg.backoffStepMs, cfg.backoffCapMs);
            pendingTimeout = setTimeout(resumeNow, delay);
          }
          return;
        }

        // Terminal failure — surface to user.
        cleanupPending();
        const friendly = friendlyUploadError(msg, { fileSize: file.size });
        setUploadStage("error");
        setUploadError(friendly);
        setUploadPct(null);
        setUploadStats(null);
        uploadRef.current = null;
        audit("error", { message: friendly });
        showToast(`Upload: ${friendly}`);
        resolve(null);
      };

      const buildAndStart = () => {
        currentUpload = new tus.Upload(file, {
          endpoint: `${projectUrl}/storage/v1/upload/resumable`,
          retryDelays: retryCfgRef.current.retryDelaysMs,
          headers: tusHeaders,
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: "game-files",
            objectName: path,
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600",
          },
          chunkSize,
          parallelUploads: 1,
          // Refresh the bearer token on auth failures so multi-hour uploads
          // survive Supabase's 1-hour access-token TTL. Also retry on
          // network-class errors so brief outages don't terminate the upload.
          onShouldRetry: (err: import("tus-js-client").DetailedError) => {
            const status = err.originalResponse?.getStatus?.() ?? 0;
            if (status === 401 || status === 403) {
              audit("token_refresh", { message: `status ${status}` });
              supabase.auth
                .refreshSession()
                .then(({ data }) => {
                  const fresh = data.session?.access_token;
                  if (fresh) {
                    currentToken = fresh;
                    tusHeaders.authorization = `Bearer ${fresh}`;
                  }
                })
                .catch(() => { /* will surface via onError */ });
              return true;
            }
            // network (status 0), gateway/5xx, or 408/429 → retry
            return (
              status === 0 ||
              status === 408 ||
              status === 429 ||
              (status >= 500 && status < 600)
            );
          },
          onError: onTusError,
          onProgress: (sent: number, total: number) => {
            const now = performance.now();
            const dt = (now - lastTs) / 1000;
            if (dt >= 0.25 || sent === total) {
              const speedBps = dt > 0 ? (sent - lastSent) / dt : 0;
              const remaining = Math.max(total - sent, 0);
              const etaSec = speedBps > 0 ? remaining / speedBps : 0;
              setUploadPct(Math.round((sent / total) * 100));
              setUploadStats({ sent, total, speedBps, etaSec });
              lastTs = now;
              lastSent = sent;
              // Clear stale reconnect message once data is flowing again.
              if (netRetryCount > 0) setUploadError(null);
            }
          },
          onSuccess: () => {
            cleanupPending();
            setUploadPct(100);
            setUploadStats({ sent: file.size, total: file.size, speedBps: 0, etaSec: 0 });
            uploadRef.current = null;
            lastSent = file.size;
            audit("success");
            resolve({ path, size: file.size });
          },
        });

        uploadRef.current = {
          abort: () => {
            aborted = true;
            cleanupPending();
            audit("abort");
            try { currentUpload?.abort(true); } catch { /* ignore */ }
            resolve(null);
          },
          pause: () => {
            if (aborted || paused) return;
            paused = true;
            cleanupPending();
            try { currentUpload?.abort(); } catch { /* ignore */ }
            setUploadStage("paused");
            setUploadError("ផ្អាកដោយដៃ — ចុច “បន្ត” ដើម្បីអាប់ឡូដបន្តពីចំណុចបច្ចុប្បន្ន");
            audit("pause");
            showToast("Upload ត្រូវបានផ្អាក");
          },
          resume: () => {
            if (aborted || !paused) return;
            paused = false;
            setUploadStage("uploading");
            setUploadError(null);
            lastTs = performance.now();
            // Keep lastSent so audit offsets remain monotonic across the resume.
            audit("resume");
            buildAndStart();
            showToast("Upload បានបន្ត");
          },
        };

        currentUpload
          .findPreviousUploads()
          .then((prev: import("tus-js-client").PreviousUpload[]) => {
            if (aborted || !currentUpload) return;
            // Only resume previous uploads from the LAST 6 hours — older
            // fingerprints often reference upload URLs whose server-side state
            // (and bearer auth) has already expired, causing immediate 4xx.
            const SIX_HOURS = 6 * 60 * 60 * 1000;
            const fresh = prev.find((p) => {
              const t = p.creationTime ? Date.parse(p.creationTime) : 0;
              return t && Date.now() - t < SIX_HOURS;
            });
            if (fresh) currentUpload.resumeFromPreviousUpload(fresh);
            currentUpload.start();
          })
          .catch(() => {
            if (!aborted && currentUpload) currentUpload.start();
          });
      };

      buildAndStart();
    });
  };

  const uploadCoverImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      showToast("សូមជ្រើសរូបភាព");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("រូបភាពធំជាង 10MB");
      return null;
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `covers/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error } = await supabase.storage
      .from("game-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      showToast(`Upload: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("game-images").getPublicUrl(path);
    return data.publicUrl;
  };

  /** Upload a screenshot/gallery image (same bucket as cover, separate folder). */
  const uploadScreenshot = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      showToast("សូមជ្រើសរូបភាព");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("រូបភាពធំជាង 10MB");
      return null;
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `screenshots/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error } = await supabase.storage
      .from("game-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      showToast(`Upload: ${error.message}`);
      return null;
    }
    return supabase.storage.from("game-images").getPublicUrl(path).data.publicUrl;
  };

  /** Upload a short preview/trailer video (capped to keep page fast). */
  const uploadPreviewVideo = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("video/")) {
      showToast("សូមជ្រើសវីដេអូ");
      return null;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast("វីដេអូធំជាង 50MB — សូមបង្ហាប់សិន");
      return null;
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `videos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error } = await supabase.storage
      .from("game-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      showToast(`Upload: ${error.message}`);
      return null;
    }
    return supabase.storage.from("game-images").getPublicUrl(path).data.publicUrl;
  };

  const updateGame = async (id: string, patch: Partial<GameRow>) => {
    setBusy(true);
    const { error } = await supabase.from("games").update(patch).eq("id", id);
    setBusy(false);
    if (error) {
      showToast(error.message);
      return;
    }
    setGames((g) => g.map((x) => (x.id === id ? { ...x, ...patch } : x)));
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
    if (error) {
      showToast(error.message);
      return;
    }
    setGames((gs) => gs.filter((x) => x.id !== g.id));
    showToast("លុបរួច");
  };

  const createGame = async () => {
    if (draftFile) {
      const preErr = validateFile(draftFile);
      if (preErr) setDraftFileError(preErr);
    }
    setBusy(true);
    setUploadError(null);
    setUploadedInfo(null);
    setSignedUrl(null);
    if (!draftFile) setUploadStage("processing");
    const result = await submitCreateGame(
      {
        id: draft.id,
        title: draft.title,
        category: draft.category,
        description: draft.description ?? "",
        badge: draft.badge ?? "",
        price_coins: Number(draft.price_coins) || 0,
        visible: draft.visible,
        image_url: draft.image_url ?? "",
        screenshots: draft.screenshots ?? [],
        preview_video_url: draft.preview_video_url ?? null,
        file_url: sourceMode === "library" ? (draft.file_path ?? null) : null,
        storage_provider: sourceMode === "library" ? "external_url" : "supabase",
        external_file: null,
      },
      sourceMode === "file" ? draftFile : null,
      {
        uploadFile: async (gameId, file) => {
          const f = file as File;
          // Compute SHA-256 only for files <= 200MB to avoid blocking on huge files.
          const CHECKSUM_MAX = 200 * 1024 * 1024;
          let checksum: string | undefined;
          let checksumSkippedReason: string | undefined;
          if (f.size <= CHECKSUM_MAX && typeof crypto !== "undefined" && crypto.subtle) {
            try {
              const buf = await f.arrayBuffer();
              const digest = await crypto.subtle.digest("SHA-256", buf);
              checksum = Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            } catch {
              checksumSkippedReason = "compute failed";
            }
          } else if (f.size > CHECKSUM_MAX) {
            checksumSkippedReason = "file > 200MB";
          }
          const up = await uploadFile(gameId, f);
          if (up) {
            setUploadStage("processing");
            setUploadedInfo({
              path: up.path,
              size: up.size,
              mime: f.type || "application/octet-stream",
              provider: "supabase",
              bucket: "game-files",
              uploadedAt: new Date().toISOString(),
              checksum,
              checksumAlgo: checksum ? "SHA-256" : undefined,
              checksumSkippedReason,
            });
          }
          return up;
        },
        insertGame: async (row) => {
          const { error } = await supabase.from("games").insert(row);
          return { error: error ? { message: error.message } : null };
        },
        onError: (msg) => {
          setUploadStage("error");
          setUploadError(msg);
          showToast(msg);
        },
      },
    );
    setBusy(false);
    if (!result.ok) {
      // uploadFile / onError already populated stage. If they didn't, set error here.
      setUploadStage((s) => (s === "processing" || s === "uploading" ? "error" : s));
      return;
    }
    setUploadStage("done");
    const nowIso = new Date().toISOString();
    // Capture metadata for External URL flow (file flow set it inside uploadFile).
    if (sourceMode === "library" && draft.file_path) {
      setUploadedInfo({
        path: draft.file_path,
        size: 0,
        mime: "application/octet-stream",
        provider: "external_url",
        uploadedAt: nowIso,
        processedAt: nowIso,
        checksumSkippedReason: "external URL",
      });
    } else {
      setUploadedInfo((info) => (info ? { ...info, processedAt: nowIso } : info));
    }
    setUploadPct(null);
    setUploadStats(null);
    setCreating(false);
    setDraft({
      id: "",
      title: "",
      category: "",
      description: "",
      badge: "",
      price_coins: 0,
      visible: true,
      image_url: "",
      screenshots: [],
      preview_video_url: null,
      file_path: null,
      file_size_bytes: null,
    });
    setDraftFile(null);
    setDraftFileError(null);
    setDraftUrlError(null);
    loadGames();
    showToast("បន្ថែមរួច");
    setTimeout(() => setUploadStage("idle"), 1500);
  };

  const categories = Array.from(new Set(games.map((g) => g.category).filter(Boolean))).sort();
  const q = query.trim().toLowerCase();
  const filtered = games
    .filter((g) => {
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
    })
    .slice()
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "price_coins") return (a.price_coins - b.price_coins) * dir;
      if (sortKey === "created_at")
        return (a.created_at ?? "").localeCompare(b.created_at ?? "") * dir;
      return String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? "")) * dir;
    });

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "created_at" || k === "price_coins" ? "desc" : "asc");
    }
  };
  const sortIcon = (k: typeof sortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  // --- Batch upload helpers ---
  const slugifyName = (name: string): string => {
    const noExt = name.replace(/\.(zip|rar|7z|tar|gz|tgz)$/i, "");
    const base = noExt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return (base || `game-${Date.now()}`).slice(0, 48);
  };
  const uniqueSlug = (base: string, taken: Set<string>): string => {
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  };

  const updateBatchItem = (id: string, patch: Partial<BatchItem>) => {
    setBatchItems((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  // Mirror shared upload progress into the currently-running batch row.
  useEffect(() => {
    if (!batchRunning || !batchCurrentRef.current) return;
    if (uploadPct == null) return;
    updateBatchItem(batchCurrentRef.current, { pct: uploadPct });
  }, [uploadPct, batchRunning]);

  // Aggregate batch progress: bytes done from finished items + live bytes of
  // the currently uploading item, divided by total batch bytes.
  const batchAggregate = (() => {
    const total = batchItems.reduce((s, it) => s + (it.file.size || 0), 0);
    let sent = 0;
    for (const it of batchItems) {
      if (it.status === "done") sent += it.file.size || 0;
      else if (it.status === "uploading" && uploadStats) sent += Math.min(uploadStats.sent, it.file.size || 0);
    }
    const speedBps = uploadStats?.speedBps ?? 0;
    const remaining = Math.max(0, total - sent);
    const etaSec = speedBps > 0 ? remaining / speedBps : 0;
    const pct = total > 0 ? (sent / total) * 100 : 0;
    const done = batchItems.filter((it) => it.status === "done").length;
    const errored = batchItems.filter((it) => it.status === "error").length;
    return { total, sent, speedBps, etaSec, pct, done, errored, count: batchItems.length };
  })();

  const fmtSpeed = (bps: number) =>
    bps >= 1024 * 1024
      ? `${(bps / 1024 / 1024).toFixed(1)} MB/s`
      : bps >= 1024
        ? `${(bps / 1024).toFixed(0)} KB/s`
        : `${bps.toFixed(0)} B/s`;
  const fmtEta = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return "—";
    const s = Math.round(sec);
    if (s < 60) return `${s}វិ`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return `${m}ន ${rem}វិ`;
    const h = Math.floor(m / 60);
    return `${h}ម៉ ${m % 60}ន`;
  };


  const addBatchFiles = (files: File[]) => {
    const taken = new Set<string>([
      ...games.map((g) => g.id),
      ...batchItems.map((b) => b.slug),
    ]);
    const next: BatchItem[] = [];
    for (const f of files) {
      const base = slugifyName(f.name);
      const slug = uniqueSlug(base, taken);
      taken.add(slug);
      const titleBase = f.name.replace(/\.(zip|rar|7z|tar|gz|tgz)$/i, "");
      const preErr = validateFile(f);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        title: titleBase,
        slug,
        status: preErr ? "error" : "pending",
        pct: 0,
        message: preErr ?? undefined,
      });
    }
    setBatchItems((prev) => [...prev, ...next]);
  };

  const removeBatchItem = (id: string) => {
    if (batchRunning && batchCurrentRef.current === id) return;
    setBatchItems((prev) => prev.filter((it) => it.id !== id));
  };

  const clearBatch = () => {
    if (batchRunning) return;
    setBatchItems([]);
  };

  /**
   * Preflight validation: re-check every pending item before any upload starts.
   *  - file size within bounds (validateFile)
   *  - slug non-empty / well-formed
   *  - slug unique within the batch
   *  - slug not already present in DB (live query against public.games.id)
   * Marks failing items as "error" with a clear message and returns the count
   * of items still valid to upload. Returns -1 if a fatal DB error occurred.
   */
  const preflightBatch = async (): Promise<number> => {
    const pending = batchItems.filter((it) => it.status === "pending");
    if (pending.length === 0) return 0;

    // 1. Local checks: size + slug shape + intra-batch duplicates
    const seen = new Map<string, string>(); // slug -> first item id
    const localErrors = new Map<string, string>(); // item id -> message
    for (const it of pending) {
      const sizeErr = validateFile(it.file);
      if (sizeErr) {
        localErrors.set(it.id, sizeErr);
        continue;
      }
      const slug = (it.slug || "").trim();
      if (!slug || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
        localErrors.set(it.id, `Slug មិនត្រឹមត្រូវ: "${it.slug}" (a-z, 0-9, "-", ≤64 តួ)`);
        continue;
      }
      const firstId = seen.get(slug);
      if (firstId) {
        localErrors.set(it.id, `Slug ស្ទួនក្នុង batch: "${slug}"`);
      } else {
        seen.set(slug, it.id);
      }
    }

    // 2. DB check: any of the still-valid slugs already exist?
    const slugsToCheck = pending
      .filter((it) => !localErrors.has(it.id))
      .map((it) => it.slug);
    if (slugsToCheck.length > 0) {
      const { data, error } = await supabase
        .from("games")
        .select("id")
        .in("id", slugsToCheck);
      if (error) {
        showToast(`Preflight បរាជ័យ: ${error.message}`);
        return -1;
      }
      const taken = new Set((data ?? []).map((r) => r.id));
      for (const it of pending) {
        if (localErrors.has(it.id)) continue;
        if (taken.has(it.slug)) {
          localErrors.set(it.id, `Slug មានក្នុង DB រួចហើយ: "${it.slug}"`);
        }
      }
    }

    // 3. Apply errors in one state update
    if (localErrors.size > 0) {
      setBatchItems((items) =>
        items.map((it) =>
          localErrors.has(it.id)
            ? { ...it, status: "error" as BatchStatus, pct: 0, message: localErrors.get(it.id) }
            : it,
        ),
      );
    }
    return pending.length - localErrors.size;
  };

  const runPreflightOnly = async () => {
    if (batchRunning) return;
    const ok = await preflightBatch();
    if (ok < 0) return;
    const failed = batchItems.filter((it) => it.status === "pending").length - ok;
    showToast(
      ok === 0 && failed === 0
        ? "គ្មានឯកសារត្រូវពិនិត្យ"
        : `Preflight: ${ok} OK • ${failed} មានបញ្ហា`,
    );
  };

  const runBatch = async () => {
    if (batchRunning) return;
    // Preflight first — refuses to start if any item fails validation.
    const okCountPre = await preflightBatch();
    if (okCountPre < 0) return; // DB error already toasted
    const queue = batchItems.filter((it) => it.status === "pending");
    if (queue.length === 0) {
      showToast("គ្មានឯកសារត្រឹមត្រូវសម្រាប់បង្ហោះ — សូមពិនិត្យ errors");
      return;
    }
    setBatchRunning(true);
    for (const item of queue) {
      // Block here if user paused the queue between items.
      await waitWhilePaused();
      batchCurrentRef.current = item.id;
      updateBatchItem(item.id, { status: "uploading", pct: 0, message: undefined });
      setUploadError(null);
      try {
        const up = await uploadFile(item.slug, item.file);
        if (!up) {
          updateBatchItem(item.id, {
            status: "error",
            message: uploadError ?? "Upload បរាជ័យ",
          });
          continue;
        }
        // Insert game row directly via Supabase (RLS: admin only).
        const { error: insErr } = await supabase.from("games").insert({
          id: item.slug,
          title: item.title || item.slug,
          category: batchCategory || "Game",
          description: "",
          badge: null,
          price_coins: batchPrice || 0,
          visible: batchVisible,
          image_url: null,
          screenshots: [],
          preview_video_url: null,
          file_path: up.path,
          file_size_bytes: up.size,
          storage_provider: "supabase",
        });
        if (insErr) {
          // Roll back uploaded object so it doesn't orphan.
          await supabase.storage.from("game-files").remove([up.path]).catch(() => {});
          updateBatchItem(item.id, { status: "error", message: insErr.message });
          continue;
        }
        updateBatchItem(item.id, {
          status: "done",
          pct: 100,
          path: up.path,
          size: up.size,
        });
      } catch (e: any) {
        updateBatchItem(item.id, {
          status: "error",
          message: e?.message ?? String(e),
        });
      }
    }
    batchCurrentRef.current = null;
    batchPausedRef.current = false;
    setBatchPaused(false);
    batchResumeWaiterRef.current?.();
    setBatchRunning(false);
    setUploadStage("idle");
    setUploadPct(null);
    setUploadStats(null);
    await loadGames();
    const okCount = batchItems.filter((it) => it.status === "done").length;
    showToast(`Batch upload បានបញ្ចប់ — ${okCount}/${queue.length} ជោគជ័យ`);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-display text-xl">
            ហ្គេមទាំងអស់ ({filtered.length}/{games.length})
          </h2>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground ring-1 ring-border"
            title={
              bucketLimitBytes && bucketLimitBytes < MAX_GAME_FILE_BYTES
                ? "ដែនកំណត់ bucket បច្ចុប្បន្ន"
                : "ដែនកំណត់អតិបរមា"
            }
          >
            <FileArchive className="h-3 w-3" />
            អតិបរមា Upload: {formatBytes(effectiveMaxBytes())}
          </span>
          <button
            type="button"
            onClick={() => setShowDiagnostics((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground ring-1 ring-border hover:text-foreground"
            title="បង្ហាញ/លាក់ផ្ទាំង diagnostics"
          >
            {showDiagnostics ? "លាក់" : "បង្ហាញ"} Diagnostics
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBatchOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-muted/60"
            title="បង្ហោះច្រើនឯកសារក្នុងដងតែមួយ"
          >
            <FileArchive className="h-3.5 w-3.5" /> Batch Upload
          </button>
          <button
            onClick={() => {
              setBulkLinksOpen(true);
              setBulkLinksLog([]);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-muted/60"
            title="នាំចូលច្រើនតំណពី Google Drive / Mega / etc."
          >
            <LinkIcon className="h-3.5 w-3.5" /> Bulk Link Import
          </button>
          <button
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> បន្ថែមហ្គេម
          </button>
        </div>
      </div>

      {batchOpen && (
        <div className="rounded-2xl glass p-4 space-y-3 animate-scale-in origin-top border border-primary/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <FileArchive className="h-4 w-4 text-primary" /> Batch Upload (ច្រើនឯកសារ)
            </h3>
            <span className="text-[10px] text-muted-foreground">
              បង្ហោះម្តងមួយឯកសារ · ទំហំ 1MB–{formatBytes(effectiveMaxBytes())}
            </span>
          </div>

          {/* Shared defaults for batch */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">ប្រភេទរួម</span>
              <input
                value={batchCategory}
                onChange={(e) => setBatchCategory(e.target.value)}
                disabled={batchRunning}
                className="w-full rounded-lg bg-input px-3 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">តម្លៃរួម (Balance)</span>
              <input
                type="number"
                value={batchPrice ? String(batchPrice) : ""}
                placeholder="0"
                onChange={(e) => setBatchPrice(Number(e.target.value) || 0)}
                disabled={batchRunning}
                className="w-full rounded-lg bg-input px-3 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary disabled:opacity-50"
              />
            </label>
            <label className="flex items-end gap-2 text-xs">
              <input
                type="checkbox"
                checked={batchVisible}
                onChange={(e) => setBatchVisible(e.target.checked)}
                disabled={batchRunning}
                className="h-4 w-4"
              />
              បង្ហាញសាធារណៈ
            </label>
          </div>

          {/* File picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-primary/20">
              + ជ្រើសរើសឯកសារ
              <input
                type="file"
                accept=".zip,.rar,.7z,.tar,.gz,.tgz"
                multiple
                disabled={batchRunning}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) addBatchFiles(files);
                }}
              />
            </label>
            <button
              type="button"
              onClick={runPreflightOnly}
              disabled={batchRunning || batchItems.filter((it) => it.status === "pending").length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border disabled:opacity-50"
              title="ពិនិត្យ slug + ទំហំឯកសារ មុនបង្ហោះ"
            >
              Preflight
            </button>
            <button
              type="button"
              onClick={runBatch}
              disabled={batchRunning || batchItems.filter((it) => it.status === "pending").length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {batchRunning ? "កំពុងបង្ហោះ…" : `ចាប់ផ្តើម Batch (${batchItems.filter((it) => it.status === "pending").length})`}
            </button>
            {batchRunning && !batchPaused && (
              <button
                type="button"
                onClick={pauseBatch}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/40 hover:bg-amber-500/25"
                title="ផ្អាក batch និងឯកសារកំពុងបង្ហោះ"
              >
                ⏸ ផ្អាក Batch
              </button>
            )}
            {batchRunning && batchPaused && (
              <button
                type="button"
                onClick={resumeBatch}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25"
                title="បន្ត batch ពីកន្លែងផ្អាក"
              >
                ▶ បន្ត Batch
              </button>
            )}
            <button
              type="button"
              onClick={clearBatch}
              disabled={batchRunning || batchItems.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border disabled:opacity-50"
            >
              សម្អាត
            </button>
          </div>

          {/* Items list */}
          {batchRunning && batchAggregate.count > 0 && (
            <div className="rounded-lg bg-card/60 p-2.5 ring-1 ring-primary/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium flex-wrap gap-2">
                <span>
                  Batch: {batchAggregate.done}/{batchAggregate.count} ឯកសារ
                  {batchAggregate.errored > 0 && <span className="text-destructive"> · {batchAggregate.errored} បរាជ័យ</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatBytes(batchAggregate.sent)} / {formatBytes(batchAggregate.total)} · {fmtSpeed(batchAggregate.speedBps)} · ETA {fmtEta(batchAggregate.etaSec)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, batchAggregate.pct)}%` }} />
              </div>
            </div>
          )}
          {batchItems.length > 0 && (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {batchItems.map((it) => {
                const toneRing =
                  it.status === "done"
                    ? "ring-emerald-500/40"
                    : it.status === "error"
                      ? "ring-destructive/50"
                      : it.status === "uploading"
                        ? "ring-primary/50"
                        : "ring-border";
                const toneBar =
                  it.status === "done"
                    ? "bg-emerald-400"
                    : it.status === "error"
                      ? "bg-destructive"
                      : "bg-primary";
                return (
                  <div key={it.id} className={`rounded-lg bg-card/50 p-2 ring-1 ${toneRing}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium flex-1 truncate" title={it.file.name}>
                        {it.file.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {(it.file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground" title="slug">
                        {it.slug}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase ${
                          it.status === "done"
                            ? "text-emerald-400"
                            : it.status === "error"
                              ? "text-destructive"
                              : it.status === "uploading"
                                ? "text-primary"
                                : "text-muted-foreground"
                        }`}
                      >
                        {it.status === "uploading" ? `${it.pct.toFixed(0)}%` : it.status}
                      </span>
                      {it.status === "uploading" && uploadStats && (
                        <span className="text-[10px] text-muted-foreground tabular-nums" title="ល្បឿន · ETA">
                          {fmtSpeed(uploadStats.speedBps)} · ETA {fmtEta(uploadStats.etaSec)}
                        </span>
                      )}
                      {/* end progress meta */}
                      {!batchRunning && it.status !== "uploading" && (
                        <button
                          type="button"
                          onClick={() => removeBatchItem(it.id)}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {(it.status === "uploading" || it.status === "done") && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${toneBar} transition-all`}
                          style={{ width: `${Math.min(100, it.pct)}%` }}
                        />
                      </div>
                    )}
                    {it.message && (
                      <p className="mt-1 text-[10px] text-destructive">{it.message}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={bulkLinksOpen} onOpenChange={(o) => !bulkLinksRunning && setBulkLinksOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> Bulk Link Import
            </DialogTitle>
            <DialogDescription>
              បិទភ្ជាប់តំណមួយក្នុងមួយជួរ ឬ <code>id|title|category|price|url</code>។ បន្ទាប់មក Parse → Import។
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={bulkLinksText}
            onChange={(e) => setBulkLinksText(e.target.value)}
            disabled={bulkLinksRunning}
            rows={8}
            placeholder={"https://cdn.example.com/cool-game.zip\nacid|Acid Quest|RPG|150|https://x.example/acid.zip"}
            className="w-full rounded-lg bg-input px-3 py-2 text-xs font-mono outline-none ring-1 ring-border focus:ring-primary disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              disabled={bulkLinksRunning || !bulkLinksText.trim()}
              onClick={async () => {
                const parsed = parseBulkLinks(bulkLinksText);
                // Fetch existing ids + external URLs so we can mark duplicates.
                const { data: existing } = await supabase
                  .from("games")
                  .select("id, file_path, storage_provider");
                const ids = (existing ?? []).map((g) => g.id as string);
                const urls = (existing ?? [])
                  .filter((g) => g.storage_provider === "external_url" && g.file_path)
                  .map((g) => g.file_path as string);
                setBulkLinksParsed(dedupeAgainstExisting(parsed, { ids, urls }));
              }}
              className="rounded-full bg-muted/40 px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-muted/60 disabled:opacity-50"
            >
              Parse
            </button>
            {bulkLinksParsed.length > 0 && (() => {
              const s = summarizeParse(bulkLinksParsed);
              return (
                <span className="text-[11px] text-muted-foreground">
                  {s.importable}/{s.total} នាំចូលបាន · {s.skipped} រំលង · {s.invalid} ខុស
                </span>
              );
            })()}
          </div>
          {bulkLinksParsed.some((r) => r.skipped) && (() => {
            const dups = bulkLinksParsed.filter((r) => r.skipped);
            const ids = dups.map((r) => r.draft?.id).filter(Boolean) as string[];
            const preview = ids.slice(0, 6).join(", ");
            const more = ids.length > 6 ? ` +${ids.length - 6}` : "";
            return (
              <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 px-3 py-2 text-[11px] text-amber-200">
                <div className="font-semibold">⚠ រកឃើញស្ទួន {dups.length} ធាតុ — នឹងរំលង</div>
                {preview && <div className="mt-0.5 font-mono text-amber-100/80 truncate">{preview}{more}</div>}
              </div>
            );
          })()}
          {bulkLinksParsed.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-lg ring-1 ring-border text-[11px]">
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0">
                  <tr><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">id</th><th className="px-2 py-1 text-left">title</th><th className="px-2 py-1 text-left">price</th><th className="px-2 py-1 text-left">ស្ថានភាព</th></tr>
                </thead>
                <tbody>
                  {bulkLinksParsed.map((r) => {
                    const log = bulkLinksLog.find((l) => l.id === r.draft?.id);
                    const statusClass = r.skipped
                      ? "text-amber-400"
                      : r.ok
                        ? log?.status === "fail"
                          ? "text-rose-400"
                          : log?.status === "ok"
                            ? "text-emerald-400"
                            : "text-foreground"
                        : "text-rose-400";
                    const statusText = r.skipped
                      ? `⤼ ${r.skipReason ?? "រំលង"}`
                      : r.ok
                        ? log
                          ? log.status === "ok"
                            ? "✓ បានបន្ថែម"
                            : `✗ ${log.message ?? "បរាជ័យ"}`
                          : "រង់ចាំ"
                        : r.error;
                    return (
                      <tr key={r.lineNumber} className="border-t border-border/40">
                        <td className="px-2 py-1 text-muted-foreground">{r.lineNumber}</td>
                        <td className="px-2 py-1 font-mono">{r.draft?.id ?? "—"}</td>
                        <td className="px-2 py-1 truncate max-w-[200px]">{r.draft?.title ?? r.raw}</td>
                        <td className="px-2 py-1">{r.draft?.price_coins ?? "—"}</td>
                        <td className={`px-2 py-1 ${statusClass}`}>{statusText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setBulkLinksOpen(false)}
              disabled={bulkLinksRunning}
              className="rounded-full bg-muted/40 px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-muted/60 disabled:opacity-50"
            >
              បិទ
            </button>
            <button
              type="button"
              disabled={
                bulkLinksRunning ||
                bulkLinksParsed.filter((r) => r.ok).length === 0
              }
              onClick={async () => {
                setBulkLinksRunning(true);
                setBulkLinksLog([]);
                const results: Array<{ id: string; status: "ok" | "fail"; message?: string }> = [];
                for (const row of bulkLinksParsed) {
                  if (!row.ok || !row.draft) continue;
                  const d = row.draft;
                  const res = await submitCreateGame(
                    {
                      id: d.id,
                      title: d.title,
                      category: d.category,
                      description: "",
                      badge: "",
                      price_coins: d.price_coins,
                      visible: true,
                      image_url: "",
                      storage_provider: "external_url",
                      external_file: { path: d.url, size: null },
                    },
                    null,
                    {
                      uploadFile: async () => null,
                      insertGame: async (row) => {
                        const { error } = await supabase.from("games").insert(row);
                        return { error: error ? { message: error.message } : null };
                      },
                    },
                  );
                  results.push(
                    res.ok
                      ? { id: d.id, status: "ok" }
                      : { id: d.id, status: "fail", message: res.message },
                  );
                  setBulkLinksLog([...results]);
                }
                setBulkLinksRunning(false);
                await loadGames();
                const okCount = results.filter((r) => r.status === "ok").length;
                const skipCount = bulkLinksParsed.filter((r) => r.skipped).length;
                const suffix = skipCount > 0 ? ` · រំលង ${skipCount}` : "";
                showToast(`បាននាំចូល ${okCount}/${results.length} តំណ${suffix}`);
              }}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {bulkLinksRunning ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> កំពុងនាំចូល…</span>
              ) : (
                `នាំចូល ${bulkLinksParsed.filter((r) => r.ok).length} តំណ`
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {showDiagnostics && (
        <div className="rounded-2xl glass p-3 text-[11px] font-mono space-y-2 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-400">Upload Limit Diagnostics</span>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.removeItem(BUCKET_LIMIT_CACHE_KEY);
                } catch {
                  /* ignore */
                }
                setBucketLimitBytes(null);
                setLastLimitFetchAt(null);
                setLastLimitFetchError(null);
                fetchBucketLimit()
                  .then((r) => {
                    setBucketLimitBytes(r.limitBytes);
                    setLastLimitFetchAt(Date.now());
                    try {
                      window.localStorage.setItem(
                        BUCKET_LIMIT_CACHE_KEY,
                        JSON.stringify({ limitBytes: r.limitBytes, at: Date.now() }),
                      );
                    } catch {
                      /* ignore */
                    }
                  })
                  .catch((e: unknown) =>
                    setLastLimitFetchError(e instanceof Error ? e.message : String(e)),
                  );
              }}
              className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Refetch
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            <div>
              <span className="text-foreground/70">MAX_GAME_FILE_BYTES:</span>{" "}
              {MAX_GAME_FILE_BYTES.toLocaleString()} ({formatBytes(MAX_GAME_FILE_BYTES)})
            </div>
            <div>
              <span className="text-foreground/70">bucketLimitBytes:</span>{" "}
              {bucketLimitBytes == null
                ? "null"
                : `${bucketLimitBytes.toLocaleString()} (${formatBytes(bucketLimitBytes)})`}
            </div>
            <div>
              <span className="text-foreground/70">effectiveMaxBytes:</span>{" "}
              {effectiveMaxBytes().toLocaleString()} ({formatBytes(effectiveMaxBytes())})
            </div>
            <div>
              <span className="text-foreground/70">constrainedByBucket:</span>{" "}
              {String(
                bucketLimitBytes != null && bucketLimitBytes < MAX_GAME_FILE_BYTES,
              )}
            </div>
            <div>
              <span className="text-foreground/70">lastFetchAt:</span>{" "}
              {lastLimitFetchAt ? new Date(lastLimitFetchAt).toLocaleTimeString() : "—"}
            </div>
            <div>
              <span className="text-foreground/70">lastFetchError:</span>{" "}
              <span className={lastLimitFetchError ? "text-destructive" : ""}>
                {lastLimitFetchError ?? "none"}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground/70">
            ក៏ logged ទៅ console ផងដែរ (key: <code>[admin/upload-limits]</code>)
          </div>
        </div>
      )}

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
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
            >
              ×
            </button>
          )}
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-full bg-input px-3 py-2 text-xs ring-1 ring-border focus:ring-primary outline-none"
        >
          <option value="all">គ្រប់ប្រភេទ</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-full bg-muted/30 p-1 text-[11px] font-semibold">
          {(["all", "visible", "hidden"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisFilter(v)}
              className={`px-3 py-1 rounded-full ${visFilter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v === "all" ? "ទាំងអស់" : v === "visible" ? "បង្ហាញ" : "លាក់"}
            </button>
          ))}
        </div>
        {(query || catFilter !== "all" || visFilter !== "all") && (
          <button
            onClick={() => {
              setQuery("");
              setCatFilter("all");
              setVisFilter("all");
            }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            សម្អាត
          </button>
        )}
        <button
          onClick={() => toggleSort("created_at")}
          className={`text-[11px] px-3 py-1.5 rounded-full ring-1 ring-border ${sortKey === "created_at" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          ថ្មីៗ{sortIcon("created_at")}
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl glass p-5 space-y-3 animate-scale-in origin-top">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">បន្ថែមហ្គេមថ្មី</h3>
            <span className="text-[10px] text-muted-foreground">
              អតិបរមាឯកសារ:{" "}
              <span className="font-semibold text-foreground">{formatBytes(effectiveMaxBytes())}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              label="លេខសម្គាល់ (slug)"
              value={draft.id}
              onChange={(v) => setDraft({ ...draft, id: v })}
            />
            <Field
              label="ចំណងជើង"
              value={draft.title}
              onChange={(v) => setDraft({ ...draft, title: v })}
            />
            <Field
              label="ប្រភេទ"
              value={draft.category}
              onChange={(v) => setDraft({ ...draft, category: v })}
            />
            <Field
              label="ស្លាក"
              value={draft.badge ?? ""}
              onChange={(v) => setDraft({ ...draft, badge: v })}
            />
            <Field
              label="ការពិពណ៌នា"
              value={draft.description ?? ""}
              onChange={(v) => setDraft({ ...draft, description: v })}
            />
            <Field
              label="តម្លៃ (Balance)"
              type="number"
              value={draft.price_coins ? String(draft.price_coins) : ""}
              placeholder="ឧ. 1500"
              onChange={(v) => setDraft({ ...draft, price_coins: Number(v) || 0 })}
            />
            <div className="block">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                URL រូបភាព (cover)
              </span>
              <div className="flex items-center gap-2">
                <input
                  value={draft.image_url ?? ""}
                  placeholder="https://… ឬ ផ្ទុករូបឡើង"
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  className="flex-1 rounded-lg bg-input px-3 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary"
                />
                <label className="shrink-0 cursor-pointer rounded-full bg-primary/10 text-primary px-3 py-2 text-[11px] font-semibold hover:bg-primary/20">
                  ផ្ទុករូប
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadCoverImage(f);
                      if (url) setDraft({ ...draft, image_url: url });
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {draft.image_url && (
                <img
                  src={draft.image_url}
                  alt="cover"
                  className="mt-2 h-20 rounded-lg object-cover ring-1 ring-border"
                />
              )}
            </div>

            {/* Screenshots gallery (multi-image) */}
            <div className="block md:col-span-2">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Screenshots (gallery)
              </span>
              <div className="flex flex-wrap items-start gap-2">
                {draft.screenshots.map((url, i) => (
                  <div key={url + i} className="relative group">
                    <img
                      src={url}
                      alt={`shot-${i}`}
                      className="h-20 w-32 rounded-lg object-cover ring-1 ring-border"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          screenshots: draft.screenshots.filter((_, j) => j !== i),
                        })
                      }
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] grid place-items-center opacity-0 group-hover:opacity-100 transition"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="h-20 w-32 cursor-pointer rounded-lg border-2 border-dashed border-border grid place-items-center text-[10px] text-muted-foreground hover:border-primary hover:text-primary">
                  + បន្ថែម
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      const uploaded: string[] = [];
                      for (const f of files) {
                        const u = await uploadScreenshot(f);
                        if (u) uploaded.push(u);
                      }
                      if (uploaded.length) {
                        setDraft((d) => ({
                          ...d,
                          screenshots: [...d.screenshots, ...uploaded],
                        }));
                      }
                    }}
                  />
                </label>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                អាចជ្រើសរើសច្រើនដង · max 10MB / រូប
              </p>
            </div>

            {/* Preview video (short trailer) */}
            <div className="block md:col-span-2">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Preview video (trailer ~50MB)
              </span>
              <div className="flex items-center gap-2">
                <input
                  value={draft.preview_video_url ?? ""}
                  placeholder="https://… ឬ ផ្ទុកវីដេអូឡើង"
                  onChange={(e) =>
                    setDraft({ ...draft, preview_video_url: e.target.value || null })
                  }
                  className="flex-1 rounded-lg bg-input px-3 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary"
                />
                <label className="shrink-0 cursor-pointer rounded-full bg-primary/10 text-primary px-3 py-2 text-[11px] font-semibold hover:bg-primary/20">
                  ផ្ទុកវីដេអូ
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadPreviewVideo(f);
                      if (url) setDraft({ ...draft, preview_video_url: url });
                      e.target.value = "";
                    }}
                  />
                </label>
                {draft.preview_video_url && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, preview_video_url: null })}
                    className="rounded-full bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              {draft.preview_video_url && (
                <video
                  src={draft.preview_video_url}
                  controls
                  className="mt-2 h-40 rounded-lg ring-1 ring-border"
                />
              )}
            </div>

            <div className="block">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                ប្រភពឯកសារហ្គេម
              </span>
              <div className="inline-flex rounded-full bg-muted/30 p-1 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode("file");
                    setDraft({ ...draft, file_path: null });
                    setDraftUrlError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${sourceMode === "file" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  <HardDrive className="h-3 w-3" /> Supabase
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode("library");
                    setDraftFile(null);
                    setDraftFileError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${sourceMode === "library" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  <LinkIcon className="h-3 w-3" /> External URL
                </button>
              </div>

              {sourceMode === "file" ? (
                <div className="animate-fade-in">
                  <input
                    type="file"
                    accept=".zip,.rar,.7z,.tar,.gz,.tgz"
                    title={
                      bucketLimitBytes && bucketLimitBytes < MAX_GAME_FILE_BYTES
                        ? `អតិបរមា ${formatBytes(effectiveMaxBytes())} — កំណត់ដោយ bucket "game-files" (ដែនកំណត់ម៉ាស៊ីន ${formatBytes(MAX_GAME_FILE_BYTES)})`
                        : `អតិបរមា ${formatBytes(effectiveMaxBytes())} — ដែនកំណត់ម៉ាស៊ីន`
                    }
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      const err = f ? validateFile(f) : null;
                      setDraftFileError(err);
                      setDraftFile(f);
                    }}
                    className="w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    អនុញ្ញាត zip, rar, 7z, tar, gz · ទំហំ 1MB ដល់{" "}
                    <span className="font-semibold text-foreground">{formatBytes(effectiveMaxBytes())}</span>
                    {bucketLimitBytes && bucketLimitBytes < MAX_GAME_FILE_BYTES ? (
                      <span className="text-muted-foreground/70"> (ដែនកំណត់ bucket បច្ចុប្បន្ន)</span>
                    ) : null}
                  </p>
                  {draftFile && (
                    <div className="mt-2 space-y-1">
                      <span className="text-[11px] text-foreground/90 block">
                        <span className="font-semibold">{draftFile.name}</span>
                        {" · "}
                        {(draftFile.size / 1024 / 1024).toFixed(2)} MiB
                      </span>
                    </div>
                  )}
                  {draftFile && !draftFileError && (() => {
                    const max = effectiveMaxBytes();
                    const pct = Math.min(100, (draftFile.size / max) * 100);
                    const tone =
                      pct >= 90
                        ? "bg-destructive"
                        : pct >= 70
                          ? "bg-amber-400"
                          : "bg-emerald-400";
                    const textTone =
                      pct >= 90
                        ? "text-destructive"
                        : pct >= 70
                          ? "text-amber-400"
                          : "text-emerald-400";
                    return (
                      <div className="mt-1 space-y-1">
                        <div
                          className="h-1 w-full overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="ទំហំឯកសារធៀបនឹងដែនកំណត់"
                        >
                          <div
                            className={`h-full ${tone} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-[10px] ${textTone} block`}>
                          {pct.toFixed(1)}% នៃ {formatBytes(max)}
                        </span>
                      </div>
                    );
                  })()}
                  {draftFile && draftFileError && (
                    <div
                      className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-destructive"
                      role="alert"
                      aria-live="polite"
                    >
                      <div className="flex items-start gap-1.5">
                        <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div className="space-y-1 min-w-0">
                          <div className="text-[11px] font-semibold">
                            ឯកសារមិនត្រឹមត្រូវ
                          </div>
                          <div className="text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                            {draftFileError}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {uploadStage !== "idle" && (
                    <div
                      className={`mt-2 space-y-1 rounded-lg border p-2 ${
                        uploadStage === "error"
                          ? "border-destructive/40 bg-destructive/5"
                          : uploadStage === "done"
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-border bg-muted/30"
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        {uploadStage === "preparing" && (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Preparing…
                          </>
                        )}
                        {uploadStage === "uploading" && (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                          </>
                        )}
                        {uploadStage === "processing" && (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Processing…
                          </>
                        )}
                        {uploadStage === "done" && (
                          <span className="text-emerald-500 inline-flex items-center gap-1.5">
                            <Check className="h-3 w-3" /> Done
                          </span>
                        )}
                        {uploadStage === "error" && (
                          <span className="text-destructive inline-flex items-center gap-1.5">
                            <X className="h-3 w-3" /> Error
                          </span>
                        )}
                      </div>

                      {(uploadStage === "uploading" || uploadStage === "paused" || uploadStage === "processing" || uploadStage === "done") &&
                        uploadPct !== null && (
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full transition-all ${uploadStage === "done" ? "bg-emerald-500" : uploadStage === "paused" ? "bg-amber-500" : "bg-primary"}`}
                              style={{ width: `${uploadPct}%` }}
                            />
                          </div>
                        )}

                      {(uploadStage === "uploading" || uploadStage === "paused") && uploadStats && (
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>
                            {uploadPct ?? 0}% ·{" "}
                            {(uploadStats.sent / 1024 / 1024).toFixed(1)}/
                            {(uploadStats.total / 1024 / 1024).toFixed(1)} MB
                            {uploadStats.speedBps > 0 && (
                              <> · {(uploadStats.speedBps / 1024 / 1024).toFixed(2)} MB/s</>
                            )}
                            {uploadStats.etaSec > 0 && uploadStats.etaSec < 86400 && (
                              <>
                                {" · ETA "}
                                {uploadStats.etaSec >= 60
                                  ? `${Math.round(uploadStats.etaSec / 60)}m`
                                  : `${Math.round(uploadStats.etaSec)}s`}
                              </>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {uploadStage === "uploading" && (
                              <button
                                type="button"
                                onClick={pauseUpload}
                                className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 hover:bg-amber-500/25"
                                title="ផ្អាកបណ្តោះអាសន្ន — អាចបន្តពីចំណុចបច្ចុប្បន្ន"
                              >
                                ផ្អាក
                              </button>
                            )}
                            {uploadStage === "paused" && (
                              <button
                                type="button"
                                onClick={resumeUpload}
                                className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-500/25"
                                title="បន្តពីចំណុចបច្ចុប្បន្ន"
                              >
                                បន្ត
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={cancelUpload}
                              className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive hover:bg-destructive/25"
                            >
                              បោះបង់
                            </button>
                          </div>
                        </div>
                      )}

                      {uploadStage === "processing" && (
                        <p className="text-[10px] text-muted-foreground">
                          កំពុងរក្សាទុកព័ត៌មានហ្គេមទៅមូលដ្ឋានទិន្នន័យ…
                        </p>
                      )}

                      {uploadStage === "done" && uploadedInfo && (
                        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                              ឯកសារបានរក្សាទុក
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const payload = {
                                    path: uploadedInfo.path,
                                    size: uploadedInfo.size,
                                    mime: uploadedInfo.mime,
                                    provider: uploadedInfo.provider,
                                    bucket: uploadedInfo.bucket ?? null,
                                    uploaded_at: uploadedInfo.uploadedAt ?? null,
                                    processed_at: uploadedInfo.processedAt ?? null,
                                    checksum: uploadedInfo.checksum ?? null,
                                    checksum_algo: uploadedInfo.checksumAlgo ?? null,
                                    checksum_skipped_reason: uploadedInfo.checksumSkippedReason ?? null,
                                  };
                                  navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
                                  showToast("បានចម្លង JSON");
                                }}
                                className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold hover:bg-muted/70"
                              >
                                Copy JSON
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const payload = {
                                    path: uploadedInfo.path,
                                    size: uploadedInfo.size,
                                    mime: uploadedInfo.mime,
                                    provider: uploadedInfo.provider,
                                    bucket: uploadedInfo.bucket ?? null,
                                    uploaded_at: uploadedInfo.uploadedAt ?? null,
                                    processed_at: uploadedInfo.processedAt ?? null,
                                    checksum: uploadedInfo.checksum ?? null,
                                    checksum_algo: uploadedInfo.checksumAlgo ?? null,
                                    checksum_skipped_reason: uploadedInfo.checksumSkippedReason ?? null,
                                  };
                                  const blob = new Blob([JSON.stringify(payload, null, 2)], {
                                    type: "application/json",
                                  });
                                  const url = URL.createObjectURL(blob);
                                  const safe = (uploadedInfo.path.split("/").pop() || "metadata").replace(
                                    /[^a-zA-Z0-9._-]/g,
                                    "_",
                                  );
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `${safe}.metadata.json`;
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                                }}
                                className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700"
                              >
                                Export JSON
                              </button>
                            </div>
                          </div>
                          <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-[11px]">
                            <dt className="text-muted-foreground">Provider</dt>
                            <dd className="font-mono">{uploadedInfo.provider}{uploadedInfo.bucket ? ` · ${uploadedInfo.bucket}` : ""}</dd>
                            <dt className="text-muted-foreground">Path</dt>
                            <dd className="flex items-center gap-1.5 min-w-0">
                              <code className="truncate font-mono text-[10.5px]" title={uploadedInfo.path}>{uploadedInfo.path}</code>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(uploadedInfo.path);
                                  showToast("បានចម្លងតំណ");
                                }}
                                className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold hover:bg-muted/70"
                              >
                                Copy
                              </button>
                            </dd>
                            {uploadedInfo.size > 0 && (
                              <>
                                <dt className="text-muted-foreground">Size</dt>
                                <dd className="font-mono">
                                  {(uploadedInfo.size / 1024 / 1024).toFixed(2)} MB
                                  <span className="text-muted-foreground"> ({uploadedInfo.size.toLocaleString()} B)</span>
                                </dd>
                              </>
                            )}
                            <dt className="text-muted-foreground">MIME</dt>
                            <dd className="font-mono">{uploadedInfo.mime}</dd>
                            {uploadedInfo.uploadedAt && (
                              <>
                                <dt className="text-muted-foreground">Uploaded</dt>
                                <dd className="font-mono text-[10.5px]" title={uploadedInfo.uploadedAt}>
                                  {new Date(uploadedInfo.uploadedAt).toLocaleString()}
                                </dd>
                              </>
                            )}
                            {uploadedInfo.processedAt && (
                              <>
                                <dt className="text-muted-foreground">Processed</dt>
                                <dd className="font-mono text-[10.5px]" title={uploadedInfo.processedAt}>
                                  {new Date(uploadedInfo.processedAt).toLocaleString()}
                                </dd>
                              </>
                            )}
                            {(uploadedInfo.checksum || uploadedInfo.checksumSkippedReason) && (
                              <>
                                <dt className="text-muted-foreground">
                                  {uploadedInfo.checksumAlgo ?? "Checksum"}
                                </dt>
                                <dd className="min-w-0">
                                  {uploadedInfo.checksum ? (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <code
                                        className="truncate font-mono text-[10.5px]"
                                        title={uploadedInfo.checksum}
                                      >
                                        {uploadedInfo.checksum}
                                      </code>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(uploadedInfo.checksum!);
                                          showToast("បានចម្លង checksum");
                                        }}
                                        className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold hover:bg-muted/70"
                                      >
                                        Copy
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10.5px] text-muted-foreground italic">
                                      មិនបានគណនា ({uploadedInfo.checksumSkippedReason})
                                    </span>
                                  )}
                                </dd>
                              </>
                            )}
                          </dl>
                          {(() => {
            const supportsSigned = uploadedInfo.provider === "supabase";
                            const isDone = uploadStage === "done";
                            const canGenerate = isDone && supportsSigned;
                            const hasSigned = !!signedUrl;
                            const copyDownloadDisabled = !canGenerate || !hasSigned;
                            const disabledReason = !isDone
                              ? "រង់ចាំឯកសារដំណើរការរួច (status = done)"
                              : !supportsSigned
                              ? "Provider នេះមិនមាន Signed URL (external_url)"
                              : !hasSigned
                              ? "សូមបង្កើត Signed URL ជាមុនសិន"
                              : "";
                            return (
                              <div className="pt-1 space-y-1.5 border-t border-emerald-500/20">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={signing || !canGenerate}
                                    title={
                                      canGenerate
                                        ? "បង្កើត Signed URL រយៈពេល 15 នាទី"
                                        : disabledReason
                                    }
                                    onClick={async () => {
                                      setSigning(true);
                                      try {
                                        const EXP = 60 * 15;
                                        const { data, error } = await supabase.storage
                                          .from(uploadedInfo.bucket ?? "game-files")
                                          .createSignedUrl(uploadedInfo.path, EXP, { download: true });
                                        if (error || !data?.signedUrl) {
                                          throw new Error(error?.message || "sign_failed");
                                        }
                                        const url = data.signedUrl;
                                        setSignedUrl({ url, expiresAt: Date.now() + EXP * 1000 });
                                        showToast("បានបង្កើត Signed URL (15 នាទី)");
                                      } catch (e) {
                                        showToast(e instanceof Error ? e.message : "sign_failed");
                                      } finally {
                                        setSigning(false);
                                      }
                                    }}
                                    className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {signing ? "កំពុងបង្កើត…" : hasSigned ? "បង្កើតថ្មី" : "បង្កើត Signed URL"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={copyDownloadDisabled}
                                    title={copyDownloadDisabled ? disabledReason : "ចម្លងតំណ Signed URL"}
                                    onClick={() => {
                                      if (!signedUrl) return;
                                      navigator.clipboard?.writeText(signedUrl.url);
                                      showToast("បានចម្លងតំណ");
                                    }}
                                    className="rounded bg-muted px-2 py-1 text-[10px] font-semibold hover:bg-muted/70 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Copy
                                  </button>
                                  {copyDownloadDisabled ? (
                                    <button
                                      type="button"
                                      disabled
                                      title={disabledReason}
                                      className="rounded bg-primary/60 px-2 py-1 text-[10px] font-semibold text-primary-foreground opacity-40 cursor-not-allowed"
                                    >
                                      Download
                                    </button>
                                  ) : (
                                    <a
                                      href={signedUrl!.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      title="ទាញយកឯកសារតាម Signed URL"
                                      className="rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                                    >
                                      Download
                                    </a>
                                  )}
                                  {hasSigned && (
                                    <span className="text-[10px] text-muted-foreground">
                                      ផុតកំណត់៖ {new Date(signedUrl!.expiresAt).toLocaleTimeString()}
                                    </span>
                                  )}
                                  {!supportsSigned && (
                                    <span className="text-[10px] italic text-muted-foreground">
                                      (external_url — គ្មាន Signed URL)
                                    </span>
                                  )}
                                </div>
                                {hasSigned && (
                                  <code
                                    className="block truncate rounded bg-muted/40 px-1.5 py-1 font-mono text-[10px]"
                                    title={signedUrl!.url}
                                  >
                                    {signedUrl!.url}
                                  </code>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {uploadStage === "error" && uploadError && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-destructive">{uploadError}</p>
                          {isPlatformCapError(uploadError) && (
                            <button
                              type="button"
                              onClick={() => setSplitGuideOpen(true)}
                              className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive hover:bg-destructive/25"
                            >
                              មើលវិធីបំបែកឯកសារ →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="animate-fade-in">
                  <input
                    type="url"
                    placeholder="https://… link to zip/installer"
                    value={draft.file_path ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft({ ...draft, file_path: v || null });
                      setDraftUrlError(v.trim() ? validateGameFileUrl(v) : null);
                    }}
                    className="w-full rounded-lg bg-muted/40 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    បិទភ្ជាប់តំណផ្ទាល់ទៅឯកសារ .zip/.rar/.7z/.tar/.gz
                  </p>
                  {draftUrlError && (
                    <span className="text-[10px] text-destructive mt-1 block">{draftUrlError}</span>
                  )}
                  {draft.file_path && !draftUrlError && (
                    <span className="text-[10px] text-emerald-400 mt-1 block">
                      តំណបានកំណត់ — នឹងរក្សាទុកជា file_path
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.visible}
              onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
            />{" "}
            បង្ហាញលើ website
          </label>
          <div className="flex gap-2">
            <button
              disabled={
                busy ||
                !!draftFileError ||
                !!draftUrlError ||
                (sourceMode === "library" && !(draft.file_path ?? "").trim())
              }
              onClick={createGame}
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "កំពុងផ្ទុកឡើង…" : "រក្សាទុក"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded-full border border-border px-4 py-2 text-xs"
            >
              បោះបង់
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">លេខ</th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort("title")}
                    className="uppercase tracking-wider hover:text-foreground"
                  >
                    ចំណងជើង{sortIcon("title")}
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort("category")}
                    className="uppercase tracking-wider hover:text-foreground"
                  >
                    ប្រភេទ{sortIcon("category")}
                  </button>
                </th>
                <th className="text-right px-4 py-3">
                  <button
                    onClick={() => toggleSort("price_coins")}
                    className="uppercase tracking-wider hover:text-foreground"
                  >
                    តម្លៃ{sortIcon("price_coins")}
                  </button>
                </th>
                <th className="text-center px-4 py-3">ឯកសារ</th>
                <th className="text-center px-4 py-3">បង្ហាញ</th>
                <th className="text-right px-4 py-3">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <GameRowEditor
                  key={g.id}
                  game={g}
                  busy={busy}
                  onSave={(p) => updateGame(g.id, p)}
                  onDelete={() => deleteGame(g)}
                  onReplaceFile={(f) => replaceFile(g, f)}
                  validateFile={validateFile}
                  onValidationError={showToast}
                  onUploadCover={uploadCoverImage}
                  maxUploadLabel={formatBytes(effectiveMaxBytes())}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    {games.length === 0 ? "គ្មានហ្គេម។" : "រកមិនឃើញ។"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground text-background px-4 py-2 text-xs shadow-lg">
          {toast}
        </div>
      )}

      <SplitFileGuideDialog
        open={splitGuideOpen}
        onClose={() => setSplitGuideOpen(false)}
        fileSize={draftFile?.size ?? null}
        onSwitchToLibrary={() => {
          setSourceMode("library");
          setSplitGuideOpen(false);
        }}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-input px-3 py-2 text-xs outline-none ring-1 ring-border focus:ring-primary"
      />
    </label>
  );
}

function GameRowEditor({
  game,
  busy,
  onSave,
  onDelete,
  onReplaceFile,
  validateFile,
  onValidationError,
  onUploadCover,
  maxUploadLabel,
}: {
  game: GameRow;
  busy: boolean;
  onSave: (p: Partial<GameRow>) => void;
  onDelete: () => void;
  onReplaceFile: (f: File) => void;
  validateFile: (f: File) => string | null;
  onValidationError: (m: string) => void;
  onUploadCover: (f: File) => Promise<string | null>;
  maxUploadLabel: string;
}) {
  const [edit, setEdit] = useState<GameRow>(game);
  const [fullOpen, setFullOpen] = useState(false);
  useEffect(() => setEdit(game), [game]);
  const dirty =
    edit.title !== game.title ||
    edit.category !== game.category ||
    edit.badge !== game.badge ||
    edit.price_coins !== game.price_coins ||
    edit.image_url !== game.image_url;

  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{game.id}</td>
      <td className="px-4 py-3">
        <input
          value={edit.title}
          onChange={(e) => setEdit({ ...edit, title: e.target.value })}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
        <div className="flex items-center gap-1 mt-0.5">
          <input
            value={edit.image_url ?? ""}
            placeholder="URL រូបភាព"
            onChange={(e) => setEdit({ ...edit, image_url: e.target.value })}
            className="flex-1 text-[10px] text-muted-foreground bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
          />
          <label
            className="text-[10px] text-primary cursor-pointer hover:underline shrink-0"
            title="ផ្ទុករូបឡើង"
          >
            📷
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await onUploadCover(f);
                if (url) setEdit((p) => ({ ...p, image_url: url }));
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          value={edit.category}
          onChange={(e) => setEdit({ ...edit, category: e.target.value })}
          className="w-24 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <input
          type="number"
          value={edit.price_coins}
          onChange={(e) => setEdit({ ...edit, price_coins: Number(e.target.value) || 0 })}
          className="w-20 text-right bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
      </td>
      <td className="px-4 py-3 text-center">
        {game.file_path ? (
          <div className="flex flex-col items-center gap-0.5">
            <span
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400"
              title={game.file_path}
            >
              <FileArchive className="h-3 w-3" />{" "}
              {game.file_size_bytes
                ? game.file_size_bytes >= 1024 ** 3
                  ? `${(game.file_size_bytes / 1024 ** 3).toFixed(2)}GB`
                  : `${(game.file_size_bytes / 1024 / 1024).toFixed(1)}MB`
                : "ok"}
            </span>
            {/^https?:\/\//i.test(game.file_path) ? (
              <a
                href={game.file_path}
                target="_blank"
                rel="noopener noreferrer"
                title={game.file_path}
                className="block max-w-[180px] truncate text-[10px] text-primary hover:underline"
              >
                {game.file_path}
              </a>
            ) : (
              <button
                type="button"
                title={`ចម្លង path: ${game.file_path}`}
                onClick={() => {
                  navigator.clipboard?.writeText(game.file_path ?? "");
                }}
                className="block max-w-[180px] truncate text-[10px] font-mono text-muted-foreground hover:text-primary hover:underline"
              >
                {game.file_path}
              </button>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
        <div className="flex items-center justify-center gap-2 mt-1">
          {game.file_path && (
            <button
              type="button"
              onClick={async () => {
                const { resolveDownloadUrl } = await import("@/lib/download-game-file");
                const result = await resolveDownloadUrl(
                  game.file_path,
                  (path, exp, opts) =>
                    supabase.storage.from("game-files").createSignedUrl(path, exp, opts),
                  { forceDownload: true },
                );
                if (!result.ok) {
                  onValidationError(result.error);
                  return;
                }
                window.open(result.url, "_blank", "noopener,noreferrer");
              }}
              className="text-[10px] text-emerald-400 hover:underline"
            >
              ទាញយក
            </button>
          )}
          <label title={`ផ្ទុកឯកសារ zip/rar/7z/tar/gz · អតិបរមា ${maxUploadLabel}`}>
            <span className="text-[10px] text-primary cursor-pointer hover:underline">
              {game.file_path ? "ប្តូរ" : "ផ្ទុកឡើង"}
            </span>
            <input
              type="file"
              accept=".zip,.rar,.7z,.tar,.gz,.tgz"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const err = validateFile(f);
                if (err) {
                  onValidationError(err);
                  e.target.value = "";
                  return;
                }
                onReplaceFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          disabled={busy}
          onClick={() => onSave({ visible: !game.visible })}
          className="rounded-full p-1.5 hover:bg-accent"
          title={game.visible ? "លាក់" : "បង្ហាញ"}
        >
          {game.visible ? (
            <Eye className="h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button
            disabled={busy}
            onClick={() => setFullOpen(true)}
            title="កែប្រែពេញលេញ"
            className="rounded-full bg-accent/30 text-foreground px-2 py-1 text-[11px] font-semibold hover:bg-accent disabled:opacity-30"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            disabled={!dirty || busy}
            onClick={() =>
              onSave({
                title: edit.title,
                category: edit.category,
                badge: edit.badge || null,
                price_coins: edit.price_coins,
                image_url: edit.image_url || null,
              })
            }
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold disabled:opacity-30"
          >
            <Save className="h-3 w-3" /> រក្សាទុក
          </button>
          <button
            disabled={busy}
            onClick={onDelete}
            className="rounded-full bg-destructive/10 text-destructive px-2 py-1 text-[11px] font-semibold"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
      <GameEditFullDialog
        open={fullOpen}
        onOpenChange={setFullOpen}
        game={game}
        busy={busy}
        onSave={onSave}
        onUploadCover={onUploadCover}
      />
    </tr>
  );
}

function GameEditFullDialog({
  open,
  onOpenChange,
  game,
  busy,
  onSave,
  onUploadCover,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  game: GameRow;
  busy: boolean;
  onSave: (p: Partial<GameRow>) => void;
  onUploadCover: (f: File) => Promise<string | null>;
}) {
  const [f, setF] = useState<GameRow>(game);
  useEffect(() => {
    if (open) setF(game);
  }, [open, game]);

  const setField = <K extends keyof GameRow>(k: K, v: GameRow[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    onSave({
      title: f.title.trim() || game.title,
      category: f.category.trim() || game.category,
      badge: f.badge?.trim() ? f.badge.trim() : null,
      description: f.description?.trim() ? f.description.trim() : null,
      price_coins: Math.max(0, Number(f.price_coins) || 0),
      image_url: f.image_url?.trim() ? f.image_url.trim() : null,
      preview_video_url: f.preview_video_url?.trim() ? f.preview_video_url.trim() : null,
      screenshots: (f.screenshots ?? []).map((s) => s.trim()).filter(Boolean),
      visible: f.visible,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> កែប្រែហ្គេម
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">{game.id}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-muted-foreground">ចំណងជើង</span>
            <input
              value={f.title}
              onChange={(e) => setField("title", e.target.value)}
              className="w-full rounded-lg bg-input px-3 py-2 outline-none ring-1 ring-border focus:ring-primary"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-muted-foreground">ប្រភេទ</span>
              <input
                value={f.category}
                onChange={(e) => setField("category", e.target.value)}
                className="w-full rounded-lg bg-input px-3 py-2 outline-none ring-1 ring-border focus:ring-primary"
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">តម្លៃ (coins)</span>
              <input
                type="number"
                min={0}
                value={f.price_coins}
                onChange={(e) => setField("price_coins", Number(e.target.value) || 0)}
                className="w-full rounded-lg bg-input px-3 py-2 outline-none ring-1 ring-border focus:ring-primary"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-muted-foreground">Badge (ស្លាក)</span>
            <input
              value={f.badge ?? ""}
              placeholder="ឧ. NEW, HOT"
              onChange={(e) => setField("badge", e.target.value)}
              className="w-full rounded-lg bg-input px-3 py-2 outline-none ring-1 ring-border focus:ring-primary"
            />
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground">ការពិពណ៌នា</span>
            <textarea
              value={f.description ?? ""}
              rows={4}
              onChange={(e) => setField("description", e.target.value)}
              className="w-full rounded-lg bg-input px-3 py-2 outline-none ring-1 ring-border focus:ring-primary resize-y"
            />
          </label>

          <div className="space-y-1">
            <span className="text-muted-foreground">URL រូបភាពគម្រប</span>
            <div className="flex items-center gap-2">
              <input
                value={f.image_url ?? ""}
                onChange={(e) => setField("image_url", e.target.value)}
                className="flex-1 rounded-lg bg-input px-3 py-2 outline-none ring-1 ring-border focus:ring-primary"
              />
              <label className="shrink-0 cursor-pointer rounded-lg bg-primary/10 text-primary px-3 py-2 text-[11px] font-semibold hover:bg-primary/20">
                📷 ផ្ទុក
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await onUploadCover(file);
                    if (url) setField("image_url", url);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {f.image_url && (
              <img
                src={f.image_url}
                alt=""
                className="mt-2 h-24 w-auto rounded-lg ring-1 ring-border object-cover"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
              />
            )}
          </div>

          <label className="space-y-1">
            <span className="text-muted-foreground">URL វីដេអូ preview</span>
            <input
              value={f.preview_video_url ?? ""}
              placeholder="https://..."
              onChange={(e) => setField("preview_video_url", e.target.value)}
              className="w-full rounded-lg bg-input px-3 py-2 outline-none ring-1 ring-border focus:ring-primary"
            />
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Screenshots (URLs)</span>
              <button
                type="button"
                onClick={() => setField("screenshots", [...(f.screenshots ?? []), ""])}
                className="text-[11px] text-primary hover:underline"
              >
                + បន្ថែម
              </button>
            </div>
            <div className="space-y-1.5">
              {(f.screenshots ?? []).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={s}
                    onChange={(e) => {
                      const arr = [...(f.screenshots ?? [])];
                      arr[i] = e.target.value;
                      setField("screenshots", arr);
                    }}
                    placeholder={`screenshot ${i + 1}`}
                    className="flex-1 rounded-lg bg-input px-3 py-2 outline-none ring-1 ring-border focus:ring-primary"
                  />
                  <label className="shrink-0 cursor-pointer rounded-lg bg-accent/40 px-2 py-2 text-[11px] hover:bg-accent">
                    📷
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await onUploadCover(file);
                        if (url) {
                          const arr = [...(f.screenshots ?? [])];
                          arr[i] = url;
                          setField("screenshots", arr);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const arr = [...(f.screenshots ?? [])];
                      arr.splice(i, 1);
                      setField("screenshots", arr);
                    }}
                    className="shrink-0 rounded-lg bg-destructive/10 text-destructive px-2 py-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {(f.screenshots ?? []).length === 0 && (
                <p className="text-[11px] text-muted-foreground">គ្មាន screenshot</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={f.visible}
              onChange={(e) => setField("visible", e.target.checked)}
              className="h-4 w-4"
            />
            <span>បង្ហាញជាសាធារណៈ</span>
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-muted px-4 py-2 text-xs font-semibold hover:bg-muted/70"
          >
            បោះបង់
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> រក្សាទុក
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setMeId(user?.id ?? null);
      const [{ data: profiles }, { data: wallets }, { data: lib }, { data: roles }] =
        await Promise.all([
          supabase.from("profiles").select("user_id, display_name, created_at"),
          supabase.from("wallets").select("user_id, balance"),
          supabase.from("library").select("user_id, kind"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
      type WalletRow = { user_id: string; balance: number };
      type LibRow = { user_id: string; kind: string };
      type RoleRow = { user_id: string; role: string };
      type ProfileRow = { user_id: string; display_name: string; created_at: string };
      const wMap = new Map((wallets ?? []).map((w: WalletRow) => [w.user_id, w.balance]));
      const oMap = new Map<string, number>();
      (lib ?? []).forEach((l: LibRow) => {
        if (l.kind === "owned") oMap.set(l.user_id, (oMap.get(l.user_id) ?? 0) + 1);
      });
      const aSet = new Set(
        (roles ?? []).filter((r: RoleRow) => r.role === "admin").map((r: RoleRow) => r.user_id),
      );
      const merged: UserRow[] = (profiles ?? [])
        .map((p: ProfileRow) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          created_at: p.created_at,
          balance: wMap.get(p.user_id) ?? 0,
          owned: oMap.get(p.user_id) ?? 0,
          is_admin: aSet.has(p.user_id),
        }))
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    គ្មានអ្នកប្រើ។
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <UserRowEditor
                    key={u.user_id}
                    user={u}
                    isMe={meId === u.user_id}
                    onUpdate={(b) =>
                      setRows((rs) =>
                        rs.map((x) => (x.user_id === u.user_id ? { ...x, balance: b } : x)),
                      )
                    }
                    onRoleChange={(isAdmin) =>
                      setRows((rs) =>
                        rs.map((x) => (x.user_id === u.user_id ? { ...x, is_admin: isAdmin } : x)),
                      )
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserRowEditor({
  user,
  isMe,
  onUpdate,
  onRoleChange,
}: {
  user: UserRow;
  isMe: boolean;
  onUpdate: (b: number) => void;
  onRoleChange: (isAdmin: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(user.balance));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Array<{
    id: string;
    old_balance: number;
    new_balance: number;
    reason: string | null;
    created_at: string;
    changed_by_name: string;
  }> | null>(null);
  const [loadingHist, setLoadingHist] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const setBalance = useServerFn(adminSetUserBalance);
  const fetchHistory = useServerFn(listBalanceChanges);
  const setRole = useServerFn(adminSetUserRole);

  const toggleAdmin = async () => {
    const next = !user.is_admin;
    if (
      !confirm(
        next
          ? `ផ្តល់សិទ្ធិ Admin ដល់ ${user.display_name}?`
          : `ដកសិទ្ធិ Admin ពី ${user.display_name}?`,
      )
    )
      return;
    setRoleBusy(true);
    try {
      const r = await setRole({ data: { user_id: user.user_id, is_admin: next } });
      onRoleChange(r.is_admin);
    } catch (e) {
      alert(e instanceof Error ? e.message : "បរាជ័យ");
    } finally {
      setRoleBusy(false);
    }
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
    } catch (e) {
      alert(e instanceof Error ? e.message : "បរាជ័យ");
    } finally {
      setLoadingHist(false);
    }
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
      const r = await setBalance({
        data: {
          user_id: user.user_id,
          new_balance: parsedNextBalance,
          reason: reason.trim() || undefined,
        },
      });
      onUpdate(r.balance);
      setEditing(false);
      setConfirmOpen(false);
      setReason("");
      if (showHistory) await loadHistory();
      else setHistory(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "បរាជ័យ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr className="border-t border-border/60 hover:bg-muted/10">
        <td className="px-4 py-3 font-medium">{user.display_name}</td>
        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
          {user.user_id}
        </td>
        <td className="px-4 py-3 text-right font-semibold text-primary">
          {editing ? (
            <div className="inline-flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  className="w-24 text-right rounded bg-input px-2 py-1 text-xs ring-1 ring-border focus:ring-primary outline-none"
                />
                <button
                  disabled={busy || !isValidNextBalance}
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-full bg-primary/10 text-primary px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                >
                  រក្សាទុក
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setConfirmOpen(false);
                    setVal(String(user.balance));
                    setReason("");
                  }}
                  className="text-[11px] text-muted-foreground"
                >
                  ×
                </button>
              </span>
              <input
                type="text"
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="មូលហេតុ (សេចក្តីពន្យល់)"
                className="w-56 text-left rounded bg-input px-2 py-1 text-[11px] ring-1 ring-border focus:ring-primary outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setVal(String(user.balance));
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 hover:underline"
            >
              {user.balance.toLocaleString()} <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-right">{user.owned}</td>
        <td className="px-4 py-3 text-center">
          <div className="inline-flex flex-col items-center gap-1">
            {user.is_admin ? (
              <span className="inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold">
                អ្នកគ្រប់គ្រង
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">អ្នកប្រើ</span>
            )}
            {!isMe && (
              <button
                disabled={roleBusy}
                onClick={toggleAdmin}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold disabled:opacity-50 ${user.is_admin ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
              >
                {roleBusy ? "..." : user.is_admin ? "ដក Admin" : "ផ្តល់ Admin"}
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {new Date(user.created_at).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={toggleHistory}
            className="inline-flex items-center gap-1 rounded-full bg-muted/30 hover:bg-muted/50 px-2 py-1 text-[11px] font-semibold text-muted-foreground"
          >
            <History className="h-3 w-3" /> ប្រវត្តិ{" "}
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
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
              <span className="text-right font-medium">
                {isValidNextBalance ? parsedNextBalance.toLocaleString() : "—"}
              </span>
              <span className="text-muted-foreground">Delta</span>
              <span
                className={`text-right font-semibold ${delta > 0 ? "text-primary" : delta < 0 ? "text-destructive" : "text-foreground"}`}
              >
                {deltaLabel}
              </span>
              <span className="text-muted-foreground">មូលហេតុ</span>
              <span className="text-right break-words">{reason.trim() || "—"}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>បោះបង់</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !isValidNextBalance}
              onClick={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {busy ? "កំពុងអនុវត្ត..." : "បញ្ជាក់"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {showHistory && (
        <tr className="border-t border-border/40 bg-muted/5">
          <td colSpan={7} className="px-4 py-3">
            {loadingHist ? (
              <div className="text-center text-xs text-muted-foreground py-3">
                <Loader2 className="h-4 w-4 animate-spin inline" />
              </div>
            ) : !history || history.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-3">
                គ្មានប្រវត្តិការផ្លាស់ប្តូរ Balance។
              </div>
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
                          <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                            {new Date(h.created_at).toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5">{h.changed_by_name}</td>
                          <td className="px-2 py-1.5 text-right font-mono">
                            {h.old_balance.toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono font-semibold text-primary">
                            {h.new_balance.toLocaleString()}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right font-mono font-semibold ${diff > 0 ? "text-emerald-500" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toLocaleString()}
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
  coins_per_usd: number;
  tx_ttl_min: number;
  tus_max_net_retries: number;
  tus_retry_delays_ms: number[];
  tus_backoff_base_ms: number;
  tus_backoff_step_ms: number;
  tus_backoff_cap_ms: number;
};
function SettingsTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [delaysText, setDelaysText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const get = useServerFn(getAppSettings);
  const upd = useServerFn(updateAppSettings);

  useEffect(() => {
    (async () => {
      try {
        const r = (await get({})) as Record<string, unknown>;
        const delays = Array.isArray(r.tus_retry_delays_ms)
          ? (r.tus_retry_delays_ms as unknown[]).map((n) => Number(n))
          : [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 120000];
        const next: Settings = {
          coins_per_usd: Number(r.coins_per_usd) || 1,
          tx_ttl_min: Number(r.tx_ttl_min) || 5,
          tus_max_net_retries: Number(r.tus_max_net_retries) || 50,
          tus_retry_delays_ms: delays,
          tus_backoff_base_ms: Number(r.tus_backoff_base_ms) || 3000,
          tus_backoff_step_ms: Number(r.tus_backoff_step_ms) || 2000,
          tus_backoff_cap_ms: Number(r.tus_backoff_cap_ms) || 30000,
        };
        setS(next);
        setDelaysText(delays.join(", "));
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "បរាជ័យ");
      }
    })();
  }, [get]);

  const save = async () => {
    if (!s) return;
    setBusy(true);
    setMsg(null);
    try {
      const parsedDelays = delaysText
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => Number(t));
      if (!parsedDelays.length || parsedDelays.some((n) => !Number.isFinite(n) || n < 0 || n > 600_000)) {
        throw new Error("Retry delays ត្រូវតែជាលេខពី 0 ដល់ 600000 ms");
      }
      await upd({
        data: {
          coins_per_usd: Number(s.coins_per_usd) || 1,
          tx_ttl_min: Number(s.tx_ttl_min) || 5,
          tus_max_net_retries: Number(s.tus_max_net_retries) || 0,
          tus_retry_delays_ms: parsedDelays,
          tus_backoff_base_ms: Number(s.tus_backoff_base_ms) || 0,
          tus_backoff_step_ms: Number(s.tus_backoff_step_ms) || 0,
          tus_backoff_cap_ms: Number(s.tus_backoff_cap_ms) || 0,
        },
      });
      setMsg("រក្សាទុករួច");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "បរាជ័យ");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 2500);
    }
  };

  if (!s)
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline" />
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="font-display text-xl">ការកំណត់ប្រព័ន្ធ</h2>
      <div className="rounded-2xl glass p-5 space-y-4">
        <h3 className="font-semibold text-sm">អត្រាប្តូរ</h3>
        <div className="grid grid-cols-1 gap-3">
          <Field
            label="១ ដុល្លារ = ? សមតុល្យ"
            type="number"
            value={String(s.coins_per_usd)}
            onChange={(v) => setS({ ...s, coins_per_usd: Number(v) || 1 })}
          />
          <Field
            label="TTL (នាទី)"
            type="number"
            value={String(s.tx_ttl_min)}
            onChange={(v) => setS({ ...s, tx_ttl_min: Number(v) || 5 })}
          />
        </div>
      </div>

      <div className="rounded-2xl glass p-5 space-y-4">
        <h3 className="font-semibold text-sm">Upload Retry (TUS)</h3>
        <p className="text-xs text-muted-foreground">
          កំណត់ចំនួនព្យាយាមអតិបរមា និងកម្រិត backoff សម្រាប់ការ resume នៅពេលដាច់បណ្ដាញ។
          តម្លៃជាមីលីវិនាទី (ms)។
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Max network retries"
            type="number"
            value={String(s.tus_max_net_retries)}
            onChange={(v) => setS({ ...s, tus_max_net_retries: Math.max(0, Number(v) || 0) })}
          />
          <Field
            label="Backoff base (ms)"
            type="number"
            value={String(s.tus_backoff_base_ms)}
            onChange={(v) => setS({ ...s, tus_backoff_base_ms: Math.max(0, Number(v) || 0) })}
          />
          <Field
            label="Backoff step (ms)"
            type="number"
            value={String(s.tus_backoff_step_ms)}
            onChange={(v) => setS({ ...s, tus_backoff_step_ms: Math.max(0, Number(v) || 0) })}
          />
          <Field
            label="Backoff cap (ms)"
            type="number"
            value={String(s.tus_backoff_cap_ms)}
            onChange={(v) => setS({ ...s, tus_backoff_cap_ms: Math.max(0, Number(v) || 0) })}
          />
        </div>
        <Field
          label="TUS retryDelays (ms, បំបែកដោយ , )"
          type="text"
          value={delaysText}
          onChange={(v) => setDelaysText(v)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {busy ? "កំពុងរក្សាទុក…" : "រក្សាទុក"}
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
      <KhqrSettings />
      <SettingsAuditLog refreshKey={msg === "រក្សាទុករួច" ? 1 : 0} />
    </div>
  );
}

function KhqrSettings() {
  const get = useServerFn(getKhqrSettings);
  const save = useServerFn(setKhqrAccountId);
  const preview = useServerFn(previewKhqr);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [info, setInfo] = useState<{
    dbValue: string | null;
    envValue: string | null;
    effective: string;
    source: string;
    updatedAt: string | null;
  } | null>(null);
  const [previewPayload, setPreviewPayload] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const buildPreview = useCallback(
    async (accountId: string) => {
      setPreviewing(true);
      try {
        const r = await preview({ data: { accountId, amountUsd: 1 } });
        setPreviewPayload(r.payload);
      } catch (e) {
        setPreviewPayload(null);
        console.warn("[khqr preview]", e);
      } finally {
        setPreviewing(false);
      }
    },
    [preview],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await get({});
      setInfo(r);
      setDraft(r.dbValue ?? "");
      await buildPreview(r.effective);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "បរាជ័យ");
    } finally {
      setLoading(false);
    }
  }, [get, buildPreview]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await save({ data: { accountId: draft } });
      setMsg("រក្សាទុករួច");
      await buildPreview(r.effective);
      await refresh();
    } catch (e) {
      const m = e instanceof Error ? e.message : "បរាជ័យ";
      setErr(m === "invalid_account_id_format" ? "ទម្រង់មិនត្រឹមត្រូវ (រូបមន្ត: handle@bank)" : m);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 2500);
    }
  };

  const onClear = () => {
    setDraft("");
  };

  return (
    <div className="rounded-2xl glass p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-sm">KHQR — Bakong Account ID</h3>
        {info && (
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 ring-1 ${
              info.source === "database"
                ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                : info.source === "environment"
                  ? "bg-amber-500/10 text-amber-400 ring-amber-500/30"
                  : "bg-muted/40 text-muted-foreground ring-border"
            }`}
            title="ប្រភពនៃ account id បច្ចុប្បន្ន"
          >
            ប្រភព: {info.source}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Field
                label="Account ID (handle@bank)"
                value={draft}
                onChange={setDraft}
              />
              <p className="text-[10px] text-muted-foreground">
                ឧ. <code>ben_sothida@bkrt</code> · ទុកឱ្យទទេនឹងប្រើតម្លៃពី env ({info?.envValue ?? "—"})
              </p>

              <div className="text-[11px] space-y-1 rounded-lg bg-muted/30 p-2 font-mono">
                <div>
                  <span className="text-muted-foreground">DB:</span> {info?.dbValue ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">ENV:</span> {info?.envValue ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Effective:</span>{" "}
                  <span className="text-foreground font-semibold">{info?.effective}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={onSave}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" /> {busy ? "កំពុងរក្សាទុក…" : "រក្សាទុក"}
                </button>
                <button
                  type="button"
                  disabled={busy || !draft}
                  onClick={onClear}
                  className="rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  title="សម្អាត override · ត្រឡប់ទៅ env fallback"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={previewing}
                  onClick={() => buildPreview(draft.trim() || info?.effective || "")}
                  className="rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {previewing ? "កំពុង…" : "Preview"}
                </button>
                {msg && <span className="text-xs text-emerald-400">{msg}</span>}
                {err && <span className="text-xs text-destructive">{err}</span>}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40 p-3">
              <span className="text-[10px] text-muted-foreground">Live preview (USD 1.00)</span>
              {previewPayload ? (
                <div className="bg-white p-2 rounded">
                  <QRCode value={previewPayload} size={160} />
                </div>
              ) : (
                <div className="h-[160px] w-[160px] grid place-items-center text-[10px] text-muted-foreground">
                  no preview
                </div>
              )}
              {previewPayload && (
                <code className="text-[9px] text-muted-foreground/70 break-all max-w-full">
                  {previewPayload.slice(0, 32)}…
                </code>
              )}
            </div>
          </div>
          {info?.updatedAt && (
            <p className="text-[10px] text-muted-foreground">
              ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ: {new Date(info.updatedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SettingsAuditLog({ refreshKey }: { refreshKey: number }) {
  type AuditRow = {
    id: string;
    changed_by: string;
    field: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
    changed_by_name: string;
  };
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const list = useServerFn(listSettingsAudit);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await list({});
        setRows(r as AuditRow[]);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [list, refreshKey]);

  return (
    <div className="rounded-2xl glass p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <History className="h-4 w-4" /> ប្រវត្តិការផ្លាស់ប្តូរ Settings
        </h3>
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
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                </td>
              </tr>
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                  គ្មានប្រវត្តិ។
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5">{r.changed_by_name}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{r.field}</td>
                  <td
                    className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground max-w-[180px] truncate"
                    title={r.old_value ?? ""}
                  >
                    {r.old_value ?? "—"}
                  </td>
                  <td
                    className="px-2 py-1.5 font-mono text-[10px] text-primary max-w-[180px] truncate"
                    title={r.new_value ?? ""}
                  >
                    {r.new_value ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============ CONTENT TAB ============ */
type Promo = {
  id: string;
  title: string;
  subtitle: string | null;
  visible: boolean;
  created_at: string;
};
type Testi = {
  id: string;
  name: string;
  game: string | null;
  text: string;
  visible: boolean;
  created_at: string;
};

function ContentTab() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [testis, setTestis] = useState<Testi[]>([]);
  const [loading, setLoading] = useState(true);
  const [pTitle, setPTitle] = useState("");
  const [pSub, setPSub] = useState("");
  const [tName, setTName] = useState("");
  const [tGame, setTGame] = useState("");
  const [tText, setTText] = useState("");

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
  useEffect(() => {
    load();
  }, [load]);

  const addPromo = async () => {
    if (!pTitle.trim()) return;
    const { error } = await supabase
      .from("promotions")
      .insert({ title: pTitle.trim(), subtitle: pSub.trim() || null, visible: true });
    if (error) return toast.error(error.message);
    setPTitle("");
    setPSub("");
    toast.success("បន្ថែមរួច");
    load();
  };
  const updPromo = async (id: string, patch: Partial<Promo>) => {
    const { error } = await supabase.from("promotions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setPromos((rs) => rs.map((r) => (r.id === id ? ({ ...r, ...patch } as Promo) : r)));
  };
  const delPromo = async (id: string) => {
    if (!confirm("លុបប្រូម៉ូសិន?")) return;
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPromos((rs) => rs.filter((r) => r.id !== id));
  };

  const addTesti = async () => {
    if (!tName.trim() || !tText.trim()) return;
    const { error } = await supabase.from("testimonials").insert({
      name: tName.trim(),
      game: tGame.trim() || null,
      text: tText.trim(),
      visible: true,
    });
    if (error) return toast.error(error.message);
    setTName("");
    setTGame("");
    setTText("");
    toast.success("បន្ថែមរួច");
    load();
  };
  const updTesti = async (id: string, patch: Partial<Testi>) => {
    const { error } = await supabase.from("testimonials").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setTestis((rs) => rs.map((r) => (r.id === id ? ({ ...r, ...patch } as Testi) : r)));
  };
  const delTesti = async (id: string) => {
    if (!confirm("លុបមតិ?")) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTestis((rs) => rs.filter((r) => r.id !== id));
  };

  if (loading)
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline" />
      </div>
    );

  return (
    <div className="space-y-8">
      {/* Promotions */}
      <section className="space-y-3">
        <h2 className="font-display text-xl">ប្រូម៉ូសិន ({promos.length})</h2>
        <div className="rounded-2xl glass p-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={pTitle}
            onChange={(e) => setPTitle(e.target.value)}
            placeholder="ចំណងជើង"
            className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none"
          />
          <input
            value={pSub}
            onChange={(e) => setPSub(e.target.value)}
            placeholder="សេចក្តីរង (ស្រេច)"
            className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none"
          />
          <button
            onClick={addPromo}
            className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> បន្ថែម
          </button>
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
              {promos.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                    គ្មានទិន្នន័យ
                  </td>
                </tr>
              )}
              {promos.map((p) => (
                <PromoRow
                  key={p.id}
                  p={p}
                  onUpd={(patch) => updPromo(p.id, patch)}
                  onDel={() => delPromo(p.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Testimonials */}
      <section className="space-y-3">
        <h2 className="font-display text-xl">មតិសហគមន៍ ({testis.length})</h2>
        <div className="rounded-2xl glass p-4 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <input
            value={tName}
            onChange={(e) => setTName(e.target.value)}
            placeholder="ឈ្មោះ"
            className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none"
          />
          <input
            value={tGame}
            onChange={(e) => setTGame(e.target.value)}
            placeholder="ហ្គេម (ស្រេច)"
            className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none"
          />
          <input
            value={tText}
            onChange={(e) => setTText(e.target.value)}
            placeholder="មតិ"
            className="rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none"
          />
          <button
            onClick={addTesti}
            className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> បន្ថែម
          </button>
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
              {testis.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                    គ្មានទិន្នន័យ
                  </td>
                </tr>
              )}
              {testis.map((t) => (
                <TestiRow
                  key={t.id}
                  t={t}
                  onUpd={(patch) => updTesti(t.id, patch)}
                  onDel={() => delTesti(t.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PromoRow({
  p,
  onUpd,
  onDel,
}: {
  p: Promo;
  onUpd: (patch: Partial<Promo>) => void;
  onDel: () => void;
}) {
  const [e, setE] = useState(p);
  useEffect(() => setE(p), [p]);
  const dirty = e.title !== p.title || e.subtitle !== p.subtitle;
  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-4 py-3">
        <input
          value={e.title}
          onChange={(ev) => setE({ ...e, title: ev.target.value })}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={e.subtitle ?? ""}
          onChange={(ev) => setE({ ...e, subtitle: ev.target.value })}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onUpd({ visible: !p.visible })}
          className="rounded-full p-1.5 hover:bg-accent"
        >
          {p.visible ? (
            <Eye className="h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button
            disabled={!dirty}
            onClick={() => onUpd({ title: e.title, subtitle: e.subtitle || null })}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold disabled:opacity-30"
          >
            <Save className="h-3 w-3" /> រក្សាទុក
          </button>
          <button
            onClick={onDel}
            className="rounded-full bg-destructive/10 text-destructive px-2 py-1 text-[11px] font-semibold"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TestiRow({
  t,
  onUpd,
  onDel,
}: {
  t: Testi;
  onUpd: (patch: Partial<Testi>) => void;
  onDel: () => void;
}) {
  const [e, setE] = useState(t);
  useEffect(() => setE(t), [t]);
  const dirty = e.name !== t.name || e.game !== t.game || e.text !== t.text;
  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-4 py-3">
        <input
          value={e.name}
          onChange={(ev) => setE({ ...e, name: ev.target.value })}
          className="w-32 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={e.game ?? ""}
          onChange={(ev) => setE({ ...e, game: ev.target.value })}
          className="w-32 bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={e.text}
          onChange={(ev) => setE({ ...e, text: ev.target.value })}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onUpd({ visible: !t.visible })}
          className="rounded-full p-1.5 hover:bg-accent"
        >
          {t.visible ? (
            <Eye className="h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button
            disabled={!dirty}
            onClick={() => onUpd({ name: e.name, game: e.game || null, text: e.text })}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold disabled:opacity-30"
          >
            <Save className="h-3 w-3" /> រក្សាទុក
          </button>
          <button
            onClick={onDel}
            className="rounded-full bg-destructive/10 text-destructive px-2 py-1 text-[11px] font-semibold"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ============ TOPUPS TAB ============ */
type TopupRow = {
  id: string;
  user_id: string;
  user_name: string;
  amount_usd: number;
  coins: number;
  status: "pending" | "approved" | "rejected";
  slip_path: string;
  slip_url: string | null;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reject_reason: string | null;
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
    } finally {
      setBusy(false);
    }
  }, [listFn, status]);

  useEffect(() => {
    load();
  }, [load]);

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
        toast.success(
          `✓ Approved · +${r.credited.toLocaleString()} coins · balance ${r.new_balance.toLocaleString()}`,
        );
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(null);
    }
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">សំណើបញ្ចូល Balance</h2>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-full bg-input px-3 py-1.5 text-xs ring-1 ring-border outline-none"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">ទាំងអស់</option>
          </select>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
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
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground text-xs">
                  គ្មានសំណើ
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="p-3">
                  <div className="font-medium">{r.user_name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {r.user_id.slice(0, 8)}
                  </div>
                </td>
                <td className="p-3 text-right font-mono">${Number(r.amount_usd).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{r.coins.toLocaleString()}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        r.status === "approved"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : r.status === "pending"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {r.status}
                    </span>
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
                    <button
                      onClick={() => setPreviewSlip(r.slip_url)}
                      className="text-xs text-primary hover:underline"
                    >
                      មើល
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td
                  className="p-3 text-xs text-muted-foreground max-w-[160px] truncate"
                  title={r.note ?? ""}
                >
                  {r.note ?? "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  {r.status === "pending" ? (
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => approve(r.id)}
                        disabled={acting === r.id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1 text-[11px] font-semibold disabled:opacity-50"
                      >
                        {acting === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}{" "}
                        Approve
                      </button>
                      <button
                        onClick={() => reject(r.id)}
                        disabled={acting === r.id}
                        className="inline-flex items-center gap-1 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 px-3 py-1 text-[11px] font-semibold disabled:opacity-50"
                      >
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span
                      className="text-[11px] text-muted-foreground"
                      title={r.reject_reason ?? ""}
                    >
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
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewSlip(null)}
        >
          <div className="relative">
            <button
              className="absolute -top-10 right-0 rounded-full bg-card p-2"
              onClick={() => setPreviewSlip(null)}
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewSlip}
              alt="slip"
              className="max-h-[80vh] max-w-[90vw] rounded-xl ring-1 ring-border"
            />
          </div>
        </div>
      )}
    </div>
  );
}
