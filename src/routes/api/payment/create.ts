import { createFileRoute } from "@tanstack/react-router";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { buildKhqr, md5Hex } from "@/lib/bakong.server";
import { payments } from "@/lib/payment-store.server";

// GET /api/payment/create?amount=1
export const Route = createFileRoute("/api/payment/create")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqId = randomUUID().slice(0, 8);
        const startedAt = Date.now();
        const log = (msg: string, extra: Record<string, unknown> = {}) =>
          console.log(`[payment/create ${reqId}] ${msg}`, extra);

        try {
          const url = new URL(request.url);
          const rawAmount = url.searchParams.get("amount");
          const amount = Math.max(0.01, Number(rawAmount ?? 1));

          log("request received", {
            url: url.pathname + url.search,
            rawAmount,
            parsedAmount: amount,
            userAgent: request.headers.get("user-agent") ?? null,
            ip: request.headers.get("x-forwarded-for") ?? null,
          });

          if (!Number.isFinite(amount)) {
            console.warn(`[payment/create ${reqId}] invalid amount`, { rawAmount });
            return Response.json(
              { success: false, error: "Invalid amount", reqId },
              { status: 400 },
            );
          }

          const paymentId = randomUUID();
          const billNumber = `BILL-${Date.now()}`;
          log("building KHQR", { paymentId, billNumber, amount });

          if (typeof buildKhqr !== "function") {
            throw new Error(`[/api/payment/create] buildKhqr is ${typeof buildKhqr} — export missing from "@/lib/bakong.server" (src/lib/bakong.server.ts). Restart dev server / check the file's exports.`);
          }
          if (typeof md5Hex !== "function") {
            throw new Error(`[/api/payment/create] md5Hex is ${typeof md5Hex} — export missing from "@/lib/bakong.server" (src/lib/bakong.server.ts).`);
          }
          const khqr = buildKhqr(amount, billNumber);
          const md5 = md5Hex(khqr);
          log("KHQR built", {
            paymentId,
            khqrLength: khqr.length,
            khqrHead: khqr.slice(0, 40),
            khqrTail: khqr.slice(-12),
            md5,
            md5Length: md5.length,
          });

          const qrImage = await QRCode.toDataURL(khqr, { width: 400, margin: 2 });
          log("QR image generated", { paymentId, qrImageBytes: qrImage.length });

          payments.set(paymentId, {
            id: paymentId, amount, billNumber, md5, khqr,
            status: "pending", createdAt: Date.now(),
          });
          log("payment stored", { paymentId, totalInStore: payments.size });

          const elapsedMs = Date.now() - startedAt;
          log("done", { paymentId, elapsedMs });

          return Response.json({
            success: true, paymentId, amount, billNumber, md5, khqr, qrImage, reqId,
          });
        } catch (e) {
          const err = e as Error;
          console.error(`[payment/create ${reqId}] FATAL`, {
            message: err?.message,
            name: err?.name,
            stack: err?.stack,
            elapsedMs: Date.now() - startedAt,
          });
          return Response.json(
            { success: false, error: "Failed to create payment", reqId, detail: err?.message },
            { status: 500 },
          );
        }
      },
    },
  },
});
