// Game archive upload validation — shared between admin UI and tests.
export const ALLOWED_GAME_FILE_EXTS = [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"] as const;

// Binary (MiB/GiB) bounds — these match the DB CHECK constraint
// games_file_size_bytes_range and the game-files bucket file_size_limit.
export const MIN_GAME_FILE_MIB = 1;
export const MAX_GAME_FILE_GIB = 1000;
export const MIN_GAME_FILE_BYTES = MIN_GAME_FILE_MIB * 1024 * 1024; // 1,048,576
export const MAX_GAME_FILE_BYTES = MAX_GAME_FILE_GIB * 1024 * 1024 * 1024; // 1,073,741,824,000

// Back-compat aliases (older code paths import these names).
export const MIN_GAME_FILE_MB = MIN_GAME_FILE_MIB;
export const MAX_GAME_FILE_GB = MAX_GAME_FILE_GIB;

/** Human-friendly bytes formatter using binary (MiB/GiB) units. */
export function formatBytesBinary(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"] as const;
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const decimals = i === 0 ? 0 : n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toFixed(decimals)} ${units[i]}`;
}

/** Human-readable allowed range, e.g. "1 MiB – 1000 GiB". */
export const FILE_SIZE_RANGE_TEXT =
  `${MIN_GAME_FILE_MIB} MiB – ${MAX_GAME_FILE_GIB} GiB`;

/** Detailed range hint suffix appended to too-small / too-large errors. */
const RANGE_HINT_KH =
  `អនុញ្ញាតពី ${MIN_GAME_FILE_MIB} MiB (${MIN_GAME_FILE_BYTES.toLocaleString("en-US")} bytes)` +
  ` ដល់ ${MAX_GAME_FILE_GIB} GiB (${MAX_GAME_FILE_BYTES.toLocaleString("en-US")} bytes)`;

/** Build the exact "too small" message for a given byte size. */
export function tooSmallMessage(size: number): string {
  return (
    `ឯកសារតូចពេក: ${formatBytesBinary(size)} ` +
    `(${size.toLocaleString("en-US")} bytes) — ` +
    `តម្រូវយ៉ាងតិច ${MIN_GAME_FILE_MIB} MiB ` +
    `(${MIN_GAME_FILE_BYTES.toLocaleString("en-US")} bytes) · ${RANGE_HINT_KH}`
  );
}

/** Build the exact "too large" message for a given byte size. */
export function tooLargeMessage(size: number): string {
  const sizeText = Number.isFinite(size)
    ? `${formatBytesBinary(size)} (${size.toLocaleString("en-US")} bytes)`
    : "ធំខ្លាំងពេក";
  return (
    `ឯកសារធំពេក: ${sizeText} — ` +
    `អនុញ្ញាតអតិបរមា ${MAX_GAME_FILE_GIB} GiB ` +
    `(${MAX_GAME_FILE_BYTES.toLocaleString("en-US")} bytes) · ${RANGE_HINT_KH}` +
    ` · សូមបំបែកជា parts តូចៗ ឬប្រើ External URL`
  );
}

export function validateGameFile(file: { name: string; size: number }): string | null {
  if (file.size <= 0) return "ឯកសារទទេ";
  const name = file.name.toLowerCase();
  const ok = ALLOWED_GAME_FILE_EXTS.some((ext) => name.endsWith(ext));
  if (!ok) return `ប្រភេទឯកសារមិនអនុញ្ញាត — តម្រូវ ${ALLOWED_GAME_FILE_EXTS.join(", ")}`;
  if (file.size < MIN_GAME_FILE_BYTES) return tooSmallMessage(file.size);
  if (file.size > MAX_GAME_FILE_BYTES) return tooLargeMessage(file.size);
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
  // Accept the extension when it appears in the pathname, query string, or
  // fragment — many CDN/proxy links (e.g. file.php?f=/path/x.rar) carry the
  // real filename in the query rather than the pathname.
  const haystack = (url.pathname + url.search + url.hash).toLowerCase();
  const ok = ALLOWED_GAME_FILE_EXTS.some(
    (ext) => haystack.endsWith(ext) || haystack.includes(`${ext}?`) || haystack.includes(`${ext}&`) || haystack.includes(`${ext}#`),
  );
  if (!ok) return GAME_FILE_URL_ERRORS.BAD_EXTENSION;
  return null;
}
