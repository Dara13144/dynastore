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
  UNSUPPORTED_HOST: "ប្រភពនេះមិនត្រូវបានគាំទ្រទេ",
  TOO_LONG: "តំណវែងពេក (អតិបរមា 2048 តួអក្សរ)",
} as const;

export const MAX_URL_LENGTH = 2048;

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
  "pixeldra.in",
  "gofile.io",
  "gofile.to",
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
  "files.catbox.moe",
  "fileditchfiles.me",
  "fileditch.com",
] as const;

function isShareHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return SHARE_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

const BAD_EXTS = [".exe", ".bin", ".msi", ".scr", ".bat", ".cmd", ".sh", ".apk", ".dmg", ".pkg"];

function hasExt(haystack: string, exts: readonly string[]): boolean {
  return exts.some(
    (ext) =>
      haystack.endsWith(ext) ||
      haystack.includes(`${ext}?`) ||
      haystack.includes(`${ext}&`) ||
      haystack.includes(`${ext}#`),
  );
}

// Tracking params stripped during normalization.
const TRACKING_PARAM_RE = /^(utm_|mc_|_ga|_gl|fbclid$|gclid$|yclid$|msclkid$|ref$|ref_src$|si$)/i;

export type NormalizedShareUrl =
  | { ok: true; url: string; host: string; source: "direct" | "share" }
  | { ok: false; error: string };

/**
 * Validate AND normalize an external link. Lowercases host, strips `www.`,
 * removes tracking params, collapses duplicate slashes, enforces protocol
 * and a supported-sources allowlist, blocks dangerous executables, and caps
 * length. Returns either { ok: true, url } or { ok: false, error }.
 */
export function normalizeShareUrl(raw: string | null | undefined): NormalizedShareUrl {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: GAME_FILE_URL_ERRORS.EMPTY };
  if (value.length > MAX_URL_LENGTH) return { ok: false, error: GAME_FILE_URL_ERRORS.TOO_LONG };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: GAME_FILE_URL_ERRORS.INVALID_URL };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: GAME_FILE_URL_ERRORS.BAD_PROTOCOL };
  }
  // Lowercase host; strip leading "www."
  let host = url.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  url.hostname = host;
  // Reject obviously private/loopback hosts.
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") {
    return { ok: false, error: GAME_FILE_URL_ERRORS.UNSUPPORTED_HOST };
  }
  // Collapse duplicate slashes in path.
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  // Strip tracking parameters.
  const toDelete: string[] = [];
  url.searchParams.forEach((_v, k) => {
    if (TRACKING_PARAM_RE.test(k)) toDelete.push(k);
  });
  for (const k of toDelete) url.searchParams.delete(k);
  // Drop trailing "?" if no params remain.
  if (!url.search) url.search = "";

  const haystack = (url.pathname + url.search + url.hash).toLowerCase();
  if (hasExt(haystack, BAD_EXTS)) {
    return { ok: false, error: GAME_FILE_URL_ERRORS.BAD_EXTENSION };
  }
  if (hasExt(haystack, ALLOWED_GAME_FILE_EXTS)) {
    return { ok: true, url: url.toString(), host, source: "direct" };
  }
  // No archive extension — accept only known share hosts with a non-empty path.
  if (isShareHost(host) && url.pathname.replace(/\/+$/, "").length > 1) {
    return { ok: true, url: url.toString(), host, source: "share" };
  }
  // Friendlier error: if the host is plainly not a share host, say so.
  return {
    ok: false,
    error: isShareHost(host) ? GAME_FILE_URL_ERRORS.BAD_EXTENSION : GAME_FILE_URL_ERRORS.UNSUPPORTED_HOST,
  };
}

/**
 * Validate an external link to a game archive. Thin wrapper around
 * `normalizeShareUrl` that returns only the error message (or null).
 */
export function validateGameFileUrl(raw: string | null | undefined): string | null {
  const r = normalizeShareUrl(raw);
  return r.ok ? null : r.error;
}
