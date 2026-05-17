// Pure helper: given a total file size and a per-upload cap, compute a chunk
// plan (number of parts and recommended part size). Used by the admin "split
// file" guidance modal when a 413 / platform per-upload cap error occurs.

import { formatBytes } from "./upload-error-messages";

export interface ChunkPlan {
  totalBytes: number;
  capBytes: number;
  parts: number;
  partBytes: number;
  totalLabel: string;
  capLabel: string;
  partLabel: string;
}

/** Default Supabase hosted resumable per-upload cap (~50GB). */
export const PLATFORM_PER_UPLOAD_CAP = 50 * 1024 ** 3;

/** Round a byte size DOWN to a "nice" round number (multiple of 1 GB when
 *  >=1GB, else 100MB). Keeps the suggested part size human-friendly. */
function roundDown(bytes: number): number {
  const GB = 1024 ** 3;
  const HMB = 100 * 1024 ** 2;
  if (bytes >= GB) return Math.floor(bytes / GB) * GB;
  return Math.max(HMB, Math.floor(bytes / HMB) * HMB);
}

export function computeChunkPlan(
  totalBytes: number,
  capBytes: number = PLATFORM_PER_UPLOAD_CAP,
): ChunkPlan {
  const safeTotal = Math.max(1, totalBytes);
  const safeCap = Math.max(1, capBytes);
  // Leave ~10% headroom under the cap so a slightly-larger encoded chunk does
  // not trip the 413 again.
  const target = Math.floor(safeCap * 0.9);
  const partBytes = roundDown(Math.min(target, safeTotal));
  const parts = Math.max(1, Math.ceil(safeTotal / partBytes));
  return {
    totalBytes: safeTotal,
    capBytes: safeCap,
    parts,
    partBytes,
    totalLabel: formatBytes(safeTotal),
    capLabel: formatBytes(safeCap),
    partLabel: formatBytes(partBytes),
  };
}

/** Detect whether a friendly/raw upload error string is the platform
 *  per-upload cap (not a bucket-limit overflow). */
export function isPlatformCapError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("per-upload") ||
    m.includes("50gb") ||
    m.includes("payload too large") ||
    m.includes("entity too large") ||
    m.includes("413")
  );
}
