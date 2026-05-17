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
        try {
          const url = new URL(request.url);
          const amount = Math.max(0.01, Number(url.searchParams.get("amount") ?? 1));
          const paymentId = randomUUID();
          const billNumber = `BILL-${Date.now()}`;
          const khqr = buildKhqr(amount, billNumber);
          const md5 = md5Hex(khqr);
          const qrImage = await QRCode.toDataURL(khqr, { width: 400, margin: 2 });

          payments.set(paymentId, {
            id: paymentId, amount, billNumber, md5, khqr,
            status: "pending", createdAt: Date.now(),
          });

          return Response.json({
            success: true, paymentId, amount, billNumber, md5, khqr, qrImage,
          });
        } catch (e) {
          console.error("[payment/create]", e);
          return Response.json(
            { success: false, error: "Failed to create payment" },
            { status: 500 },
          );
        }
      },
    },
  },
});
