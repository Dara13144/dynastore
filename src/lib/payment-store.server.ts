// SERVER ONLY — DB-backed payment session store for Bakong KHQR flow.
// Persists across worker requests via Supabase (in-memory globals are unsafe
// in serverless workers — see server-runtime knowledge file).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Payment = {
  id: string;
  amount: number;
  billNumber: string;
  md5: string;
  khqr: string;
  status: "pending" | "paid";
  createdAt: number;
  paidAt?: number;
  userId?: string | null;
  credited?: boolean;
};

type Row = {
  id: string;
  amount: number | string;
  bill_number: string;
  md5: string;
  khqr: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  user_id: string | null;
  credited: boolean | null;
};

function toPayment(row: Row): Payment {
  return {
    id: row.id,
    amount: Number(row.amount),
    billNumber: row.bill_number,
    md5: row.md5,
    khqr: row.khqr,
    status: (row.status === "paid" ? "paid" : "pending") as "paid" | "pending",
    createdAt: new Date(row.created_at).getTime(),
    paidAt: row.paid_at ? new Date(row.paid_at).getTime() : undefined,
    userId: row.user_id,
    credited: !!row.credited,
  };
}

export type CreditResult = {
  ok: boolean;
  newBalance: number;
  status: string;
  creditedCoins: number;
};

export const payments = {
  async get(id: string): Promise<Payment | undefined> {
    const { data, error } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`payments.get failed: ${error.message}`);
    return data ? toPayment(data as Row) : undefined;
  },

  async create(p: Payment): Promise<void> {
    const { error } = await supabaseAdmin.from("payment_transactions").insert({
      id: p.id,
      amount: p.amount,
      bill_number: p.billNumber,
      md5: p.md5,
      khqr: p.khqr,
      status: p.status,
      user_id: p.userId ?? null,
    });
    if (error) throw new Error(`payments.create failed: ${error.message}`);
  },

  /**
   * Atomically flip pending→paid AND credit the user's wallet using
   * coins_per_usd from app_settings. Safe to call repeatedly (idempotent).
   */
  async creditPaid(id: string): Promise<CreditResult> {
    const { data, error } = await supabaseAdmin.rpc(
      "credit_payment_atomic" as never,
      { _payment_id: id } as never,
    );
    if (error) throw new Error(`credit_payment_atomic failed: ${error.message}`);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { ok?: boolean; new_balance?: number; status?: string; credited_coins?: number }
      | null
      | undefined;
    return {
      ok: !!row?.ok,
      newBalance: Number(row?.new_balance ?? 0),
      status: String(row?.status ?? "unknown"),
      creditedCoins: Number(row?.credited_coins ?? 0),
    };
  },
};
