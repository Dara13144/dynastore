import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { tryInsertOrReuseTopup } from "@/lib/topup-reuse";
import { ReusedTopupBanner } from "@/components/ReusedTopupBanner";

const PACK = { name: "Add $5", price: 5, coins: 500, bonus: 0 };
const USER_ID = "user-123";

const DUP_ERR = {
  message:
    'duplicate key value violates unique constraint "transactions_md5_key"',
};

const FIXED_MD5 = "a".repeat(32);
const NOW = new Date("2026-05-13T10:00:00Z").getTime();

function makeBuild(md5 = FIXED_MD5) {
  return vi.fn(() => ({ md5, payload: `KHQR_PAYLOAD_${md5.slice(0, 6)}`, billNumber: `BILL_${md5.slice(0, 6)}` }));
}

describe("tryInsertOrReuseTopup — md5 collision handling", () => {
  it("reuses an existing pending row for the same user/pack and returns reusedTx metadata", async () => {
    const existing = {
      id: "tx-existing-1",
      user_id: USER_ID,
      status: "pending",
      created_at: "2026-05-13T09:55:00Z",
      expires_at: "2026-05-13T10:10:00Z",
      amount_usd: 5,
      coins: 500,
      qr_payload: "EXISTING_PAYLOAD",
    };

    const insert = vi.fn().mockResolvedValueOnce({ error: DUP_ERR });
    const fetchByMd5 = vi.fn().mockResolvedValueOnce({ data: existing });

    const result = await tryInsertOrReuseTopup({
      userId: USER_ID,
      pack: PACK,
      deps: { build: makeBuild(), insert, fetchByMd5, now: () => NOW },
    });

    expect(result.reused).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(fetchByMd5).toHaveBeenCalledWith(FIXED_MD5);
    if (!result.reused) throw new Error("expected reused");
    expect(result.md5).toBe(FIXED_MD5);
    expect(result.qrPayload).toBe("EXISTING_PAYLOAD");
    expect(result.reusedTx).toEqual({
      id: "tx-existing-1",
      status: "pending",
      createdAt: "2026-05-13T09:55:00Z",
      expiresAt: "2026-05-13T10:10:00Z",
      amountUsd: 5,
      coins: 500,
    });
  });

  it("retries with a new bill number when collision belongs to another user", async () => {
    const otherUserRow = {
      id: "tx-other",
      user_id: "someone-else",
      status: "pending",
      created_at: "2026-05-13T09:55:00Z",
      expires_at: "2026-05-13T10:10:00Z",
      amount_usd: 5,
      coins: 500,
      qr_payload: "OTHER",
    };
    const build = vi
      .fn()
      .mockReturnValueOnce({ md5: "b".repeat(32), payload: "P1", billNumber: "BILL_B" })
      .mockReturnValueOnce({ md5: "c".repeat(32), payload: "P2", billNumber: "BILL_C" });
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: DUP_ERR })
      .mockResolvedValueOnce({ error: null });
    const fetchByMd5 = vi.fn().mockResolvedValueOnce({ data: otherUserRow });

    const result = await tryInsertOrReuseTopup({
      userId: USER_ID,
      pack: PACK,
      deps: { build, insert, fetchByMd5, now: () => NOW },
    });

    expect(insert).toHaveBeenCalledTimes(2);
    expect(result.reused).toBeFalsy();
    expect(result.md5).toBe("c".repeat(32));
  });

  it("does not reuse an expired row — retries instead", async () => {
    const expired = {
      id: "tx-expired",
      user_id: USER_ID,
      status: "pending",
      created_at: "2026-05-13T09:00:00Z",
      expires_at: "2026-05-13T09:30:00Z", // past
      amount_usd: 5,
      coins: 500,
      qr_payload: "OLD",
    };
    const build = vi
      .fn()
      .mockReturnValueOnce({ md5: "d".repeat(32), payload: "P1", billNumber: "BILL_D" })
      .mockReturnValueOnce({ md5: "e".repeat(32), payload: "P2", billNumber: "BILL_E" });
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: DUP_ERR })
      .mockResolvedValueOnce({ error: null });
    const fetchByMd5 = vi.fn().mockResolvedValueOnce({ data: expired });

    const result = await tryInsertOrReuseTopup({
      userId: USER_ID,
      pack: PACK,
      deps: { build, insert, fetchByMd5, now: () => NOW },
    });

    expect(result.reused).toBeFalsy();
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it("throws when all retries collide unrecoverably", async () => {
    const insert = vi.fn().mockResolvedValue({ error: DUP_ERR });
    const fetchByMd5 = vi.fn().mockResolvedValue({ data: null });

    await expect(
      tryInsertOrReuseTopup({
        userId: USER_ID,
        pack: PACK,
        deps: { build: makeBuild(), insert, fetchByMd5, now: () => NOW },
        maxAttempts: 2,
      }),
    ).rejects.toThrow(/duplicate key/);
    expect(insert).toHaveBeenCalledTimes(2);
  });
});

describe("ReusedTopupBanner UI", () => {
  it("renders the reused tx id, status, amount, created and expires", () => {
    render(
      <ReusedTopupBanner
        info={{
          id: "tx-existing-1",
          status: "pending",
          createdAt: "2026-05-13T09:55:00Z",
          expiresAt: "2026-05-13T10:10:00Z",
          amountUsd: 5,
          coins: 500,
        }}
      />,
    );

    expect(screen.getByTestId("reused-topup-banner")).toBeInTheDocument();
    expect(screen.getByText(/Reused existing pending KHQR/i)).toBeInTheDocument();
    expect(screen.getByTestId("reused-tx-id")).toHaveTextContent("tx-existing-1");
    expect(screen.getByTestId("reused-tx-status")).toHaveTextContent(/pending/i);
    expect(screen.getByTestId("reused-tx-amount")).toHaveTextContent(
      "$5.00 · 500 coins",
    );
    expect(screen.getByTestId("reused-tx-created")).toHaveTextContent(
      new Date("2026-05-13T09:55:00Z").toLocaleString(),
    );
    expect(screen.getByTestId("reused-tx-expires")).toHaveTextContent(
      new Date("2026-05-13T10:10:00Z").toLocaleString(),
    );
  });
});

describe("end-to-end: backend collision → UI banner", () => {
  it("backend reuse output feeds the UI banner with matching fields", async () => {
    const existing = {
      id: "tx-e2e",
      user_id: USER_ID,
      status: "pending",
      created_at: "2026-05-13T09:50:00Z",
      expires_at: "2026-05-13T10:05:00Z",
      amount_usd: 5,
      coins: 500,
      qr_payload: "PAYLOAD_E2E",
    };
    const insert = vi.fn().mockResolvedValueOnce({ error: DUP_ERR });
    const fetchByMd5 = vi.fn().mockResolvedValueOnce({ data: existing });

    const result = await tryInsertOrReuseTopup({
      userId: USER_ID,
      pack: PACK,
      deps: { build: makeBuild(), insert, fetchByMd5, now: () => NOW },
    });
    if (!result.reused) throw new Error("expected reused");

    render(<ReusedTopupBanner info={result.reusedTx} />);
    expect(screen.getByTestId("reused-tx-id")).toHaveTextContent("tx-e2e");
    expect(screen.getByTestId("reused-tx-status")).toHaveTextContent("pending");
    expect(screen.getByTestId("reused-tx-amount")).toHaveTextContent(
      "$5.00 · 500 coins",
    );
  });
});
