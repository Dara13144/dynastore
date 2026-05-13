import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// @ts-ignore - bakong-khqr is plain js
import { BakongKHQR, IndividualInfo, khqrData } from "bakong-khqr";

type PollDebug = {
  checkedAt: string;
  source: "db" | "bakong";
  txStatus: string;
  httpStatus: number | null;
  latencyMs: number | null;
  orderId: string | null;
  bakongMd5: string | null;
  response: string | null;
  providerMessage: string | null;
};

// bakong-khqr throws plain objects shaped like { status: { code, errorCode, message }, data: null }.
// Convert them to a real Error with a readable message.
function khqrErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const anyE = e as { status?: { message?: string; errorCode?: string | number }; message?: string };
    if (anyE.status?.message) return `${anyE.status.message}${anyE.status.errorCode ? ` (${anyE.status.errorCode})` : ""}`;
    if (anyE.message) return anyE.message;
    try { return JSON.stringify(e); } catch { /* ignore */ }
  }
  return String(e);
}

async function loadSettings() {
  const { data, error } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error("មិនអាចទាញ Settings: " + error.message);
  if (!data) throw new Error("App Settings មិនទាន់កំណត់ — សូមកំណត់នៅ Admin Settings");
  if (!data.bakong_account_id) throw new Error("Bakong Account ID មិនទាន់កំណត់ — សូមកំណត់នៅ Admin Settings");
  if (!data.bakong_merchant_name) throw new Error("Merchant Name មិនទាន់កំណត់ — សូមកំណត់នៅ Admin Settings");
  if (!data.bakong_merchant_city) throw new Error("Merchant City មិនទាន់កំណត់ — សូមកំណត់នៅ Admin Settings");
  return {
    coinsPerUsd: data.coins_per_usd,
    ttlMin: data.tx_ttl_min,
    accountId: data.bakong_account_id,
    merchantName: data.bakong_merchant_name,
    merchantCity: data.bakong_merchant_city,
    phone: data.bakong_merchant_phone || "",
  };
}

export const createTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ amountUsd: z.number().min(1).max(1000), forceNew: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { coinsPerUsd, ttlMin, accountId, merchantName, merchantCity, phone } = await loadSettings();

    const coins = Math.round(data.amountUsd * coinsPerUsd);
    const expires = new Date(Date.now() + ttlMin * 60_000).toISOString();

    // If forceNew, mark any still-pending transactions for this user+amount as cancelled
    // so a fresh KHQR is generated instead of reusing the previous (now-expired) one.
    if (data.forceNew) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "cancelled", failure_reason: "user_requested_new_qr", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "pending")
        .eq("amount_usd", data.amountUsd);
    }

    const { data: existingPending } = data.forceNew ? { data: null } : await supabaseAdmin
      .from("transactions")
      .select("order_id, bakong_md5, qr_string, amount_usd, coins, expires_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("amount_usd", data.amountUsd)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending?.qr_string) {
      return {
        orderId: existingPending.order_id,
        bakongMd5: existingPending.bakong_md5,
        qr: existingPending.qr_string,
        balance: existingPending.coins,
        amountUsd: Number(existingPending.amount_usd),
        expiresAt: existingPending.expires_at,
      };
    }

    let qr: string | undefined;
    let bakongMd5: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderId = `khqr_${crypto.randomUUID()}`;
      const nonce = `${userId.slice(0, 6)}-${Date.now().toString(36)}-${attempt}${Math.random().toString(36).slice(2, 6)}`;
      const info = new IndividualInfo(accountId, merchantName, merchantCity, {
        currency: khqrData.currency.usd,
        amount: Number(data.amountUsd.toFixed(2)),
        mobileNumber: phone,
        storeLabel: "Dyna Store",
        terminalLabel: `tp-${userId.slice(0, 8)}`,
        billNumber: nonce,
        expirationTimestamp: Date.now() + ttlMin * 60_000,
      });
      try {
        const res = new BakongKHQR().generateIndividual(info);
        qr = res?.data?.qr;
        bakongMd5 = res?.data?.md5;
      } catch (e) {
        throw new Error("បរាជ័យបង្កើត KHQR: " + (e instanceof Error ? e.message : String(e)));
      }
      if (!qr || !bakongMd5) throw new Error("KHQR មិនត្រឹមត្រូវ — សូមពិនិត្យ Bakong account/credentials");

      const { error } = await supabaseAdmin.from("transactions").upsert({
        order_id: orderId,
        user_id: userId,
        bakong_md5: bakongMd5,
        qr_string: qr,
        amount_usd: data.amountUsd,
        coins,
        payment_method: "khqr",
        status: "pending", expires_at: expires,
      }, { onConflict: "order_id" });
      if (!error) {
        return { orderId, bakongMd5, qr, balance: coins, amountUsd: data.amountUsd, expiresAt: expires };
      }
      if (!/duplicate key|unique constraint|transactions_order_id|transactions_bakong_md5/i.test(error.message)) {
        throw new Error(error.message);
      }

      const { data: existingByBakongMd5 } = await supabaseAdmin
        .from("transactions")
        .select("user_id, order_id, bakong_md5, qr_string, amount_usd, coins, status, expires_at")
        .eq("bakong_md5", bakongMd5)
        .maybeSingle();

      if (
        existingByBakongMd5?.qr_string &&
        existingByBakongMd5.user_id === userId &&
        existingByBakongMd5.status === "pending" &&
        new Date(existingByBakongMd5.expires_at).getTime() > Date.now()
      ) {
        return {
          orderId: existingByBakongMd5.order_id,
          bakongMd5: existingByBakongMd5.bakong_md5,
          qr: existingByBakongMd5.qr_string,
          balance: existingByBakongMd5.coins,
          amountUsd: Number(existingByBakongMd5.amount_usd),
          expiresAt: existingByBakongMd5.expires_at,
        };
      }
    }
    throw new Error("បរាជ័យបង្កើត KHQR — សូមសាកម្តងទៀត។");
  });


export const checkTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orderId: z.string().min(8).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const checkedAt = new Date().toISOString();
    const mkDebug = (p: Partial<PollDebug>): PollDebug => ({
      checkedAt, source: "db", txStatus: "unknown", httpStatus: null, latencyMs: null, response: null, orderId: data.orderId, bakongMd5: null, ...p,
    });

    const { data: tx } = await supabaseAdmin
      .from("transactions").select("*").eq("order_id", data.orderId).maybeSingle();
    if (!tx || tx.user_id !== userId) throw new Error("transaction_not_found");
    if (tx.status === "paid" || tx.status === "completed") {
      const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
      return { status: "paid" as const, balance: w?.balance ?? 0, debug: mkDebug({ source: "db", txStatus: tx.status, bakongMd5: tx.bakong_md5 }) };
    }
    if (new Date(tx.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("transactions").update({ status: "expired", failure_reason: "expired_before_payment" }).eq("order_id", data.orderId).eq("status", "pending");
      return { status: "expired" as const, balance: null as number | null, debug: mkDebug({ source: "db", txStatus: "expired", bakongMd5: tx.bakong_md5 }) };
    }

    // Verify with Bakong API
    const token = process.env.BAKONG_DEVELOPER_TOKEN;
    if (!token) throw new Error("Bakong token missing");
    const startedAt = Date.now();
    const res = await fetch("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ md5: tx.bakong_md5 }),
    });
    const httpStatus = res.status;
    const json = await res.json().catch(() => ({}));
    const latencyMs = Date.now() - startedAt;
    const payload = JSON.stringify(json).slice(0, 2000);
    const gatewayEventId = json?.data?.hash || json?.data?.id || json?.data?.transactionId || null;
    const bakongTxRef = json?.data?.transactionReference || json?.data?.bakongTxRef || json?.data?.txRef || null;
    const paid = json?.responseCode === 0 && json?.data;
    const debug = mkDebug({ source: "bakong", httpStatus, latencyMs, response: payload, txStatus: tx.status, bakongMd5: tx.bakong_md5 });

    await supabaseAdmin.rpc("mark_transaction_poll_result", {
      _order_id: tx.order_id,
      _http_status: httpStatus,
      _latency_ms: latencyMs,
      _provider_payload: json,
      _next_status: paid ? undefined : tx.status,
    });

    if (!paid) return { status: "pending" as const, balance: null as number | null, debug };

    const { data: credit, error } = await supabaseAdmin.rpc("process_khqr_payment_atomic", {
      _order_id: tx.order_id,
      _gateway_event_id: gatewayEventId,
      _bakong_tx_ref: bakongTxRef,
      _provider_payload: json,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(credit) ? credit[0] : credit;
    return { status: "paid" as const, balance: (row?.new_balance ?? 0) as number | null, debug };
  });

export const purchaseGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ gameId: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: result, error } = await supabaseAdmin.rpc("purchase_game_atomic", {
      _user_id: userId, _game_id: data.gameId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(result) ? result[0] : result;
    return { ok: row?.ok ?? false, balance: row?.new_balance ?? 0, message: row?.message ?? "" };
  });
