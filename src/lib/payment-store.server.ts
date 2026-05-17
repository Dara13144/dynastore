// In-memory payment store shared between /api/payment/create and /status/:id.
// Server-only (Map lives in the worker instance). Cleared on redeploy.
export type Payment = {
  id: string;
  amount: number;
  billNumber: string;
  md5: string;
  khqr: string;
  status: "pending" | "paid";
  createdAt: number;
  paidAt?: number;
};

// Re-uses the same Map across hot-reloads in dev by attaching to globalThis.
const g = globalThis as unknown as { __bakong_payments?: Map<string, Payment> };
export const payments: Map<string, Payment> = g.__bakong_payments ?? new Map();
g.__bakong_payments = payments;
