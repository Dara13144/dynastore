// End-to-end coverage for SHARE_HOSTS links across BOTH entry points:
//   1) single-URL input  → validateGameFileUrl / normalizeShareUrl
//   2) bulk import       → parseBulkLinks → dedupeAgainstExisting → summarize
//
// These tests exercise the full pure pipeline used by the admin UI when an
// operator pastes a vikingfile.com (or any other share-host) link. Browser
// e2e for the same flow lives in tests/e2e/, but that path is gated by admin
// auth on the live preview; this file gives deterministic, fast coverage of
// every host in SHARE_HOSTS so a regression like "vikingfile rejected" is
// caught in CI before any deploy.
import { describe, it, expect } from "vitest";
import {
  SHARE_HOSTS,
  normalizeShareUrl,
  validateGameFileUrl,
} from "./validate-game-file";
import {
  parseBulkLinks,
  dedupeAgainstExisting,
  summarizeParse,
} from "./bulk-link-import";

// A realistic share-page path for each host. Keep the slugs varied so the
// id-derivation logic (deriveIdFromUrl) is exercised too.
const SAMPLE_PATHS: Record<(typeof SHARE_HOSTS)[number], string> = {
  "uploadnow.io": "/files/FvFBmV6",
  "mediafire.com": "/file/abc123/cool-game.zip/file",
  "mega.nz": "/file/AbCdEf#k",
  "mega.io": "/file/AbCdEf",
  "drive.google.com": "/file/d/1A2B3C/view",
  "pixeldrain.com": "/u/xyz789",
  "pixeldra.in": "/u/xyz789",
  "gofile.io": "/d/Ab12Cd",
  "gofile.to": "/d/Ab12Cd",
  "bunkr.ru": "/a/abcd",
  "bunkr.is": "/a/abcd",
  "bunkr.si": "/a/abcd",
  "krakenfiles.com": "/view/abc/file.html",
  "sendspace.com": "/file/abc123",
  "1fichier.com": "/?abc123def",
  "workupload.com": "/file/abcXYZ",
  "anonfiles.com": "/abc123",
  "dropbox.com": "/s/abc123/game.zip",
  "drop.download": "/abcdef",
  "qiwi.gg": "/file/abc123",
  "buzzheavier.com": "/abc123",
  "files.catbox.moe": "/abc123.zip",
  "fileditchfiles.me": "/file.bin",
  "fileditch.com": "/file/abc",
  "vikingfile.com": "/f/pJUUBfjqPi",
};

describe("SHARE_HOSTS end-to-end (single + bulk)", () => {
  it("covers every host in SHARE_HOSTS with a sample path", () => {
    for (const h of SHARE_HOSTS) {
      expect(SAMPLE_PATHS[h], `missing sample path for ${h}`).toBeTruthy();
    }
  });

  describe.each(SHARE_HOSTS)("host: %s", (host) => {
    const url = `https://${host}${SAMPLE_PATHS[host]}`;

    it("single-URL input accepts the link", () => {
      expect(validateGameFileUrl(url)).toBeNull();
      const norm = normalizeShareUrl(url);
      expect(norm.ok).toBe(true);
      if (norm.ok) {
        expect(norm.host).toBe(host);
        // Either a direct archive link or a share-page link is acceptable.
        expect(["share", "direct"]).toContain(norm.source);
      }
    });

    it("single-URL input also accepts the www. variant", () => {
      const wwwUrl = `https://www.${host}${SAMPLE_PATHS[host]}`;
      const norm = normalizeShareUrl(wwwUrl);
      expect(norm.ok).toBe(true);
      if (norm.ok) expect(norm.host).toBe(host); // www. is stripped
    });

    it("bulk import parses the link as a valid row", () => {
      const rows = parseBulkLinks(url);
      expect(rows).toHaveLength(1);
      expect(rows[0].ok, rows[0].error).toBe(true);
      expect(rows[0].draft?.url).toBe(url);
      expect(rows[0].draft?.id).toMatch(/^[a-z0-9-]+$/);
      expect(rows[0].draft?.title?.length ?? 0).toBeGreaterThan(0);
    });
  });

  it("bulk import handles a mixed paste of every SHARE_HOST link at once", () => {
    const input = SHARE_HOSTS.map((h) => `https://${h}${SAMPLE_PATHS[h]}`).join("\n");
    const rows = parseBulkLinks(input);
    expect(rows).toHaveLength(SHARE_HOSTS.length);
    const bad = rows.filter((r) => !r.ok);
    expect(bad, bad.map((r) => `${r.raw} → ${r.error}`).join("\n")).toEqual([]);
    const sum = summarizeParse(rows);
    expect(sum).toEqual({
      total: SHARE_HOSTS.length,
      valid: SHARE_HOSTS.length,
      invalid: 0,
      skipped: 0,
      importable: SHARE_HOSTS.length,
    });
  });

  it("bulk import flags share-host links that already exist (id or url)", () => {
    const url = `https://vikingfile.com${SAMPLE_PATHS["vikingfile.com"]}`;
    const rows = parseBulkLinks(url);
    expect(rows[0].ok).toBe(true);
    const derivedId = rows[0].draft!.id;

    // existing-by-id
    const byId = dedupeAgainstExisting(parseBulkLinks(url), { ids: [derivedId] });
    expect(byId[0].ok).toBe(false);
    expect(byId[0].skipped).toBe(true);
    expect(byId[0].skipReason).toMatch(/មាននៅក្នុងប្រព័ន្ធ/);

    // existing-by-url (case + www variations must still match)
    const byUrl = dedupeAgainstExisting(parseBulkLinks(url), {
      urls: [`https://WWW.VIKINGFILE.COM${SAMPLE_PATHS["vikingfile.com"]}`],
    });
    expect(byUrl[0].ok).toBe(false);
    expect(byUrl[0].skipped).toBe(true);
    expect(byUrl[0].skipReason).toMatch(/នាំចូលរួចហើយ/);
  });

  it("bulk import accepts share links mixed with id|title|category|price|url rows", () => {
    const input = [
      "# vikingfile share link only",
      "https://vikingfile.com/f/pJUUBfjqPi",
      "viking2|Viking Two|GAME|50|https://vikingfile.com/f/AnotherSlug",
      "mediafire-pipe|MF Game|RPG|100|https://mediafire.com/file/zzz/cool.zip/file",
    ].join("\n");
    const rows = parseBulkLinks(input);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.ok)).toBe(true);
    expect(rows[1].draft).toMatchObject({
      id: "viking2",
      title: "Viking Two",
      price_coins: 50,
    });
  });
});
