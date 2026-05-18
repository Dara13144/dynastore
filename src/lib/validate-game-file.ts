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
 * Known file-sharing hosts that serve archives behind a share page URL
 * (no file extension in the URL). These are accepted as-is.
 */
export const SHARE_HOSTS = [
  "uploadnow.io",
  "mediafire.com",
  "mega.nz",
  "mega.io",
  "drive.google.com",
  "pixeldrain.com",
  "gofile.io",
  "bunkr.ru",
  "bunkr.is",
  "bunkr.si",
  "krakenfiles.com",
  "sendspace.com",
  "1fichier.com",
  "workupload.com",
  "anonfiles.com",
  "dropbox.com",
  "drop.download",
  "qiwi.gg",
  "buzzheavier.com",
  "gofile.to",
  "files.catbox.moe",
  "pixeldra.in",
] as const;

function isShareHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return SHARE_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

/**
 * Validate an external link to a game archive.
 * Rules: non-empty, parseable URL, http/https only; path/query must end with
 * an allowed archive extension OR the host must be a known share-page host
 * that requires no extension (e.g. uploadnow.io/files/abcd).
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
  const haystack = (url.pathname + url.search + url.hash).toLowerCase();
  // Hard-block dangerous executables even on share hosts.
  const BAD_EXTS = [".exe", ".bin", ".msi", ".scr", ".bat", ".cmd", ".sh", ".apk"];
  if (BAD_EXTS.some((ext) => haystack.endsWith(ext) || haystack.includes(`${ext}?`) || haystack.includes(`${ext}&`) || haystack.includes(`${ext}#`))) {
    return GAME_FILE_URL_ERRORS.BAD_EXTENSION;
  }
  const hasExt = ALLOWED_GAME_FILE_EXTS.some(
    (ext) => haystack.endsWith(ext) || haystack.includes(`${ext}?`) || haystack.includes(`${ext}&`) || haystack.includes(`${ext}#`),
  );
  if (hasExt) return null;
  // No archive extension — accept only if host is a known share page that
  // has a non-empty path (share id).
  if (isShareHost(url.hostname) && url.pathname.replace(/\/+$/, "").length > 1) {
    return null;
  }
  return GAME_FILE_URL_ERRORS.BAD_EXTENSION;
}
