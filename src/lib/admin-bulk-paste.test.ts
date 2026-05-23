// End-to-end coverage for the admin "Add game / Bulk import" dialog flow,
// exercised purely through the same functions the dialog wires into its
// inputs:
//   • Single-URL field  →  validateGameFileUrl
//   • Bulk paste box    →  parseBulkLinks → summarizeParse → dedupeAgainstExisting
//
// These tests simulate an operator pasting realistic content into the admin
// UI (one vikingfile.com link, then a mixed bulk list with junk lines and
// duplicates) and asserts the rows + validation messages the UI would show.
// Pure unit coverage keeps the regression surface in CI without needing a
// running browser.
import { describe, it, expect } from "vitest";
import {
  validateGameFileUrl,
  GAME_FILE_URL_ERRORS,
} from "./validate-game-file";
import {
  parseBulkLinks,
  summarizeParse,
  dedupeAgainstExisting,
} from "./bulk-link-import";

describe("admin dialog — single vikingfile.com URL field", () => {
  it("accepts a canonical vikingfile.com share URL (no error message)", () => {
    expect(validateGameFileUrl("https://vikingfile.com/f/pJUUBfjqPi")).toBeNull();
  });

  it("accepts vikingfile.com with surrounding whitespace (paste from clipboard)", () => {
    expect(
      validateGameFileUrl("   https://vikingfile.com/f/pJUUBfjqPi   "),
    ).toBeNull();
  });

  it("accepts vikingfile.com with utm tracking params (still valid)", () => {
    expect(
      validateGameFileUrl(
        "https://vikingfile.com/f/pJUUBfjqPi?utm_source=fb&fbclid=xyz",
      ),
    ).toBeNull();
  });

  it("rejects vikingfile.com without a scheme as INVALID_URL", () => {
    expect(validateGameFileUrl("vikingfile.com/f/pJUUBfjqPi")).toBe(
      GAME_FILE_URL_ERRORS.INVALID_URL,
    );
  });

  it("rejects an empty string and pure whitespace as EMPTY", () => {
    expect(validateGameFileUrl("")).toBe(GAME_FILE_URL_ERRORS.EMPTY);
    expect(validateGameFileUrl("    ")).toBe(GAME_FILE_URL_ERRORS.EMPTY);
  });

  it("rejects a non-share host with UNSUPPORTED_HOST", () => {
    expect(validateGameFileUrl("https://example.com/file/abc")).toBe(
      GAME_FILE_URL_ERRORS.UNSUPPORTED_HOST,
    );
  });
});

describe("admin dialog — bulk paste box (mixed list)", () => {
  // Realistic paste the operator drops in: comment line, blank line,
  // single vikingfile link, two-column "title, url", full 5-column row,
  // a duplicate URL, junk text, and a non-share host.
  const PASTE = [
    "# new uploads — friday",
    "",
    "https://vikingfile.com/f/pJUUBfjqPi",
    "Cool Demo, https://vikingfile.com/f/AAAAAA111",
    "viking-bbb|Viking Bravo|GAME|25|https://vikingfile.com/f/BBBBBB222",
    "   https://vikingfile.com/f/CCCCCC333?utm_source=fb   ",
    "https://vikingfile.com/f/AAAAAA111", // duplicate URL within paste (same derived id)
    "totally not a url",
    "https://example.com/file/nope",
  ].join("\n");

  const rows = parseBulkLinks(PASTE);
  const summary = summarizeParse(rows);

  it("ignores the comment line and the blank line entirely", () => {
    // Both '#' and '' lines are dropped before producing a row.
    expect(rows.every((r) => r.raw !== "" && !r.raw.startsWith("#"))).toBe(true);
  });

  it("produces one row per non-empty / non-comment line", () => {
    expect(rows).toHaveLength(7);
  });

  it("parses the bare vikingfile URL into a valid draft", () => {
    const r = rows.find(
      (x) => x.raw === "https://vikingfile.com/f/pJUUBfjqPi",
    )!;
    expect(r.ok).toBe(true);
    expect(r.draft?.url).toBe("https://vikingfile.com/f/pJUUBfjqPi");
    expect(r.draft?.id).toBe("pjuubfjqpi");
    expect(r.draft?.category).toBe("GAME");
    expect(r.draft?.price_coins).toBe(0);
  });

  it("parses 'title, url' two-column form", () => {
    const r = rows.find((x) => x.raw.startsWith("Cool Demo,"))!;
    expect(r.ok).toBe(true);
    expect(r.draft?.title).toBe("Cool Demo");
    expect(r.draft?.url).toBe("https://vikingfile.com/f/AAAAAA111");
  });

  it("parses the full pipe-delimited 5-column form (id|title|category|price|url)", () => {
    const r = rows.find((x) => x.raw.startsWith("viking-bbb|"))!;
    expect(r.ok).toBe(true);
    expect(r.draft).toMatchObject({
      id: "viking-bbb",
      title: "Viking Bravo",
      category: "GAME",
      price_coins: 25,
      url: "https://vikingfile.com/f/BBBBBB222",
    });
  });

  it("trims whitespace and strips tracking params on the third URL", () => {
    const r = rows.find((x) => x.raw.includes("CCCCCC333"))!;
    expect(r.ok).toBe(true);
    expect(r.draft?.url).toBe("https://vikingfile.com/f/CCCCCC333");
  });

  it("flags the in-paste duplicate as an error (same derived id)", () => {
    // Both lines produce id "aaaaaa111" from the URL; the second occurrence
    // (the bare URL row) is rejected with a "ស្ទួន" (duplicate) error.
    const twoCol = rows.find((x) => x.raw.startsWith("Cool Demo,"))!;
    const bareDup = rows.find(
      (x) => x.raw === "https://vikingfile.com/f/AAAAAA111",
    )!;
    expect(twoCol.ok).toBe(true);
    expect(twoCol.draft?.id).toBe("aaaaaa111");
    expect(bareDup.ok).toBe(false);
    expect(bareDup.error).toMatch(/ស្ទួន/);
  });

  it("rejects 'totally not a url' with an INVALID_URL message", () => {
    const r = rows.find((x) => x.raw === "totally not a url")!;
    expect(r.ok).toBe(false);
    expect(r.error).toBe(GAME_FILE_URL_ERRORS.INVALID_URL);
  });

  it("rejects an unsupported host with UNSUPPORTED_HOST", () => {
    const r = rows.find((x) => x.raw === "https://example.com/file/nope")!;
    expect(r.ok).toBe(false);
    expect(r.error).toBe(GAME_FILE_URL_ERRORS.UNSUPPORTED_HOST);
  });

  it("summary counts match what the admin dialog header would render", () => {
    // 4 valid (3 unique vikingfile + 1 pipe-delimited), 3 invalid
    // (in-paste duplicate, junk, unsupported host), 0 skipped (no DB dedupe yet).
    expect(summary).toEqual({
      total: 7,
      valid: 4,
      invalid: 3,
      skipped: 0,
      importable: 4,
    });
  });
});

describe("admin dialog — bulk paste dedupe against existing library", () => {
  const PASTE = [
    "https://vikingfile.com/f/pJUUBfjqPi",       // collides on URL
    "viking-new|Viking New|GAME|10|https://vikingfile.com/f/NEWNEW111",
    "viking-existing|Viking Old|GAME|5|https://vikingfile.com/f/OLDOLD222", // collides on id
  ].join("\n");

  it("marks URL and id collisions as skipped with human-readable reasons", () => {
    const parsed = parseBulkLinks(PASTE);
    const deduped = dedupeAgainstExisting(parsed, {
      ids: ["viking-existing"],
      urls: ["https://vikingfile.com/f/pJUUBfjqPi"],
    });
    const summary = summarizeParse(deduped);

    const urlDup = deduped.find((r) =>
      r.raw.endsWith("/f/pJUUBfjqPi"),
    )!;
    expect(urlDup.skipped).toBe(true);
    expect(urlDup.skipReason).toMatch(/នាំចូលរួចហើយ/);

    const idDup = deduped.find((r) => r.raw.startsWith("viking-existing|"))!;
    expect(idDup.skipped).toBe(true);
    expect(idDup.skipReason).toMatch(/មាននៅក្នុងប្រព័ន្ធរួចហើយ/);

    const fresh = deduped.find((r) => r.raw.startsWith("viking-new|"))!;
    expect(fresh.ok).toBe(true);

    expect(summary).toEqual({
      total: 3,
      valid: 1,
      invalid: 0,
      skipped: 2,
      importable: 1,
    });
  });
});
