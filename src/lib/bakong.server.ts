// Bakong KHQR builder + Open API client.
// Server-only: reads BAKONG_* env at call time.
import { createHash } from "crypto";

// EMVCo TLV helper: 2-digit id + 2-digit length + value
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — KHQR / EMVCo spec
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (!v && fallback === undefined) throw new Error(`Missing env: ${name}`);
  return (v ?? fallback)!;
}

/**
 * Build an amount-bound KHQR payload for a one-time bill.
 * billNumber must be unique per request so MD5 hash is unique.
 */
export function buildKhqr(amountUsd: number, billNumber: string): string {
  const accountId = env("BAKONG_ACCOUNT_ID");
  const merchantName = env("BAKONG_MERCHANT_NAME", "DynaStore").slice(0, 25);
  const merchantCity = env("BAKONG_MERCHANT_CITY", "Phnom Penh").slice(0, 15);
  const acquiringBank = env("BAKONG_ACQUIRING_BANK", "");
  const phone = env("BAKONG_MERCHANT_PHONE", "");

  // Merchant account info (tag 29) — Bakong KHQR individual/merchant spec.
  // Subtag 00 MUST be the Bakong GUID; subtag 01 is the Bakong account ID
  // (e.g. "username@aclb"). Anything else triggers Q0626 "invalid QR" on ABA/ACLEDA.
  const mai =
    tlv("00", "kh.gov.nbc.bakong") +
    tlv("01", accountId);
  const merchantAccountInfo = tlv("29", mai);
  // acquiringBank kept in env for display/labelling only — NOT part of tag 29.
  void acquiringBank;

  // Additional data (tag 62): bill number + store label (phone)
  let additional = tlv("01", billNumber.slice(0, 25));
  if (phone) additional += tlv("03", phone.slice(0, 25));
  const additionalData = tlv("62", additional);

  // USD = currency 840, KHR = 116. We use USD here.
  const amount = amountUsd.toFixed(2);

  const payloadNoCrc =
    tlv("00", "01") +                            // payload format indicator
    tlv("01", "12") +                            // point-of-init: 12 = dynamic (amount-bound)
    merchantAccountInfo +
    tlv("52", "5999") +                          // MCC: misc
    tlv("53", "840") +                           // currency: USD
    tlv("54", amount) +                          // amount
    tlv("58", "KH") +                            // country
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    additionalData +
    "6304";                                      // CRC tag + length placeholder
  const crc = crc16(payloadNoCrc);
  return payloadNoCrc + crc;
}

export function md5Hex(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

const BAKONG_API = "https://api-bakong.nbc.gov.kh";

export type BakongCheckResult = {
  responseCode: number;
  responseMessage: string;
  data?: {
    hash: string;
    fromAccountId?: string;
    toAccountId?: string;
    currency?: string;
    amount?: number;
    description?: string;
    createdDateMs?: number;
    acknowledgedDateMs?: number;
    [k: string]: unknown;
  } | null;
};

export class BakongApiError extends Error {
  constructor(
    public kind: "rate_limited" | "upstream_error" | "network_error" | "auth_error",
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "BakongApiError";
  }
}

// ---- Token store: DB-backed, falls back to env ----
// We cannot rewrite the BAKONG_DEVELOPER_TOKEN secret at runtime, so a renewed
// token is persisted in public.bakong_token (singleton row id=1).
async function loadStoredToken(): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bakong_token")
      .select("token")
      .eq("id", 1)
      .maybeSingle();
    return data?.token ?? null;
  } catch {
    return null;
  }
}

async function saveStoredToken(token: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("bakong_token")
    .upsert({ id: 1, token, updated_at: new Date().toISOString() });
}

async function getActiveToken(): Promise<string> {
  const stored = await loadStoredToken();
  if (stored) return stored;
  return env("BAKONG_DEVELOPER_TOKEN");
}

/**
 * Exchange the current token for a fresh one via Bakong's /v1/renew_token.
 * Works even if expired, as long as it was issued for the same email.
 * Persists the new token to the DB.
 */
export async function renewBakongToken(): Promise<string> {
  const current = await getActiveToken();
  const res = await fetch(`${BAKONG_API}/v1/renew_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${current}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new BakongApiError(
      "auth_error",
      res.status,
      `Bakong renew_token failed (${res.status}). Re-register at https://api-bakong.nbc.gov.kh/register.`,
    );
  }
  const json = (await res.json()) as { data?: { token?: string } };
  const newToken = json?.data?.token;
  if (!newToken) {
    throw new BakongApiError("auth_error", res.status, `Bakong renew_token: no token in response`);
  }
  await saveStoredToken(newToken);
  console.log("[bakong] developer token auto-renewed");
  return newToken;
}

export async function checkTransactionByMd5(
  md5: string,
  opts: { retries?: number; _renewed?: boolean } = {},
): Promise<BakongCheckResult> {
  const token = await getActiveToken();
  const retries = opts.retries ?? 2;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BAKONG_API}/v1/check_transaction_by_md5`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ md5 }),
      });

      // Hard auth errors — try one auto-renew, then give up.
      if (res.status === 401 || res.status === 403) {
        if (!opts._renewed) {
          try {
            await renewBakongToken();
            return await checkTransactionByMd5(md5, { ...opts, _renewed: true });
          } catch (renewErr) {
            throw renewErr instanceof BakongApiError
              ? renewErr
              : new BakongApiError("auth_error", res.status, `Bakong auth failed and renew failed (${res.status})`);
          }
        }
        throw new BakongApiError("auth_error", res.status, `Bakong auth failed after renew (${res.status})`);
      }
      if (res.status === 429) {
        lastErr = new BakongApiError("rate_limited", 429, "Bakong rate-limited");
      } else if (res.status >= 500) {
        lastErr = new BakongApiError("upstream_error", res.status, `Bakong ${res.status}`);
      } else {
        const text = await res.text();
        try {
          return JSON.parse(text) as BakongCheckResult;
        } catch {
          throw new BakongApiError("upstream_error", res.status, `Non-JSON response: ${text.slice(0, 200)}`);
        }
      }
    } catch (e) {
      if (e instanceof BakongApiError && e.kind === "auth_error") throw e;
      lastErr = e instanceof BakongApiError ? e : new BakongApiError(
        "network_error", 0,
        e instanceof Error ? e.message : "Bakong fetch failed",
      );
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new BakongApiError("network_error", 0, "unknown");
}
