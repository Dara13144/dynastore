// Pure, testable parser for bulk external-link import.
// Accepts multi-line input and produces normalized game drafts ready for
// submitCreateGame. Each line can be one of:
//   • just a URL                         → id derived from filename
//   • id|title|category|price|url        (pipe-delimited)
//   • id\ttitle\tcategory\tprice\turl    (tab-delimited)
//   • title,url                          (comma; minimal)
// Empty lines and lines starting with '#' are ignored.
import { normalizeShareUrl, ALLOWED_GAME_FILE_EXTS } from "./validate-game-file";

export type ParsedLinkRow = {
  lineNumber: number;
  raw: string;
  ok: boolean;
  error?: string;
  draft?: {
    id: string;
    title: string;
    category: string;
    price_coins: number;
    url: string;
  };
};

const DELIMS = /\t|\|/;

/** Derive a slug-ish id from a URL's filename (strip extension, lowercase). */
export function deriveIdFromUrl(url: string): string {
  try {
    const u = new URL(url);
    // 1) Prefer a pathname segment that looks like an archive filename.
    let last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const looksLikeFile = ALLOWED_GAME_FILE_EXTS.some((ext) => last.toLowerCase().endsWith(ext));
    // 2) Otherwise look in query values for an archive filename.
    if (!looksLikeFile) {
      for (const [, v] of u.searchParams) {
        const cand = v.split("/").filter(Boolean).pop() ?? "";
        if (ALLOWED_GAME_FILE_EXTS.some((ext) => cand.toLowerCase().endsWith(ext))) {
          last = cand;
          break;
        }
      }
    }
    // 3) Final fallback for share-page URLs without any filename — use the
    //    last path segment as-is (e.g. uploadnow.io/files/FvFBmV6 → fvfbmv6).
    if (!last) last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const base = ALLOWED_GAME_FILE_EXTS.reduce(
      (acc, ext) => (acc.toLowerCase().endsWith(ext) ? acc.slice(0, -ext.length) : acc),
      last,
    );
    const slug = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    return slug || `game-${Date.now().toString(36)}`;
  } catch {
    return `game-${Date.now().toString(36)}`;
  }
}

function splitRow(line: string): string[] {
  if (DELIMS.test(line)) return line.split(DELIMS).map((s) => s.trim());
  // comma split — but only when there's no comma inside the URL.
  // Fall back to a single-field row (the URL) otherwise.
  if (line.includes(",") && !/https?:\/\/[^\s,]*,/i.test(line)) {
    return line.split(",").map((s) => s.trim());
  }
  return [line.trim()];
}

export function parseBulkLinks(input: string): ParsedLinkRow[] {
  const lines = input.split(/\r?\n/);
  const out: ParsedLinkRow[] = [];
  const seenIds = new Set<string>();
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const fields = splitRow(line);
    let id = "";
    let title = "";
    let category = "GAME";
    let price = 0;
    let url = "";

    if (fields.length === 1) {
      url = fields[0];
    } else if (fields.length === 2) {
      // title, url
      title = fields[0];
      url = fields[1];
    } else {
      // id, title, category, price, url  (price + category optional)
      [id, title, category, , url] = [
        fields[0] ?? "",
        fields[1] ?? "",
        fields[2] ?? "GAME",
        fields[3] ?? "0",
        fields[4] ?? fields[fields.length - 1] ?? "",
      ];
      price = Number(fields[3]);
      if (!Number.isFinite(price) || price < 0) price = 0;
    }

    const row: ParsedLinkRow = { lineNumber: i + 1, raw: line, ok: false };
    const norm = normalizeShareUrl(url);
    if (!norm.ok) {
      row.error = norm.error;
      out.push(row);
      return;
    }
    url = norm.url;
    if (!id) id = deriveIdFromUrl(url);
    if (!title) title = id.replace(/[-_]+/g, " ").trim() || id;
    if (seenIds.has(id)) {
      row.error = `id "${id}" ស្ទួន`;
      out.push(row);
      return;
    }
    seenIds.add(id);
    row.ok = true;
    row.draft = { id, title, category: category || "GAME", price_coins: price, url };
    out.push(row);
  });
  return out;
}

export function summarizeParse(rows: ParsedLinkRow[]): { total: number; valid: number; invalid: number } {
  let valid = 0;
  let invalid = 0;
  for (const r of rows) {
    if (r.ok) valid++;
    else invalid++;
  }
  return { total: rows.length, valid, invalid };
}
