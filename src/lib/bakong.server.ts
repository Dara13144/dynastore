// src/lib/bakong.server.ts
// SERVER ONLY

import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
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

const ENV_BAKONG_ACCOUNT_ID = "ben_sothida@bkrt";

/**
 * Resolve the effective Bakong account ID: prefer the live value stored in
 * app_settings.bakong_account_id (admin-editable), fall back to env var, then
 * a hard-coded default. Trims whitespace and ignores empty strings.
 */
export async function getEffectiveBakongAccountId(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("bakong_account_id")
      .eq("id", 1)
      .maybeSingle();
    const fromDb = (data?.bakong_account_id ?? "").trim();
    if (fromDb) return fromDb;
  } catch {
    /* fall through to env */
  }
  const fromEnv = (process.env.BAKONG_ACCOUNT_ID ?? "").trim();
  return fromEnv || ENV_BAKONG_ACCOUNT_ID;
}

export function buildKhqr(
  amountUsd: number,
  billNumber: string,
  accountIdOverride?: string,
): string {
  const accountId =
    (accountIdOverride ?? "").trim() ||
    (process.env.BAKONG_ACCOUNT_ID ?? "").trim() ||
    ENV_BAKONG_ACCOUNT_ID;


  const merchantName = process.env.BAKONG_MERCHANT_NAME || "Dyna Store";

  const merchantCity = process.env.BAKONG_MERCHANT_CITY || "Phnom Penh";

  const acquiringBank = process.env.BAKONG_ACQUIRING_BANK || "Bakong";

  const phone = process.env.BAKONG_MERCHANT_PHONE || "+855974031041";

  const sub00 = tlv("00", accountId);

  let mai = sub00;

  if (acquiringBank) {
    mai += tlv("01", acquiringBank);
  }

  const merchantAccountInfo = tlv("29", mai);

  let additional = tlv("01", billNumber);

  if (phone) {
    additional += tlv("03", phone);
  }

  const additionalData = tlv("62", additional);

  const payloadNoCrc =
    tlv("00", "01") +
    tlv("01", "12") +
    merchantAccountInfo +
    tlv("52", "5999") +
    tlv("53", "840") +
    tlv("54", amountUsd.toFixed(2)) +
    tlv("58", "KH") +
    tlv("59", merchantName.slice(0, 25)) +
    tlv("60", merchantCity.slice(0, 15)) +
    additionalData +
    "6304";

  return payloadNoCrc + crc16(payloadNoCrc);
}

export function md5Of(payload: string): string {
  return crypto.createHash("md5").update(payload, "utf8").digest("hex");
}

// Alias kept for legacy callers.
export const md5Hex = md5Of;

export class BakongApiError extends Error {
  kind: "auth_error" | "upstream_error" | "network_error";
  code: string;
  status?: number;
  constructor(
    kind: "auth_error" | "upstream_error" | "network_error",
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "BakongApiError";
    this.kind = kind;
    this.code = kind;
    this.status = status;
  }
}

export async function checkTransactionByMd5(md5: string) {
  // Prefer the iKhode KHQR Bridge (https://khqr.ikhode.com) when an API key
  // is configured. It proxies NBC Bakong and refreshes the developer token
  // automatically, so we don't need to manage BAKONG_DEVELOPER_TOKEN rotation.
  const ikhodeKey = (process.env.IKHODE_API_KEY ?? "").trim();
  if (ikhodeKey) {
    const url = new URL("https://khqr-api.ikhode.com/api/check-payment-status");
    url.searchParams.set("md5", md5);
    url.searchParams.set("api_key", ikhodeKey);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      throw new BakongApiError("auth_error", `iKhode auth_error (${res.status})`, res.status);
    }
    if (!res.ok) {
      throw new BakongApiError("upstream_error", `iKhode HTTP ${res.status}`, res.status);
    }
    const body = (await res.json()) as { md5?: string; status?: string };
    const status = String(body?.status ?? "").toUpperCase();
    if (status === "PAID" || status === "SUCCESS" || status === "SUCCESSFUL") {
      // Emulate the NBC Bakong response envelope expected by call sites.
      return {
        responseCode: 0,
        responseMessage: "Success.",
        data: { md5, hash: md5, amount: undefined as number | undefined },
      };
    }
    return { responseCode: 1, responseMessage: status || "UNPAID", data: null };
  }

  // Fallback: direct NBC Bakong API (legacy path).
  const token = process.env.BAKONG_DEVELOPER_TOKEN;
  const base = (process.env.BAKONG_API ?? "https://api-bakong.nbc.gov.kh/v1").replace(/\/+$/, "");

  const res = await fetch(`${base}/check_transaction_by_md5`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ md5 }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new BakongApiError("auth_error", `Bakong auth_error (${res.status})`, res.status);
  }
  if (!res.ok) {
    throw new BakongApiError("upstream_error", `Bakong HTTP ${res.status}`, res.status);
  }

  return res.json();
}

