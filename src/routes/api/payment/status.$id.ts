import { createFileRoute } from "@tanstack/react-router";
import { checkTransactionByMd5 } from "@/lib/bakong.server";
import { payments } from "@/lib/payment-store.server";

// GET /api/payment/status/:id
export const Route = createFileRoute("/api/payment/status/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const payment = payments.get(params.id);
          if (!payment) {
            return Response.json(
              { success: false, error: "Payment not found" },
              { status: 404 },
            );
          }
          if (payment.status === "paid") return Response.json(payment);

          const result = await checkTransactionByMd5(payment.md5);
          if (result?.responseCode === 0 && result?.data) {
            payment.status = "paid";
            payment.paidAt = Date.now();
            payments.set(payment.id, payment);
          }
          return Response.json(payment);
        } catch (e) {
          console.error("[payment/status]", e);
          return Response.json(
            { success: false, error: "Failed to check payment" },
            { status: 500 },
          );
        }
      },
    },
  },
});
