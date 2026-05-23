// Messy / malformed input coverage for SHARE_HOSTS links across BOTH entry
// points (single-URL validator + bulk import parser). Mirrors the realistic
// junk operators paste into the admin dialog: missing schemes, leading or
// trailing whitespace, tracking-only query params, hash fragments, mixed
// case, and duplicate lines.
//
// Pure unit coverage so a regression is caught in CI before the browser
// e2e suite runs against the preview.
import { describe, it, expect } from "vitest";
import {
  SHARE_HOSTS,
  normalizeShareUrl,
  validateGameFileUrl,
  GAME_FILE_URL_ERRORS,
} from "./validate-game-file";
import { parseBulkLinks, summarizeParse } from "./bulk-link-import";

const SAMPLE_PATH: Record<(typeof SHARE_HOSTS)[number], string> = {
  "uploadnow.io": "/files/FvFBmV6",
  "mediafire.com": "/file/abc123/game.zip/file",
  "mega.nz": "/file/AbCdEf",
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
  "1fichier.com": "/onefichier-abc123",
  "workupload.com": "/file/XyZ1234",
  "anonfiles.com": "/anonfiles-abc",
  "dropbox.com": "/s/abc/game.zip",
  "drop.download": "/abcdef",
  "qiwi.gg": "/file/abc123",
  "buzzheavier.com": "/buzz-abc",
  "files.catbox.moe": "/abc.zip",
  "fileditchfiles.me": "/game.zip",
  "fileditch.com": "/file/abc",
  "vikingfile.com": "/f/pJUUBfjqPi",
};

describe("SHARE_HOSTS messy input — single-URL validator", () => {
  describe.each(SHARE_HOSTS)("host: %s", (host) => {
    const path = SAMPLE_PATH[host];
    const canonical = `https://${host}${path}`;

    it("rejects a missing scheme (bare host)", () => {
      // "vikingfile.com/f/xxx" is not a valid absolute URL.
      expect(validateGameFileUrl(`${host}${path}`)).toBe(
        GAME_FILE_URL_ERRORS.INVALID_URL,
      );
    });

    it("rejects a protocol-relative URL (//host/path)", () => {
      expect(validateGameFileUrl(`//${host}${path}`)).toBe(
        GAME_FILE_URL_ERRORS.INVALID_URL,
      );
    });

    it("trims leading/trailing whitespace before validating", () => {
      const padded = `   \t  ${canonical}   \n`;
      const r = normalizeShareUrl(padded);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.host).toBe(host);
    });

    it("percent-encodes spaces inside the path rather than crashing", () => {
      // URL parser tolerates an embedded space by encoding it; the share-host
      // check still passes, so the value normalizes successfully.
      const r = normalizeShareUrl(`https://${host}${path}%20extra`);
      expect(r.ok).toBe(true);
    });

    it("strips utm_/fbclid/gclid tracking params", () => {
      const trackingUrl =
        `${canonical}?utm_source=fb&utm_medium=cpc&fbclid=xyz&gclid=abc`;
      const r = normalizeShareUrl(trackingUrl);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.url).not.toMatch(/utm_/);
        expect(r.url).not.toMatch(/fbclid/);
        expect(r.url).not.toMatch(/gclid/);
      }
    });

    it("preserves non-tracking query params and the hash fragment", () => {
      const url = `${canonical}?token=keep_me&utm_source=x#section`;
      const r = normalizeShareUrl(url);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.url).toMatch(/token=keep_me/);
        expect(r.url).not.toMatch(/utm_source/);
      }
    });

    it("collapses duplicate slashes inside the path", () => {
      const url = `https://${host}${path.replace("/", "///")}`;
      const r = normalizeShareUrl(url);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.url).not.toMatch(/[^:]\/\//);
    });

    it("normalizes mixed-case host (UPPER + Www.) back to canonical", () => {
      const messy = `https://WwW.${host.toUpperCase()}${path}`;
      const r = normalizeShareUrl(messy);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.host).toBe(host);
    });
  });
});

describe("SHARE_HOSTS messy input — bulk import", () => {
  it("flags lines with a missing scheme as invalid but accepts the rest", () => {
    const input = [
      "vikingfile.com/f/missingScheme1",                    // invalid
      "https://vikingfile.com/f/goodOne1",                  // ok
      "  https://mega.nz/file/Padded1  ",                   // ok (trimmed)
      "//workupload.com/file/protoRelative",                // invalid
      "https://mediafire.com/file/abc/g.zip/file",          // ok
    ].join("\n");

    const rows = parseBulkLinks(input);
    expect(rows).toHaveLength(5);
    expect(rows[0].ok).toBe(false);
    expect(rows[0].error).toBe(GAME_FILE_URL_ERRORS.INVALID_URL);
    expect(rows[1].ok).toBe(true);
    expect(rows[2].ok).toBe(true);
    expect(rows[3].ok).toBe(false);
    expect(rows[3].error).toBe(GAME_FILE_URL_ERRORS.INVALID_URL);
    expect(rows[4].ok).toBe(true);

    const sum = summarizeParse(rows);
    expect(sum).toEqual({
      total: 5, valid: 3, invalid: 2, skipped: 0, importable: 3,
    });
  });

  it("strips tracking query params on bulk-imported share links", () => {
    const input = [
      "https://vikingfile.com/f/trackA?utm_source=fb&utm_medium=cpc",
      "https://mega.nz/file/trackB?fbclid=xyz#frag",
      "https://workupload.com/file/trackC?gclid=abc&token=keep",
    ].join("\n");
    const rows = parseBulkLinks(input);
    expect(rows.every((r) => r.ok)).toBe(true);
    for (const r of rows) {
      expect(r.draft!.url).not.toMatch(/utm_/);
      expect(r.draft!.url).not.toMatch(/fbclid/);
      expect(r.draft!.url).not.toMatch(/gclid/);
    }
    // Non-tracking param must survive.
    expect(rows[2].draft!.url).toMatch(/token=keep/);
    // Hash fragment is preserved by the normalizer.
    expect(rows[1].draft!.url).toMatch(/#frag$/);
  });

  it("flags duplicate lines (same URL pasted twice) via id collision", () => {
    const url = "https://vikingfile.com/f/duplicateMe";
    const rows = parseBulkLinks(`${url}\n${url}\n${url}`);
    expect(rows).toHaveLength(3);
    expect(rows[0].ok).toBe(true);
    expect(rows[1].ok).toBe(false);
    expect(rows[1].error).toMatch(/ស្ទួន/);
    expect(rows[2].ok).toBe(false);
    expect(rows[2].error).toMatch(/ស_?ួន|ស្ទួន/);
    const sum = summarizeParse(rows);
    expect(sum.valid).toBe(1);
    expect(sum.invalid).toBe(2);
  });

  it("treats www./UPPERCASE variants of the same link as duplicates", () => {
    const input = [
      "https://vikingfile.com/f/caseDupe",
      "https://WWW.VIKINGFILE.COM/f/caseDupe",
      "  https://www.vikingfile.com/f/caseDupe?utm_source=tw  ",
    ].join("\n");
    const rows = parseBulkLinks(input);
    expect(rows[0].ok).toBe(true);
    expect(rows[1].ok).toBe(false);
    expect(rows[2].ok).toBe(false);
  });

  it("ignores blank lines, extra whitespace, and # comments", () => {
    const input = [
      "",
      "   ",
      "# this is a comment — should be ignored",
      "\t\thttps://vikingfile.com/f/whitespaceLine\t",
      "",
      "# another comment",
      "  https://mega.nz/file/secondLine  ",
    ].join("\n");
    const rows = parseBulkLinks(input);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it("rejects unsupported hosts with the UNSUPPORTED_HOST error", () => {
    const rows = parseBulkLinks("https://random-bad-host.example/foo");
    expect(rows[0].ok).toBe(false);
    expect(rows[0].error).toBe(GAME_FILE_URL_ERRORS.UNSUPPORTED_HOST);
  });
});
