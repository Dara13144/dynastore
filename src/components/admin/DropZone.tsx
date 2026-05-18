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
