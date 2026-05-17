import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "crypto";
import { checkTransactionByMd5 } from "@/lib/bakong.server";
import { payments } from "@/lib/payment-store.server";

// GET /api/payment/status/:id
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

          const payment = payments.get(params.id);
          if (!payment) {
            console.warn(`[payment/status ${reqId}] not found`, {
              paymentId: params.id,
              knownIds: Array.from(payments.keys()).slice(0, 10),
              totalInStore: payments.size,
            });
            return Response.json(
              { success: false, error: "Payment not found", reqId },
              { status: 404 },
            );
          }

          log("payment found", {
            paymentId: payment.id,
            status: payment.status,
            amount: payment.amount,
            md5: payment.md5,
            ageMs: Date.now() - payment.createdAt,
          });

          if (payment.status === "paid") {
            log("already paid — short circuit", { paidAt: payment.paidAt });
            return Response.json({ ...payment, reqId });
          }

          log("calling Bakong checkTransactionByMd5", { md5: payment.md5 });
          const checkStart = Date.now();
          let result: Awaited<ReturnType<typeof checkTransactionByMd5>>;
          try {
            result = await checkTransactionByMd5(payment.md5);
          } catch (checkErr) {
            const err = checkErr as Error;
            console.error(`[payment/status ${reqId}] Bakong check threw`, {
              paymentId: payment.id,
              md5: payment.md5,
              message: err?.message,
              name: err?.name,
              stack: err?.stack,
              elapsedMs: Date.now() - checkStart,
            });
            return Response.json(
              { ...payment, reqId, checkError: err?.message ?? "unknown" },
              { status: 502 },
            );
          }

          log("Bakong response", {
            paymentId: payment.id,
            elapsedMs: Date.now() - checkStart,
            responseCode: result?.responseCode,
            responseMessage: result?.responseMessage,
            errorCode: result?.errorCode,
            hasData: !!result?.data,
            dataKeys: result?.data ? Object.keys(result.data) : null,
            rawSnippet: JSON.stringify(result).slice(0, 400),
          });

          if (result?.responseCode === 0 && result?.data) {
            payment.status = "paid";
            payment.paidAt = Date.now();
            payments.set(payment.id, payment);
            log("marked PAID", { paymentId: payment.id, paidAt: payment.paidAt });
          } else {
            log("still pending", {
              paymentId: payment.id,
              reason:
                result?.responseCode !== 0
                  ? `responseCode=${result?.responseCode}`
                  : "no data field",
            });
          }

          log("done", { paymentId: payment.id, elapsedMs: Date.now() - startedAt });
          return Response.json({ ...payment, reqId });
        } catch (e) {
          const err = e as Error;
          console.error(`[payment/status ${reqId}] FATAL`, {
            paymentId: params.id,
            message: err?.message,
            name: err?.name,
            stack: err?.stack,
            elapsedMs: Date.now() - startedAt,
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
