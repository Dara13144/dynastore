import { createFileRoute } from "@tanstack/react-router";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { buildKhqr, md5Hex, getEffectiveBakongAccountId } from "@/lib/bakong.server";
import { generateIkhodeKhqr, isIkhodeEnabled } from "@/lib/ikhode.server";
import { payments } from "@/lib/payment-store.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function resolveUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// POST/GET /api/payment/create?amount=1
const handler = async ({ request }: { request: Request }) => {
  const reqId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const log = (msg: string, extra: Record<string, unknown> = {}) =>
    console.log(`[payment/create ${reqId}] ${msg}`, extra);

  try {
    const url = new URL(request.url);
    const rawAmount = url.searchParams.get("amount");
    const amount = Math.max(0.01, Number(rawAmount ?? 1));

    log("request received", { method: request.method, rawAmount, parsedAmount: amount });

    if (!Number.isFinite(amount)) {
      return Response.json(
        { success: false, error: "Invalid amount", reqId },
        { status: 400 },
      );
    }

    const paymentId = randomUUID();
    let billNumber: string;
    let khqr: string;
    let md5: string;

    if (isIkhodeEnabled()) {
      log("generating KHQR via iKhode bridge", { paymentId, amount });
      const bridge = await generateIkhodeKhqr(amount);
      billNumber = bridge.bill_number;
      khqr = bridge.qr_string;
      md5 = bridge.md5;
    } else {
      billNumber = `BILL-${Date.now()}`;
      log("building local KHQR", { paymentId, billNumber, amount });
      const accountId = await getEffectiveBakongAccountId();
      khqr = buildKhqr(amount, billNumber, accountId);
      md5 = md5Hex(khqr);
    }
    log("KHQR ready", { paymentId, billNumber, md5 });

    const qrImage = await QRCode.toDataURL(khqr, { width: 400, margin: 2 });

    const userId = await resolveUserId(request);

    await payments.create({
      id: paymentId,
      amount,
      billNumber,
      md5,
      khqr,
      status: "pending",
      createdAt: Date.now(),
      userId,
    });
    log("payment stored", { paymentId, userId });

    return Response.json({
      success: true,
      paymentId,
      amount,
      billNumber,
      md5,
      qr: khqr,
      khqr,
      qrImage,
      reqId,
    });
  } catch (e) {
    const err = e as Error;
    console.error(`[payment/create ${reqId}] FATAL`, {
      message: err?.message,
      stack: err?.stack,
      elapsedMs: Date.now() - startedAt,
    });
    return Response.json(
      { success: false, error: "Failed to create payment", reqId, detail: err?.message },
      { status: 500 },
    );
  }
};

export const Route = createFileRoute("/api/payment/create")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
