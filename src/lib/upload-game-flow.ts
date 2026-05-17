// Upload-flow orchestrator extracted from the admin route so it can be
// exercised by integration tests without rendering the full UI.
//
// It runs the same stage machine the admin form uses:
//   preparing -> uploading -> processing -> done   (or error at any step)
import { validateGameFile, MAX_GAME_FILE_BYTES } from "./validate-game-file";

export type UploadStage = "idle" | "preparing" | "uploading" | "processing" | "done" | "error";

export interface UploadProgress {
  sent: number;
  total: number;
  pct: number;
}

export interface RunUploadFlowOptions {
  gameId: string;
  file: File;
  /** Bucket file_size_limit in bytes, or null when unknown/unlimited. */
  bucketLimitBytes: number | null;
  /** Inject the storage uploader (direct + resumable). */
  uploader: {
    direct: (path: string, file: File) => Promise<{ error: Error | null }>;
    resumable: (
      path: string,
      file: File,
      cbs: { onProgress: (sent: number, total: number) => void },
    ) => Promise<{ error: Error | null }>;
  };
  /** Insert the game row after the bytes are in storage. */
  submit: (args: { gameId: string; path: string; size: number }) => Promise<void>;
  onStage?: (stage: UploadStage, info?: { error?: string }) => void;
  onProgress?: (p: UploadProgress) => void;
  /** Files at or below this size use the direct uploader (defaults to 2 MiB). */
  resumableThresholdBytes?: number;
}

export interface RunUploadFlowResult {
  ok: boolean;
  stage: UploadStage;
  path?: string;
  error?: string;
}

const DEFAULT_RESUMABLE_THRESHOLD = 2 * 1024 * 1024;

export function effectiveMaxBytes(bucketLimit: number | null): number {
  return bucketLimit && bucketLimit > 0
    ? Math.min(MAX_GAME_FILE_BYTES, bucketLimit)
    : MAX_GAME_FILE_BYTES;
}

function fail(
  onStage: RunUploadFlowOptions["onStage"],
  message: string,
): RunUploadFlowResult {
  onStage?.("error", { error: message });
  return { ok: false, stage: "error", error: message };
}

export async function runUploadFlow(opts: RunUploadFlowOptions): Promise<RunUploadFlowResult> {
  const {
    gameId,
    file,
    bucketLimitBytes,
    uploader,
    submit,
    onStage,
    onProgress,
    resumableThresholdBytes = DEFAULT_RESUMABLE_THRESHOLD,
  } = opts;

  const baseErr = validateGameFile(file);
  if (baseErr) return fail(onStage, baseErr);

  const max = effectiveMaxBytes(bucketLimitBytes);
  if (file.size > max) {
    return fail(
      onStage,
      `ឯកសារធំជាងដែនកំណត់ម៉ាស៊ីន (${file.size}B > ${max}B)`,
    );
  }

  onStage?.("preparing");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${gameId}/${Date.now()}_${safe}`;

  onStage?.("uploading");
  onProgress?.({ sent: 0, total: file.size, pct: 0 });

  if (file.size <= resumableThresholdBytes) {
    const { error } = await uploader.direct(path, file);
    if (error) return fail(onStage, error.message);
  } else {
    const { error } = await uploader.resumable(path, file, {
      onProgress: (sent, total) =>
        onProgress?.({ sent, total, pct: total ? (sent / total) * 100 : 0 }),
    });
    if (error) return fail(onStage, error.message);
  }
  onProgress?.({ sent: file.size, total: file.size, pct: 100 });

  onStage?.("processing");
  try {
    await submit({ gameId, path, size: file.size });
  } catch (e) {
    return fail(onStage, e instanceof Error ? e.message : String(e));
  }

  onStage?.("done");
  return { ok: true, stage: "done", path };
}
