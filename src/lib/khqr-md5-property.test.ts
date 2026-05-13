import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createHash } from "crypto";
import { encodeKhqr } from "@/lib/khqr-encode";

const md5Hex = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

// EMVCo TLV fields have hard length caps; arbitraries respect them so
// encodeKhqr never throws. We restrict to printable ASCII (KHQR is ASCII-only).
const ascii = (min: number, max: number) =>
  fc.string({ unit: "grapheme-ascii", minLength: min, maxLength: max })
    .filter((s) => /^[\x20-\x7E]+$/.test(s));

const khqrInput = fc.record({
  accountId: ascii(3, 32).map((s) => `${s.replace(/\s/g, "_")}@bkrt`),
  merchantName: ascii(1, 25),
  merchantCity: ascii(1, 15),
  currency: fc.constantFrom<"USD" | "KHR">("USD", "KHR"),
  amount: fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true })
    .map((n) => Number(n.toFixed(2))),
  mobileNumber: fc.stringMatching(/^[0-9]{8,15}$/),
  storeLabel: ascii(1, 25),
  terminalLabel: ascii(1, 25),
  billNumber: ascii(1, 25),
});

describe("property: bakong_md5 always equals md5(qr_string)", () => {
  it("holds for any valid KHQR input (200 random cases)", () => {
    fc.assert(
      fc.property(khqrInput, (input) => {
        const { qr, md5 } = encodeKhqr(input);

        // Structural invariants
        expect(typeof qr).toBe("string");
        expect(qr.length).toBeGreaterThanOrEqual(50);
        expect(qr.startsWith("0002")).toBe(true);

        // Encoder's own md5 == hash of returned qr
        expect(md5).toBe(md5Hex(qr));
        // 32-char lowercase hex
        expect(md5).toMatch(/^[a-f0-9]{32}$/);
      }),
      { numRuns: 200 },
    );
  });

  it("any single-character mutation of qr_string breaks the md5 match", () => {
    fc.assert(
      fc.property(khqrInput, fc.nat(), (input, seed) => {
        const { qr, md5 } = encodeKhqr(input);
        const idx = seed % qr.length;
        const ch = qr.charCodeAt(idx);
        const swapped = String.fromCharCode(ch === 65 ? 66 : 65); // 'A' or 'B'
        const tampered = qr.slice(0, idx) + swapped + qr.slice(idx + 1);
        if (tampered === qr) return; // unchanged, skip
        expect(md5Hex(tampered)).not.toBe(md5);
      }),
      { numRuns: 100 },
    );
  });

  it("two distinct inputs with different billNumber produce distinct qr+md5", () => {
    fc.assert(
      fc.property(khqrInput, ascii(1, 25), ascii(1, 25), (base, billA, billB) => {
        fc.pre(billA !== billB);
        const a = encodeKhqr({ ...base, billNumber: billA });
        const b = encodeKhqr({ ...base, billNumber: billB });
        expect(a.qr).not.toBe(b.qr);
        expect(a.md5).not.toBe(b.md5);
        expect(md5Hex(a.qr)).toBe(a.md5);
        expect(md5Hex(b.qr)).toBe(b.md5);
      }),
      { numRuns: 100 },
    );
  });
});
