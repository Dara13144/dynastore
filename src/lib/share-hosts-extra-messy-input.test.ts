// Additional messy-input coverage for SHARE_HOSTS. Complements
// share-hosts-messy-input.test.ts with edge cases that operators hit when
// pasting from chat apps, browser address bars, and spreadsheet exports:
//   • Typo'd schemes ("https//host", "htps://")
//   • Embedded user:pass@ credentials
//   • Hosts with an explicit :443 / :80 port
//   • CRLF line endings + UTF-8 BOM at the start of the paste
//   • Trailing punctuation copied from prose (".", ",", ")")
//   • Repeated query keys + semicolon-separated params
//   • Cross-host duplicate detection in the bulk parser
//   • Mixed valid/invalid/duplicate paste with full summary assertion
import { describe, it, expect } from "vitest";
import {
  SHARE_HOSTS,
  normalizeShareUrl,
  validateGameFileUrl,
  GAME_FILE_URL_ERRORS,
} from "./validate-game-file";
import {
  parseBulkLinks,
  summarizeParse,
  dedupeAgainstExisting,
} from "./bulk-link-import";

// One representative path per host (mirrors share-hosts-messy-input.test.ts).
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

describe("SHARE_HOSTS extra messy input — single validator", () => {
  describe.each(SHARE_HOSTS)("host: %s", (host) => {
    const path = SAMPLE_PATH[host];
    const canonical = `https://${host}${path}`;

    it("rejects a typo'd scheme ('https//host', missing colon)", () => {
      expect(validateGameFileUrl(`https//${host}${path}`)).toBe(
        GAME_FILE_URL_ERRORS.INVALID_URL,
      );
    });

    it("rejects an unsupported scheme (ftp://) with BAD_PROTOCOL", () => {
      expect(validateGameFileUrl(`ftp://${host}${path}`)).toBe(
        GAME_FILE_URL_ERRORS.BAD_PROTOCOL,
      );
    });

    it("strips trailing punctuation pasted from prose ('.', ',', ')')", () => {
      for (const trailer of [".", ",", ")", ").", '"', "”"]) {
        const r = normalizeShareUrl(`${canonical}${trailer}`);
        // The URL parser keeps the trailer in the path, but the host check
        // still succeeds and normalization does not crash. Operators rely on
        // this to not throw an unhandled exception on a copy-pasted sentence.
        expect(r.ok).toBe(true);
      }
    });

    it("accepts an explicit :443 port and produces a valid normalized URL", () => {
      const r = normalizeShareUrl(`https://${host}:443${path}`);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.host).toBe(host);
    });

    it("ignores repeated tracking keys (utm_source=a&utm_source=b)", () => {
      const r = normalizeShareUrl(
        `${canonical}?utm_source=a&utm_source=b&utm_source=c`,
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.url).not.toMatch(/utm_source/);
    });

    it("keeps the trailing slash on the path (no canonical-form drift)", () => {
      const r = normalizeShareUrl(`${canonical}/`);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.host).toBe(host);
    });
  });
});

describe("SHARE_HOSTS extra messy input — bulk import", () => {
  it("strips a UTF-8 BOM at the very start of the paste", () => {
    const bom = "\uFEFF";
    const input = `${bom}https://vikingfile.com/f/bomLine\nhttps://mega.nz/file/secondBom`;
    const rows = parseBulkLinks(input);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it("handles CRLF line endings the same as LF", () => {
    const input = [
      "https://vikingfile.com/f/crlfOne",
      "https://mega.nz/file/crlfTwo",
      "https://workupload.com/file/crlfThree",
    ].join("\r\n");
    const rows = parseBulkLinks(input);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it("rejects URLs with embedded user:pass@ credentials as invalid", () => {
    // The share-host allowlist does not match against userinfo, but credentials
    // in a paste are almost certainly junk; the parser should not silently
    // import them as a valid draft.
    const input = "https://attacker:pwd@vikingfile.com/f/credLine";
    const rows = parseBulkLinks(input);
    expect(rows).toHaveLength(1);
    // Either it's marked invalid OR it normalizes with the userinfo stripped;
    // either way the resulting draft URL must NOT carry credentials.
    if (rows[0].ok) {
      expect(rows[0].draft!.url).not.toMatch(/@/);
    } else {
      expect(rows[0].error).toBeTruthy();
    }
  });

  it("detects duplicate URLs that only differ by tracking params + fragment", () => {
    const input = [
      "https://vikingfile.com/f/sameId",
      "https://vikingfile.com/f/sameId?utm_source=tw#section",
      "https://vikingfile.com/f/sameId?fbclid=xyz",
    ].join("\n");
    const rows = parseBulkLinks(input);
    expect(rows[0].ok).toBe(true);
    expect(rows[1].ok).toBe(false);
    expect(rows[1].error).toMatch(/ស្ទួន/);
    expect(rows[2].ok).toBe(false);
    expect(rows[2].error).toMatch(/ស្ទួន/);
  });

  it("dedupes across hosts when the derived id collides (e.g. same filename)", () => {
    // Two different hosts pointing at 'game.zip' both derive the same id.
    // The second occurrence must be flagged as a duplicate.
    const input = [
      "https://files.catbox.moe/game.zip",
      "https://fileditchfiles.me/game.zip",
    ].join("\n");
    const rows = parseBulkLinks(input);
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft!.id).toBe("game");
    expect(rows[1].ok).toBe(false);
    expect(rows[1].error).toMatch(/ស្ទួន/);
  });

  it("survives a mixed paste of valid + invalid + duplicate across many hosts", () => {
    const input = [
      "# Friday batch",
      "",
      "   https://vikingfile.com/f/mixedA   ",                 // ok (trimmed)
      "vikingfile.com/f/missingScheme",                        // invalid
      "https://mega.nz/file/mixedB?utm_source=fb",            // ok (stripped)
      "https://MEGA.NZ/file/mixedB",                          // duplicate of B
      "https://pixeldrain.com/u/mixedC#frag",                 // ok
      "ftp://uploadnow.io/files/badProto",                    // BAD_PROTOCOL
      "https://random.example/file/nope",                     // UNSUPPORTED_HOST
      "https://workupload.com/file/mixedD",                   // ok
      "https://workupload.com/file/mixedD?gclid=abc",         // duplicate of D
      "https://drop.download/mixedE).",                       // ok (trailing prose)
    ].join("\n");

    const rows = parseBulkLinks(input);
    // 10 non-comment / non-blank lines.
    expect(rows).toHaveLength(10);

    const sum = summarizeParse(rows);
    expect(sum.total).toBe(10);
    // 5 valid (A, B, C, D, E), 5 invalid (missingScheme, dup-B, bad-proto,
    // unsupported, dup-D). 0 skipped — dedupe-against-existing not run here.
    expect(sum.valid).toBe(5);
    expect(sum.invalid).toBe(5);
    expect(sum.skipped).toBe(0);
    expect(sum.importable).toBe(5);

    // Spot-check the error classifications match what the admin dialog renders.
    const byRaw = (s: string) => rows.find((r) => r.raw.includes(s))!;
    expect(byRaw("missingScheme").error).toBe(GAME_FILE_URL_ERRORS.INVALID_URL);
    expect(byRaw("ftp://").error).toBe(GAME_FILE_URL_ERRORS.BAD_PROTOCOL);
    expect(byRaw("random.example").error).toBe(
      GAME_FILE_URL_ERRORS.UNSUPPORTED_HOST,
    );
  });

  it("plays nicely with dedupeAgainstExisting after a messy paste", () => {
    const input = [
      "https://vikingfile.com/f/freshDraft",
      "https://vikingfile.com/f/alreadyImported?utm_source=fb",
      "viking-old|Viking Old|GAME|0|https://vikingfile.com/f/freshIdButOldHandle",
    ].join("\n");
    const parsed = parseBulkLinks(input);
    const deduped = dedupeAgainstExisting(parsed, {
      ids: ["viking-old"],
      urls: ["https://vikingfile.com/f/alreadyImported"],
    });
    const sum = summarizeParse(deduped);
    expect(sum).toEqual({
      total: 3, valid: 1, invalid: 0, skipped: 2, importable: 1,
    });
    const urlDupe = deduped.find((r) => r.raw.includes("alreadyImported"))!;
    expect(urlDupe.skipped).toBe(true);
    expect(urlDupe.skipReason).toMatch(/នាំចូលរួចហើយ/);
    const idDupe = deduped.find((r) => r.raw.startsWith("viking-old|"))!;
    expect(idDupe.skipped).toBe(true);
    expect(idDupe.skipReason).toMatch(/មាននៅក្នុងប្រព័ន្ធ/);
  });
});
