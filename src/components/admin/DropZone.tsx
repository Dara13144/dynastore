// Reusable drag-and-drop zone for media uploads. Wraps arbitrary children
// (label, button, gallery tile) so the existing visual UI is unchanged —
// dragging files over the zone highlights it, dropping triggers onFiles.
import { useCallback, useRef, useState } from "react";

export interface RejectedFile {
  name: string;
  size: number;
  reason: string;
}

export interface DropZoneProps {
  /** MIME / extension filter, e.g. "image/*" or ".zip,.rar". */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  /** Optional per-file validation. Return error message string, or null when valid. */
  validate?: (file: File) => string | null;
  /** Called with files rejected by accept-filter OR by `validate`. */
  onReject?: (rejections: RejectedFile[]) => void;
  className?: string;
  /** Visible content (button, tile, label, etc.). */
  children: React.ReactNode;
  /** Optional tooltip on the wrapper. */
  title?: string;
  /** Optional aria-label for accessibility. */
  ariaLabel?: string;
}

function acceptMatch(file: File, accept?: string): boolean {
  if (!accept) return true;
  const parts = accept.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return parts.some((p) => {
    if (p.startsWith(".")) return name.endsWith(p);
    if (p.endsWith("/*")) return type.startsWith(p.slice(0, -1));
    return type === p;
  });
}

function acceptHint(accept?: string): string {
  if (!accept) return "";
  return accept;
}

export function DropZone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  validate,
  onReject,
  className = "",
  children,
  title,
  ariaLabel,
}: DropZoneProps) {
  const [over, setOver] = useState(false);
  const counter = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      counter.current += 1;
      if (e.dataTransfer.types.includes("Files")) setOver(true);
    },
    [disabled],
  );
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) setOver(false);
  }, []);
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    [disabled],
  );
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      counter.current = 0;
      setOver(false);
      if (disabled) return;
      const dropped = Array.from(e.dataTransfer.files ?? []);
      if (dropped.length === 0) return;
      const accepted: File[] = [];
      const rejected: RejectedFile[] = [];
      const hint = acceptHint(accept);
      for (const f of dropped) {
        if (!acceptMatch(f, accept)) {
          rejected.push({
            name: f.name,
            size: f.size,
            reason: `ប្រភេទឯកសារមិនត្រឹមត្រូវ — តម្រូវ ${hint}`,
          });
          continue;
        }
        const err = validate ? validate(f) : null;
        if (err) {
          rejected.push({ name: f.name, size: f.size, reason: err });
          continue;
        }
        accepted.push(f);
      }
      if (rejected.length) onReject?.(rejected);
      if (accepted.length === 0) return;
      onFiles(multiple ? accepted : [accepted[0]]);
    },
    [accept, disabled, multiple, onFiles, validate, onReject],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      title={title}
      aria-label={ariaLabel}
      data-drop-active={over || undefined}
      className={`relative ${className} ${
        over
          ? "outline outline-2 outline-dashed outline-primary rounded-lg bg-primary/5"
          : ""
      }`}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-primary/10 text-[11px] font-semibold text-primary z-10">
          ទម្លាក់នៅទីនេះ
        </div>
      )}
    </div>
  );
}

export interface UploadProgressLineProps {
  name: string;
  pct?: number | null; // null/undefined => indeterminate
  status?: "uploading" | "done" | "error";
  message?: string;
}

/** Compact progress row for media (cover/screenshot/video) uploads. */
export function UploadProgressLine({ name, pct, status = "uploading", message }: UploadProgressLineProps) {
  const tone =
    status === "error" ? "bg-destructive" : status === "done" ? "bg-emerald-400" : "bg-primary";
  const indeterminate = pct == null;
  const width = indeterminate ? "40%" : `${Math.max(2, Math.min(100, pct))}%`;
  return (
    <div className="mt-1 text-[10px]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-foreground/80">{name}</span>
        <span className="shrink-0 text-muted-foreground">
          {status === "done"
            ? "✓ រួចរាល់"
            : status === "error"
              ? "✗ បរាជ័យ"
              : indeterminate
                ? "កំពុង upload…"
                : `${Math.round(pct ?? 0)}%`}
        </span>
      </div>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${tone} transition-all ${indeterminate && status === "uploading" ? "animate-pulse" : ""}`}
          style={{ width, marginLeft: indeterminate && status === "uploading" ? "30%" : undefined }}
        />
      </div>
      {message && (
        <div className={`mt-0.5 ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </div>
      )}
    </div>
  );
}

export interface RejectedFilesBannerProps {
  items: RejectedFile[];
  onClear?: () => void;
}

/** Compact red banner listing rejected files with their reasons. */
export function RejectedFilesBanner({ items, onClear }: RejectedFilesBannerProps) {
  if (!items || items.length === 0) return null;
  const fmt = (n: number) =>
    n >= 1024 ** 3
      ? `${(n / 1024 ** 3).toFixed(2)} GiB`
      : n >= 1024 ** 2
        ? `${(n / 1024 ** 2).toFixed(1)} MiB`
        : n >= 1024
          ? `${(n / 1024).toFixed(1)} KiB`
          : `${n} B`;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold">
          ✗ បដិសេធ {items.length} ឯកសារ
        </span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            បិទ
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {items.map((r, i) => (
          <li key={`${r.name}-${i}`} className="leading-tight">
            <span className="font-mono text-foreground/80 break-all">{r.name}</span>
            <span className="text-muted-foreground"> · {fmt(r.size)}</span>
            <div className="text-destructive/90 break-words">{r.reason}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface UploadOverallSummaryProps {
  mediaUploads: Array<{
    id: string;
    kind: "cover" | "screenshot" | "video";
    name: string;
    status: "uploading" | "done" | "error";
    message?: string;
  }>;
  /** Archive upload percent (0-100) or null when idle. */
  archivePct?: number | null;
}

/** Compact overall upload status summary shown at the top of the form section. */
export function UploadOverallSummary({ mediaUploads, archivePct }: UploadOverallSummaryProps) {
  const groups: Array<{ key: "cover" | "screenshot" | "video"; label: string }> = [
    { key: "cover", label: "Cover" },
    { key: "screenshot", label: "Screenshots" },
    { key: "video", label: "Video" },
  ];
  const stats = groups.map((g) => {
    const items = mediaUploads.filter((u) => u.kind === g.key);
    return {
      ...g,
      total: items.length,
      uploading: items.filter((i) => i.status === "uploading").length,
      done: items.filter((i) => i.status === "done").length,
      error: items.filter((i) => i.status === "error").length,
    };
  });
  const archiveActive = archivePct != null;
  const totalActive =
    stats.reduce((a, s) => a + s.uploading, 0) + (archiveActive && archivePct < 100 ? 1 : 0);
  const totalError = stats.reduce((a, s) => a + s.error, 0);
  const anything =
    stats.some((s) => s.total > 0) || archiveActive;
  if (!anything) return null;

  const pillTone = (s: { uploading: number; error: number; done: number }) =>
    s.error > 0
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : s.uploading > 0
        ? "border-primary/50 bg-primary/10 text-primary"
        : s.done > 0
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
          : "border-border bg-muted text-muted-foreground";

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-border bg-muted/30 p-2.5 text-[11px]"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-semibold text-foreground">
          ស្ថានភាព Upload សរុប
        </span>
        <span className="text-[10px] text-muted-foreground">
          {totalActive > 0
            ? `កំពុងដំណើរការ ${totalActive}`
            : totalError > 0
              ? `មានបញ្ហា ${totalError}`
              : "បានរួចរាល់"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {stats.map((s) => (
          <span
            key={s.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${pillTone(s)}`}
          >
            <span className="font-semibold">{s.label}</span>
            <span className="opacity-80">
              {s.uploading > 0 && `↑${s.uploading}`}
              {s.done > 0 && ` ✓${s.done}`}
              {s.error > 0 && ` ✗${s.error}`}
              {s.total === 0 && "—"}
            </span>
          </span>
        ))}
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
            archiveActive
              ? archivePct! >= 100
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          <span className="font-semibold">Archive</span>
          <span className="opacity-80">
            {archiveActive ? `${Math.round(archivePct!)}%` : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}
