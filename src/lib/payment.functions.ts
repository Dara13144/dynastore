import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// @ts-ignore - bakong-khqr is plain js
import { BakongKHQR, IndividualInfo, khqrData } from "bakong-khqr";

function md5Hex(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

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

async function generateKhqrForUser(opts: {
  userId: string; amountUsd: number; coinsPerUsd: number; ttlMin: number;
  accountId: string; merchantName: string; merchantCity: string; phone: string;
}) {
  const { userId, amountUsd, coinsPerUsd, ttlMin, accountId, merchantName, merchantCity, phone } = opts;
  const coins = Math.round(amountUsd * coinsPerUsd);
  const expires = new Date(Date.now() + ttlMin * 60_000).toISOString();
  for (let attempt = 0; attempt < 3; attempt++) {
    const orderId = `khqr_${crypto.randomUUID()}`;
    const nonce = `${userId.slice(0, 6)}-${Date.now().toString(36)}-${attempt}${Math.random().toString(36).slice(2, 6)}`;
    const info = new IndividualInfo(accountId, merchantName, merchantCity, {
      currency: khqrData.currency.usd, amount: Number(amountUsd.toFixed(2)),
      mobileNumber: phone, storeLabel: "Dyna Store", terminalLabel: `tp-${userId.slice(0, 8)}`,
      billNumber: nonce, expirationTimestamp: Date.now() + ttlMin * 60_000,
    });
    let qr: string | undefined; let md5: string | undefined;
    try {
      const res = new BakongKHQR().generateIndividual(info);
      if (res?.status && res.status.code !== 0) {
        throw new Error(`KHQR generation rejected: ${res.status.message ?? "unknown"}`);
      }
      qr = res?.data?.qr;
      // The bakong-khqr lib sometimes returns a stale/incorrect md5. Always recompute
      // MD5(qr_string) ourselves — that is what Bakong's check_transaction_by_md5 expects.
      md5 = qr ? md5Hex(qr) : undefined;
    } catch (e) { throw new Error("បរាជ័យបង្កើត KHQR: " + khqrErrorMessage(e)); }
    if (!qr || !md5) throw new Error("KHQR មិនត្រឹមត្រូវ — សូមពិនិត្យ Bakong credentials");
    const { error } = await supabaseAdmin.from("transactions").insert({
      order_id: orderId, user_id: userId, bakong_md5: md5, qr_string: qr,
      amount_usd: amountUsd, coins, payment_method: "khqr", status: "pending", expires_at: expires,
    });
    if (!error) return { orderId, bakongMd5: md5, qr, coins, amountUsd, expiresAt: expires };
    if (!/duplicate key|unique constraint/i.test(error.message)) throw new Error(error.message);
  }
  throw new Error("បរាជ័យបង្កើត KHQR — សូមសាកម្តងទៀត។");
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
        // bakong-khqr returns { status: {...}, data: null } on failure WITHOUT throwing.
        if (res?.status && res.status.code !== 0) {
          throw new Error(`KHQR generation rejected: ${res.status.message ?? "unknown"}${res.status.errorCode ? ` (${res.status.errorCode})` : ""}`);
        }
        qr = res?.data?.qr;
        bakongMd5 = res?.data?.md5;
      } catch (e) {
        throw new Error("បរាជ័យបង្កើត KHQR: " + khqrErrorMessage(e));
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


export const validateTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orderId: z.string().min(8).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("user_id, order_id, bakong_md5, qr_string, amount_usd, status, expires_at")
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (!tx || tx.user_id !== userId) {
      return { ok: false as const, code: "tx_not_found", message: "ប្រតិបត្តិការមិនត្រូវបានរកឃើញ" };
    }
    if (!tx.bakong_md5 || !tx.qr_string) {
      return { ok: false as const, code: "missing_qr", message: "QR ឬ MD5 មិនមាននៅក្នុងប្រតិបត្តិការ" };
    }

    // 1) Recompute MD5 of stored QR string and compare to stored bakong_md5
    const recomputed = md5Hex(tx.qr_string);
    if (recomputed !== tx.bakong_md5) {
      return {
        ok: false as const,
        code: "md5_mismatch",
        message: `MD5 មិនត្រូវនឹង QR — រំពឹង ${tx.bakong_md5.slice(0, 8)}… ទទួល ${recomputed.slice(0, 8)}…`,
      };
    }

    // 2) Re-validate that current Bakong credentials still produce a structurally valid KHQR
    //    (catches missing / mis-configured BAKONG_ACCOUNT_ID, merchant name, city, etc.)
    try {
      const { accountId, merchantName, merchantCity, phone } = await loadSettings();
      const probe = new IndividualInfo(accountId, merchantName, merchantCity, {
        currency: khqrData.currency.usd,
        amount: Number(Number(tx.amount_usd).toFixed(2)),
        mobileNumber: phone,
        storeLabel: "Dyna Store",
        terminalLabel: `validate-${userId.slice(0, 8)}`,
        billNumber: `validate-${tx.order_id.slice(-12)}`,
      });
      const res = new BakongKHQR().generateIndividual(probe);
      if (res?.status && res.status.code !== 0) {
        return {
          ok: false as const,
          code: "invalid_credentials",
          message: `Bakong credentials ត្រូវបានបដិសេធ: ${res.status.message ?? "unknown"}`,
        };
      }
      if (!res?.data?.qr || !res?.data?.md5) {
        return { ok: false as const, code: "invalid_credentials", message: "Bakong credentials មិនត្រឹមត្រូវ" };
      }
    } catch (e) {
      return { ok: false as const, code: "invalid_credentials", message: "Bakong credentials បរាជ័យ: " + khqrErrorMessage(e) };
    }

    return {
      ok: true as const,
      code: "valid",
      message: "KHQR & MD5 ត្រឹមត្រូវ",
      orderId: tx.order_id,
      bakongMd5: tx.bakong_md5,
      status: tx.status,
      expiresAt: tx.expires_at,
    };
  });

export const checkTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orderId: z.string().min(8).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const checkedAt = new Date().toISOString();
    const mkDebug = (p: Partial<PollDebug>): PollDebug => ({
      checkedAt, source: "db", txStatus: "unknown", httpStatus: null, latencyMs: null, response: null, orderId: data.orderId, bakongMd5: null, providerMessage: null, ...p,
    });

    const { data: tx } = await supabaseAdmin
      .from("transactions").select("*").eq("order_id", data.orderId).maybeSingle();
    if (!tx || tx.user_id !== userId) throw new Error("transaction_not_found");
    if (tx.status === "paid" || tx.status === "completed") {
      const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
      return { status: "paid" as const, balance: w?.balance ?? 0, debug: mkDebug({ source: "db", txStatus: tx.status, bakongMd5: tx.bakong_md5, providerMessage: "already_credited" }) };
    }
    if (new Date(tx.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("transactions").update({ status: "expired", failure_reason: "expired_before_payment" }).eq("order_id", data.orderId).eq("status", "pending");
      return { status: "expired" as const, balance: null as number | null, debug: mkDebug({ source: "db", txStatus: "expired", bakongMd5: tx.bakong_md5, providerMessage: "expired_before_payment" }) };
    }

    const regenerate = async (reason: string) => {
      await supabaseAdmin.from("transactions").update({
        status: "cancelled", failure_reason: reason, updated_at: new Date().toISOString(),
      }).eq("order_id", data.orderId).in("status", ["pending"]);
      const settings = await loadSettings();
      const fresh = await generateKhqrForUser({ userId, amountUsd: Number(tx.amount_usd), ...settings });
      return {
        status: "regenerated" as const,
        balance: null as number | null,
        orderId: fresh.orderId, qr: fresh.qr, bakongMd5: fresh.bakongMd5,
        amountUsd: fresh.amountUsd, expiresAt: fresh.expiresAt, coins: fresh.coins,
        debug: mkDebug({ source: "db", txStatus: "regenerated", bakongMd5: fresh.bakongMd5, providerMessage: `regenerated:${reason}` }),
      };
    };

    if (!tx.bakong_md5 || !tx.qr_string) {
      return await regenerate("missing_qr_or_md5");
    }

    // Verify with Bakong API. Network/CDN errors and Bakong's "Invalid data" / "Transaction could
    // not be found" responses both mean "still waiting" — they MUST NOT throw.
    const token = process.env.BAKONG_DEVELOPER_TOKEN;
    if (!token) throw new Error("Bakong token missing");
    const startedAt = Date.now();
    let httpStatus = 0;
    let json: Record<string, any> = {};
    let networkError: string | null = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ md5: tx.bakong_md5 }),
          signal: ctrl.signal,
        });
        httpStatus = res.status;
        const text = await res.text();
        try { json = text ? JSON.parse(text) : {}; }
        catch { json = { responseMessage: text.slice(0, 500) }; }
      } finally { clearTimeout(timer); }
    } catch (e) {
      networkError = e instanceof Error ? e.message : String(e);
    }
    const latencyMs = Date.now() - startedAt;
    const payload = JSON.stringify(json).slice(0, 2000);
    const gatewayEventId = json?.data?.hash || json?.data?.id || json?.data?.transactionId || null;
    const bakongTxRef = json?.data?.transactionReference || json?.data?.bakongTxRef || json?.data?.txRef || null;
    const paid = json?.responseCode === 0 && json?.data;
    const providerMessage = networkError
      ? `network_error: ${networkError}`
      : (json?.responseMessage || json?.errorMessage || (paid ? "credited" : "waiting_for_payment"));
    const debug = mkDebug({ source: "bakong", httpStatus, latencyMs, response: payload, txStatus: tx.status, bakongMd5: tx.bakong_md5, providerMessage });

    await supabaseAdmin.rpc("mark_transaction_poll_result", {
      _order_id: tx.order_id,
      _http_status: httpStatus,
      _latency_ms: latencyMs,
      _provider_payload: json,
      _next_status: paid ? undefined : tx.status,
    });

    // Auto-regenerate when Bakong rejects the MD5/hash as malformed (not just "not found yet").
    const msg = String(providerMessage ?? "").toLowerCase();
    const looksInvalidMd5 = !paid && !networkError && httpStatus >= 200 && httpStatus < 500 &&
      json?.responseCode !== 0 &&
      /(invalid|hash|md5|bad request|malformed)/.test(msg) &&
      !/not\s*found/.test(msg);
    if (looksInvalidMd5) {
      return await regenerate(`bakong_invalid_md5:${msg.slice(0, 60)}`);
    }

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

export const cancelTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orderId: z.string().min(1).max(128) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: tx, error: loadErr } = await supabaseAdmin
      .from("transactions")
      .select("id, user_id, status")
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!tx) throw new Error("transaction_not_found");
    if (tx.user_id !== context.userId) throw new Error("forbidden");
    if (tx.status === "completed" || tx.status === "paid") {
      throw new Error("មិនអាចលុបបានទេ — បានបង់រួច");
    }
    if (tx.status === "cancelled") return { ok: true, status: "cancelled" as const };
    const { error: upErr } = await supabaseAdmin
      .from("transactions")
      .update({ status: "cancelled", failure_reason: "user_cancelled", updated_at: new Date().toISOString() })
      .eq("id", tx.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, status: "cancelled" as const };
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
