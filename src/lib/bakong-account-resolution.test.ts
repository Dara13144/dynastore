import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Supabase admin client BEFORE importing the SUT so the import in
// bakong.server.ts picks up the mocked module.
const maybeSingleMock = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }),
  },
}));

import { getEffectiveBakongAccountId, buildKhqr } from "./bakong.server";

const ENV_DEFAULT = "ben_sothida@bkrt";

describe("getEffectiveBakongAccountId — DB > env > default precedence", () => {
  const originalEnv = process.env.BAKONG_ACCOUNT_ID;

  beforeEach(() => {
    maybeSingleMock.mockReset();
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.BAKONG_ACCOUNT_ID;
    else process.env.BAKONG_ACCOUNT_ID = originalEnv;
  });

  it("uses app_settings.bakong_account_id when present (DB wins over env)", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockResolvedValue({
      data: { bakong_account_id: "from_db@bkrt" },
      error: null,
    });

    const id = await getEffectiveBakongAccountId();
    expect(id).toBe("from_db@bkrt");
  });

  it("trims whitespace from the DB value", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockResolvedValue({
      data: { bakong_account_id: "   spaced@bkrt   " },
      error: null,
    });

    expect(await getEffectiveBakongAccountId()).toBe("spaced@bkrt");
  });

  it("falls back to env when DB value is null", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockResolvedValue({
      data: { bakong_account_id: null },
      error: null,
    });

    expect(await getEffectiveBakongAccountId()).toBe("from_env@bkrt");
  });

  it("falls back to env when DB value is an empty string", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockResolvedValue({
      data: { bakong_account_id: "" },
      error: null,
    });

    expect(await getEffectiveBakongAccountId()).toBe("from_env@bkrt");
  });

  it("falls back to env when DB value is whitespace only", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockResolvedValue({
      data: { bakong_account_id: "   " },
      error: null,
    });

    expect(await getEffectiveBakongAccountId()).toBe("from_env@bkrt");
  });

  it("falls back to env when the app_settings row does not exist", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    expect(await getEffectiveBakongAccountId()).toBe("from_env@bkrt");
  });

  it("falls back to hard-coded default when DB is null AND env is unset", async () => {
    delete process.env.BAKONG_ACCOUNT_ID;
    maybeSingleMock.mockResolvedValue({
      data: { bakong_account_id: null },
      error: null,
    });

    expect(await getEffectiveBakongAccountId()).toBe(ENV_DEFAULT);
  });

  it("falls back to env when the DB query throws", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockRejectedValue(new Error("db unreachable"));

    expect(await getEffectiveBakongAccountId()).toBe("from_env@bkrt");
  });
});

describe("buildKhqr — uses resolved account id in the payload", () => {
  const originalEnv = process.env.BAKONG_ACCOUNT_ID;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.BAKONG_ACCOUNT_ID;
    else process.env.BAKONG_ACCOUNT_ID = originalEnv;
  });

  it("embeds the DB-resolved account id when passed as override", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockResolvedValue({
      data: { bakong_account_id: "from_db@bkrt" },
      error: null,
    });

    const accountId = await getEffectiveBakongAccountId();
    const payload = buildKhqr(1, "BILL123", accountId);
    expect(payload).toContain("from_db@bkrt");
    expect(payload).not.toContain("from_env@bkrt");
  });

  it("embeds the env account id when DB is empty", async () => {
    process.env.BAKONG_ACCOUNT_ID = "from_env@bkrt";
    maybeSingleMock.mockResolvedValue({
      data: { bakong_account_id: null },
      error: null,
    });

    const accountId = await getEffectiveBakongAccountId();
    const payload = buildKhqr(1, "BILL123", accountId);
    expect(payload).toContain("from_env@bkrt");
  });
});
