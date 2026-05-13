// KHQR (Bakong) generation via the official `bakong-khqr` SDK.
// Server-only — never import from client code.
import { BakongKHQR, IndividualInfo, MerchantInfo, khqrData } from "bakong-khqr";

export type KhqrInput = {
  bakongAccountId: string;     // e.g. yourname@aclb
  merchantName: string;        // <= 25 chars
  merchantCity: string;        // <= 15 chars
  amount: number;
  currency: "USD" | "KHR";
  billNumber?: string;
  storeLabel?: string;
  mobileNumber?: string;
  terminalLabel?: string;
  acquiringBank?: string;      // when present + merchantId, generates Merchant KHQR
  merchantId?: string;
};

export function buildKhqr(input: KhqrInput): { payload: string; md5: string } {
  const currency =
    input.currency === "USD" ? khqrData.currency.usd : khqrData.currency.khr;

  const optionalData: Record<string, unknown> = {
    currency,
    amount: input.amount,
    expirationTimestamp: Date.now() + 5 * 60 * 1000, // 5 minutes
    merchantCategoryCode: "5999",
  };
  if (input.billNumber) optionalData.billNumber = input.billNumber.slice(0, 25);
  if (input.mobileNumber) optionalData.mobileNumber = input.mobileNumber.slice(0, 25);
  if (input.storeLabel) optionalData.storeLabel = input.storeLabel.slice(0, 25);
  if (input.terminalLabel) optionalData.terminalLabel = input.terminalLabel.slice(0, 25);

  const khqr = new BakongKHQR();
  let response: any;

  if (input.merchantId && input.acquiringBank) {
    const info = new MerchantInfo(
      input.bakongAccountId,
      input.merchantName.slice(0, 25),
      input.merchantCity.slice(0, 15),
      input.merchantId,
      input.acquiringBank,
      optionalData
    );
    response = khqr.generateMerchant(info);
  } else {
    const info = new IndividualInfo(
      input.bakongAccountId,
      input.merchantName.slice(0, 25),
      input.merchantCity.slice(0, 15),
      optionalData
    );
    response = khqr.generateIndividual(info);
  }

  if (!response?.data?.qr || !response?.data?.md5) {
    const msg = response?.status?.message || response?.message || "KHQR generation failed";
    throw new Error(`KHQR error: ${msg}`);
  }
  return { payload: response.data.qr, md5: response.data.md5 };
}

const BAKONG_BASE = "https://api-bakong.nbc.gov.kh";

export async function checkBakongMd5(md5: string, token: string): Promise<{
  status: "SUCCESS" | "PENDING" | "FAILED";
  raw: any;
}> {
  const res = await fetch(`${BAKONG_BASE}/v1/check_transaction_by_md5`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ md5 }),
  });
  const raw = await res.json().catch(() => ({}));
  if (res.ok && raw?.responseCode === 0 && raw?.data) {
    return { status: "SUCCESS", raw };
  }
  return { status: "PENDING", raw };
}
