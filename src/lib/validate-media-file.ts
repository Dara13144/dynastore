// Shared file-type + size validation for media uploads (cover image,
// screenshots, preview video). Returns a friendly Khmer error string, or
// null when the file is acceptable. Game archive validation lives in
// validate-game-file.ts.

import { formatBytesBinary } from "./validate-game-file";

export type MediaKind = "image" | "screenshot" | "video";

export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"] as const;
export const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".m4v"] as const;
export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MiB

function hasExt(name: string, exts: readonly string[]): boolean {
  const n = name.toLowerCase();
  return exts.some((e) => n.endsWith(e));
}

export interface MediaValidationResult {
  ok: boolean;
  error: string | null;
}

export function validateMediaFile(
  file: { name: string; size: number; type?: string },
  kind: MediaKind,
): MediaValidationResult {
  if (!file || file.size <= 0) {
    return { ok: false, error: "ឯកសារទទេ ឬខូច — សូមជ្រើសឯកសារផ្សេង" };
  }

  const isImage = kind === "image" || kind === "screenshot";
  const exts = isImage ? IMAGE_EXTS : VIDEO_EXTS;
  const mimes = isImage ? IMAGE_MIMES : VIDEO_MIMES;
  const max = kind === "video" ? MAX_VIDEO_BYTES : kind === "screenshot" ? MAX_SCREENSHOT_BYTES : MAX_IMAGE_BYTES;
  const kindLabelKh = kind === "video" ? "វីដេអូ" : kind === "screenshot" ? "រូប screenshot" : "រូបភាព";

  const mimeOk = file.type
    ? (mimes as readonly string[]).includes(file.type) ||
      (isImage ? file.type.startsWith("image/") : file.type.startsWith("video/"))
    : true;
  const extOk = hasExt(file.name, exts);

  if (!mimeOk && !extOk) {
    return {
      ok: false,
      error: `ប្រភេទឯកសារមិនត្រឹមត្រូវសម្រាប់${kindLabelKh} — តម្រូវ ${exts.join(", ")}`,
    };
  }
  if (!extOk) {
    return {
      ok: false,
      error: `ផ្នែកបន្ថែម (.${file.name.split(".").pop() ?? "?"}) មិនអនុញ្ញាត — តម្រូវ ${exts.join(", ")}`,
    };
  }
  if (!mimeOk) {
    return {
      ok: false,
      error: `MIME type "${file.type}" មិនត្រូវនឹង${kindLabelKh} — តម្រូវ ${mimes.join(", ")}`,
    };
  }

  if (file.size > max) {
    return {
      ok: false,
      error:
        `${kindLabelKh}ធំពេក: ${formatBytesBinary(file.size)} — ` +
        `អនុញ្ញាតអតិបរមា ${formatBytesBinary(max)}។ ` +
        (kind === "video"
          ? "សូមបង្ហាប់វីដេអូ ឬកាត់ឲ្យខ្លី"
          : "សូមបង្ហាប់រូបភាព (ប្រើ WebP/JPEG quality ទាប)"),
    };
  }

  return { ok: true, error: null };
}
