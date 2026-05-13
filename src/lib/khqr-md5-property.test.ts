import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createHash } from "crypto";
import { encodeKhqr } from "@/lib/khqr-encode";

// ======================================================
// MD5
// ======================================================

const md5Hex = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

// ======================================================
// ASCII GENERATOR
// ======================================================

const ascii = (min: number, max: number) =>
  fc
    .string({
      minLength: min,
      maxLength: max,
      unit: "grapheme-ascii",
    })
    .filter((s) => /^[\x20-\x7E]+$/.test(s));

// ======================================================
// RANDOM KHQR INPUT
// ======================================================

const khqrInput = fc.record({
  accountId: ascii(3, 32).map((s) => `${s.replace(/\s/g, "_")}@bkrt`),

  merchantName: ascii(1, 25),

  merchantCity: ascii(1, 15),

  currency: fc.constantFrom<"USD" | "KHR">("USD", "KHR"),

  amount: fc
    .double({
      min: 0.01,
      max: 9999.99,
      noNaN: true,
      noDefaultInfinity: true,
    })
    .map((n) => Number(n.toFixed(2))),

  mobileNumber: fc.stringMatching(/^[0-9]{8,15}$/),

  storeLabel: ascii(1, 25),

  terminalLabel: ascii(1, 25),

  billNumber: ascii(1, 25),
});

// ======================================================
// TESTS
// ======================================================

describe("KHQR Property Tests", () => {
  // ==================================================
  // MD5 always matches QR
  // ==================================================

  it("bakong_md5 always equals md5(qr_string)", async () => {
    await fc.assert(
      fc.asyncProperty(khqrInput, async (input) => {
        const result = await encodeKhqr(input);

        const qr = result.qr;

        const expectedMd5 = md5Hex(qr);

        expect(typeof qr).toBe("string");

        expect(qr.length).toBeGreaterThanOrEqual(50);

        expect(qr.startsWith("0002")).toBe(true);

        expect(expectedMd5).toMatch(/^[a-f0-9]{32}$/);

        // If encoder returns md5
        if (result.md5) {
          expect(result.md5).toBe(expectedMd5);
        }
      }),
      {
        numRuns: 200,
      },
    );
  });

  // ==================================================
  // Mutation changes md5
  // ==================================================

  it("single-character mutation changes md5", async () => {
    await fc.assert(
      fc.asyncProperty(khqrInput, fc.nat(), async (input, seed) => {
        const result = await encodeKhqr(input);

        const qr = result.qr;

        const originalMd5 = md5Hex(qr);

        const idx = seed % qr.length;

        const originalChar = qr[idx];

        // Swap character safely
        const mutatedChar = originalChar === "A" ? "B" : "A";

        const tampered = qr.slice(0, idx) + mutatedChar + qr.slice(idx + 1);

        fc.pre(tampered !== qr);

        const tamperedMd5 = md5Hex(tampered);

        expect(tamperedMd5).not.toBe(originalMd5);
      }),
      {
        numRuns: 100,
      },
    );
  });

  // ==================================================
  // Different bill numbers
  // ==================================================

  it("different billNumbers create different qr+md5", async () => {
    await fc.assert(
      fc.asyncProperty(
        khqrInput,
        ascii(1, 25),
        ascii(1, 25),

        async (base, billA, billB) => {
          fc.pre(billA !== billB);

          const a = await encodeKhqr({
            ...base,
            billNumber: billA,
          });

          const b = await encodeKhqr({
            ...base,
            billNumber: billB,
          });

          expect(a.qr).not.toBe(b.qr);

          expect(md5Hex(a.qr)).not.toBe(md5Hex(b.qr));

          if (a.md5 && b.md5) {
            expect(a.md5).not.toBe(b.md5);
          }
        },
      ),
      {
        numRuns: 100,
      },
    );
  });

  // ==================================================
  // CRC exists
  // ==================================================

  it("generated qr contains CRC", async () => {
    await fc.assert(
      fc.asyncProperty(khqrInput, async (input) => {
        const { qr } = await encodeKhqr(input);

        expect(qr.includes("6304")).toBe(true);

        expect(qr.slice(-4)).toMatch(/^[A-F0-9]{4}$/);
      }),
      {
        numRuns: 100,
      },
    );
  });
});
