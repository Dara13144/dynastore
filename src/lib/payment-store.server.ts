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
  };
}

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
    });
    if (error) throw new Error(`payments.create failed: ${error.message}`);
  },

  async markPaid(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("payment_transactions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (error) throw new Error(`payments.markPaid failed: ${error.message}`);
  },
};
