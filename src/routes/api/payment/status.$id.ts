import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "crypto";
import { checkTransactionByMd5 } from "@/lib/bakong.server";
import { payments } from "@/lib/payment-store.server";

// GET /api/payment/status/:id  — polled every 5s by the client.
export const Route = createFileRoute("/api/payment/status/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const reqId = randomUUID().slice(0, 8);
        const startedAt = Date.now();
        const log = (msg: string, extra: Record<string, unknown> = {}) =>
          console.log(`[payment/status ${reqId}] ${msg}`, extra);

        try {
          log("request received", { paymentId: params.id });

          const payment = await payments.get(params.id);
          if (!payment) {
            return Response.json(
              { success: false, error: "Payment not found", reqId },
              { status: 404 },
            );
          }

          if (payment.status === "paid") {
            return Response.json({ ...payment, reqId });
          }

          log("calling Bakong checkTransactionByMd5", { md5: payment.md5 });
          let result: Awaited<ReturnType<typeof checkTransactionByMd5>>;
          try {
            result = await checkTransactionByMd5(payment.md5);
          } catch (checkErr) {
            const err = checkErr as Error;
            console.error(`[payment/status ${reqId}] Bakong check threw`, {
              paymentId: payment.id,
              md5: payment.md5,
              message: err?.message,
            });
            return Response.json(
              { ...payment, reqId, checkError: err?.message ?? "unknown" },
              { status: 502 },
            );
          }

          log("Bakong response", {
            paymentId: payment.id,
            responseCode: result?.responseCode,
            hasData: !!result?.data,
          });

          if (result?.responseCode === 0 && result?.data) {
            const credit = await payments.creditPaid(payment.id);
            payment.status = "paid";
            payment.paidAt = Date.now();
            log("marked PAID + credited wallet", {
              paymentId: payment.id,
              credit,
            });
            return Response.json({ ...payment, reqId, credit });
          }

          log("done", { paymentId: payment.id, elapsedMs: Date.now() - startedAt });
          return Response.json({ ...payment, reqId });
        } catch (e) {
          const err = e as Error;
          console.error(`[payment/status ${reqId}] FATAL`, {
            paymentId: params.id,
            message: err?.message,
            stack: err?.stack,
          });
          return Response.json(
            { success: false, error: "Failed to check payment", reqId, detail: err?.message },
            { status: 500 },
          );
        }
      },
    },
  },
});
