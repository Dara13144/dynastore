// SERVER ONLY — iKhode KHQR Bridge (https://khqr.ikhode.com) wrapper.
// Generates a Bakong KHQR through the bridge service so payments are
// auto-trackable via /api/check-payment-status without us managing a
// rotating BAKONG_DEVELOPER_TOKEN.

import { BakongApiError } from "@/lib/bakong.server";

const IKHODE_BASE = "https://khqr-api.ikhode.com";

export type IkhodeKhqr = {
  bill_number: string;
  md5: string;
  qr_string: string;
  deeplink: string;
  status: string;
};

function getKey(): string {
  const k = (process.env.IKHODE_API_KEY ?? "").trim();
  if (!k) throw new BakongApiError("auth_error", "IKHODE_API_KEY is not configured");
  return k;
}

/** Generate a fresh KHQR via iKhode Bridge. Amount is in USD. */
export async function generateIkhodeKhqr(amountUsd: number): Promise<IkhodeKhqr> {
  const url = new URL(`${IKHODE_BASE}/api/generate-khqr`);
  url.searchParams.set("amount", String(amountUsd));
  url.searchParams.set("api_key", getKey());

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
  const body = (await res.json()) as Partial<IkhodeKhqr>;
  if (!body?.bill_number || !body?.md5 || !body?.qr_string) {
    throw new BakongApiError("upstream_error", "iKhode response missing required fields");
  }
  return body as IkhodeKhqr;
}

/** True when iKhode integration is active. */
export function isIkhodeEnabled(): boolean {
  return !!(process.env.IKHODE_API_KEY ?? "").trim();
}
