// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { execSync } from "child_process";
import { randomUUID, createHash } from "crypto";

/**
 * Integration tests against the live Lovable Cloud database.
 *
 * Verify the three CHECK constraints added on public.transactions block any
 * write that would store an inconsistent (qr_string, bakong_md5) pair:
 *   - transactions_qr_string_shape   (KHQR must look like a real EMVCo QR)
 *   - transactions_bakong_md5_shape  (md5 must be 32-char lowercase hex)
 *   - transactions_md5_matches_qr    (bakong_md5 must equal md5(qr_string))
 *
 * Uses psql via the PG* env vars provided to the sandbox.
 */

import { encodeKhqr } from "@/lib/khqr-encode";

const md5Hex = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

function freshValidQr() {
  const { qr } = encodeKhqr({
    accountId: "dyna_store@bkrt",
    merchantName: "Dyna Store",
    merchantCity: "PHNOM PENH",
    currency: "USD",
    amount: 1.00,
    mobileNumber: "85512345678",
    storeLabel: "Dyna Store",
    terminalLabel: "vitest",
    billNumber: `vt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  });
  return qr;
}

const tag = `vitest_${Date.now()}`;
const inserted: string[] = [];

function tryInsert(orderId: string, qr: string, md5: string) {
  const sql = `INSERT INTO public.transactions
    (order_id, user_id, bakong_md5, qr_string, amount_usd, coins, expires_at)
    VALUES ('${orderId}', '${randomUUID()}', '${md5}', '${qr}', 1, 1,
            now() + interval '5 minutes');`;
  try {
    execSync(`psql -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"')}"`, {
      stdio: "pipe",
    });
    inserted.push(orderId);
    return { ok: true, error: null as string | null };
  } catch (e: any) {
    return { ok: false, error: String(e.stderr ?? e.message ?? e) };
  }
}

afterAll(() => {
  // Best-effort cleanup of any rows that unexpectedly succeeded.
  for (const orderId of inserted) {
    try {
      execSync(`psql -c "DELETE FROM public.transactions WHERE order_id = '${orderId}'"`, { stdio: "pipe" });
    } catch {}
  }
});

describe("DB integrity: transactions CHECK constraints block inconsistent payloads", () => {
  it("baseline — a fully consistent (qr, md5(qr)) pair INSERTs successfully", () => {
    const orderId = `${tag}_baseline_${randomUUID()}`;
    const qr = freshValidQr();
    const r = tryInsert(orderId, qr, md5Hex(qr));
    expect(r.ok).toBe(true);
  });

  it("rejects md5 that does NOT match md5(qr_string) (transactions_md5_matches_qr)", () => {
    const orderId = `${tag}_mismatch_${randomUUID()}`;
    const qr = freshValidQr();
    const wrongMd5 = md5Hex(qr + "x"); // valid hex shape, wrong value
    const r = tryInsert(orderId, qr, wrongMd5);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/transactions_md5_matches_qr|check constraint/i);
  });

  it("rejects bakong_md5 that is not 32-char lowercase hex (transactions_bakong_md5_shape)", () => {
    const orderId = `${tag}_md5shape_${randomUUID()}`;
    const r = tryInsert(orderId, freshValidQr(), "NOT-A-VALID-MD5");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/transactions_bakong_md5_shape|check constraint/i);
  });

  it("rejects bakong_md5 with uppercase hex (must be lowercase)", () => {
    const orderId = `${tag}_md5upper_${randomUUID()}`;
    const qr = freshValidQr();
    const upper = md5Hex(qr).toUpperCase();
    const r = tryInsert(orderId, qr, upper);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/transactions_bakong_md5_shape|check constraint/i);
  });

  it("rejects qr_string shorter than 50 characters (transactions_qr_string_shape)", () => {
    const orderId = `${tag}_short_${randomUUID()}`;
    const tooShort = "0002short";
    const r = tryInsert(orderId, tooShort, md5Hex(tooShort));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/transactions_qr_string_shape|check constraint/i);
  });

  it("rejects qr_string that does not start with '0002' (transactions_qr_string_shape)", () => {
    const orderId = `${tag}_badprefix_${randomUUID()}`;
    const wrongPrefix = "9999" + freshValidQr().slice(4);
    const r = tryInsert(orderId, wrongPrefix, md5Hex(wrongPrefix));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/transactions_qr_string_shape|check constraint/i);
  });

  it("rejects empty-object legacy payload `{}` (caught by qr_string_shape AND md5_matches_qr)", () => {
    const orderId = `${tag}_legacy_${randomUUID()}`;
    const r = tryInsert(orderId, "{}", "70bc8f4b72a86921468bf8e8441dce51");
    expect(r.ok).toBe(false);
    // either constraint is acceptable
    expect(r.error).toMatch(/transactions_(qr_string_shape|md5_matches_qr|bakong_md5_shape)|check constraint/i);
  });
});
