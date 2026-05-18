// Game archive upload validation — shared between admin UI and tests.
export const ALLOWED_GAME_FILE_EXTS = [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"] as const;
export const MIN_GAME_FILE_MB = 1;
export const MAX_GAME_FILE_GB = 1000;
export const MIN_GAME_FILE_BYTES = MIN_GAME_FILE_MB * 1024 * 1024;
export const MAX_GAME_FILE_BYTES = MAX_GAME_FILE_GB * 1024 * 1024 * 1024;

export function validateGameFile(file: { name: string; size: number }): string | null {
  if (file.size <= 0) return "ឯកសារទទេ";
  const name = file.name.toLowerCase();
  const ok = ALLOWED_GAME_FILE_EXTS.some((ext) => name.endsWith(ext));
  if (!ok) return `ប្រភេទឯកសារមិនអនុញ្ញាត — តម្រូវ ${ALLOWED_GAME_FILE_EXTS.join(", ")}`;
  const mb = file.size / 1024 / 1024;
  if (file.size < MIN_GAME_FILE_BYTES)
    return `ឯកសារតូចពេក (${mb.toFixed(2)}MB) — តម្រូវយ៉ាងតិច ${MIN_GAME_FILE_MB}MB`;
  if (file.size > MAX_GAME_FILE_BYTES)
    return `ឯកសារធំពេក — អតិបរមា ${MAX_GAME_FILE_GB}GB`;
  return null;
}

// Exact error messages for the URL input — exported so tests can assert them.
export const GAME_FILE_URL_ERRORS = {
  EMPTY: "តំណមិនអាចទទេ",
  INVALID_URL: "តំណមិនត្រឹមត្រូវ",
  BAD_PROTOCOL: "តម្រូវ http ឬ https ប៉ុណ្ណោះ",
  BAD_EXTENSION: `តំណត្រូវបញ្ចប់ដោយ ${ALLOWED_GAME_FILE_EXTS.join(", ")}`,
} as const;

/**
 * Validate an external link to a game archive.
 * Rules: non-empty, parseable URL, http/https only, pathname ends with an allowed extension.
 */
export function validateGameFileUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return GAME_FILE_URL_ERRORS.EMPTY;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return GAME_FILE_URL_ERRORS.INVALID_URL;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return GAME_FILE_URL_ERRORS.BAD_PROTOCOL;
  }
  const path = url.pathname.toLowerCase();
  const ok = ALLOWED_GAME_FILE_EXTS.some((ext) => path.endsWith(ext));
  if (!ok) return GAME_FILE_URL_ERRORS.BAD_EXTENSION;
  return null;
}
