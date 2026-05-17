// Bakong server-side helpers — KHQR builder, MD5, and authenticated
// transaction lookup with auto-renew + failure logging.
//
// IMPORTANT: tag 29 subtag 00 MUST be the literal "kh.gov.nbc.bakong"
// and subtag 01 is the Bakong account ID. Swapping them causes Q0626
// rejection on ABA/ACLEDA.

import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Env helpers (read inside functions so secrets aren't bundled at module init)
// ---------------------------------------------------------------------------
const env = (k: string, fallback = "") => process.env[k] ?? fallback;

// ---------------------------------------------------------------------------
// TLV / CRC16 / MD5
// ---------------------------------------------------------------------------
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function md5Hex(input: string): string {
  return crypto.createHash("md5").update(input, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// KHQR builder — Q0626-safe
// ---------------------------------------------------------------------------
export function buildKhqr(amountUsd: number, billNumber: string): string {
  const accountId = env("BAKONG_ACCOUNT_ID");
  const merchantName = env("BAKONG_MERCHANT_NAME", "Dyna Store").slice(0, 25);
  const merchantCity = env("BAKONG_MERCHANT_CITY", "Phnom Penh").slice(0, 15);
  const phone = env("BAKONG_MERCHANT_PHONE");

  // CORRECT: subtag 00 = scheme GUID, subtag 01 = account ID.
  const merchantAccountInfo = tlv(
    "29",
    tlv("00", "kh.gov.nbc.bakong") + tlv("01", accountId),
  );

  let additional = tlv("01", billNumber.slice(0, 25));
  if (phone) additional += tlv("03", phone.slice(0, 25));
  const additionalData = tlv("62", additional);

  const amount = amountUsd.toFixed(2);
  const payloadNoCrc =
    tlv("00", "01") +
    tlv("01", "12") +
    merchantAccountInfo +
    tlv("52", "5999") +
    tlv("53", "840") +
    tlv("54", amount) +
    tlv("58", "KH") +
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    additionalData +
    "6304";

  return payloadNoCrc + crc16(payloadNoCrc);
}

// ---------------------------------------------------------------------------
// Bakong API client with auth retry + structured failure logging
// ---------------------------------------------------------------------------
export class BakongApiError extends Error {
  status: number;
  code: string;
  /** Alias of `code` kept for legacy callers (topup.functions.ts). */
  kind: string;
  snippet: string;
  constructor(code: string, status: number, message: string, snippet = "") {
    super(message);
    this.name = "BakongApiError";
    this.code = code;
    this.kind = code;
    this.status = status;
    this.snippet = snippet;
  }
}

const BAKONG_BASE = "https://api-bakong.nbc.gov.kh";

function fingerprint(token: string): string {
  if (!token) return "";
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);
}

async function getStoredToken(): Promise<{ token: string; source: "db" | "env" } | null> {
  try {
    const { data } = await supabaseAdmin
      .from("bakong_token")
      .select("token")
      .eq("id", 1)
      .maybeSingle();
    if (data?.token) return { token: data.token, source: "db" };
  } catch (_) { /* fall through to env */ }
  const t = env("BAKONG_DEVELOPER_TOKEN");
  return t ? { token: t, source: "env" } : null;
}

async function renewToken(): Promise<{ token: string } | null> {
  // Bakong's renewal endpoint expects an existing (possibly-expired) token.
  const current = await getStoredToken();
  if (!current) return null;
  try {
    const res = await fetch(`${BAKONG_BASE}/v1/renew_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${current.token}`,
      },
      body: JSON.stringify({}),
    });
    const json: any = await res.json().catch(() => ({}));
    const newToken: string | undefined =
      json?.data?.token ?? json?.token ?? json?.data?.access_token;
    if (!res.ok || !newToken) return null;
    await supabaseAdmin
      .from("bakong_token")
      .upsert({ id: 1, token: newToken, updated_at: new Date().toISOString() });
    return { token: newToken };
  } catch {
    return null;
  }
}

async function logAuthFailure(entry: {
  endpoint: string;
  http_status: number;
  token_source: string;
  token_fingerprint: string;
  token_length: number;
  response_snippet: string;
  renew_attempted: boolean;
  renew_succeeded: boolean | null;
  request_id: string;
  context?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("bakong_auth_failures").insert(entry);
  } catch (e) {
    console.error("[bakong] failed to log auth failure", e);
  }
}

export async function checkTransactionByMd5(md5: string): Promise<any> {
  const requestId = crypto.randomUUID();
  const endpoint = `${BAKONG_BASE}/v1/check_transaction_by_md5`;

  const callOnce = async (token: string) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ md5 }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return { status: res.status, ok: res.ok, json, text };
  };

  const first = await getStoredToken();
  if (!first) {
    throw new BakongApiError("missing_token", 0, "No Bakong developer token available");
  }

  let attempt = await callOnce(first.token);
  if (attempt.status === 401 || attempt.status === 403) {
    const renewed = await renewToken();
    await logAuthFailure({
      endpoint,
      http_status: attempt.status,
      token_source: first.source,
      token_fingerprint: fingerprint(first.token),
      token_length: first.token.length,
      response_snippet: attempt.text.slice(0, 500),
      renew_attempted: true,
      renew_succeeded: !!renewed,
      request_id: requestId,
      context: { md5 },
    });
    if (!renewed) {
      throw new BakongApiError(
        "auth_error",
        attempt.status,
        "Bakong auth failed and token renewal also failed",
        attempt.text.slice(0, 500),
      );
    }
    attempt = await callOnce(renewed.token);
    if (attempt.status === 401 || attempt.status === 403) {
      throw new BakongApiError(
        "auth_error",
        attempt.status,
        "Bakong auth still failing after renewal",
        attempt.text.slice(0, 500),
      );
    }
  }

  if (!attempt.ok && attempt.json == null) {
    throw new BakongApiError(
      "http_error",
      attempt.status,
      `Bakong returned HTTP ${attempt.status}`,
      attempt.text.slice(0, 500),
    );
  }
  return attempt.json ?? { responseCode: -1, raw: attempt.text };
}
