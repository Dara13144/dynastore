import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// @ts-ignore - bakong-khqr is plain js
import { BakongKHQR, IndividualInfo, khqrData } from "bakong-khqr";

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
  .inputValidator((i) => z.object({ amountUsd: z.number().min(1).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { coinsPerUsd, ttlMin, accountId, merchantName, merchantCity, phone } = await loadSettings();

    const coins = Math.round(data.amountUsd * coinsPerUsd);
    const expires = new Date(Date.now() + ttlMin * 60_000).toISOString();

    // Retry up to 3 times to avoid md5 unique-collision (same params produce same md5)
    let qr: string | undefined;
    let md5: string | undefined;
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${attempt}`;
      const info = new IndividualInfo(accountId, merchantName, merchantCity, {
        currency: khqrData.currency.usd,
        amount: Number(data.amountUsd.toFixed(2)),
        mobileNumber: phone,
        storeLabel: "Dyna Store",
        terminalLabel: "topup",
        billNumber: nonce,
        expirationTimestamp: Date.now() + ttlMin * 60_000,
      });
      try {
        const res = new BakongKHQR().generateIndividual(info);
        qr = res?.data?.qr;
        md5 = res?.data?.md5;
      } catch (e) {
        throw new Error("បរាជ័យបង្កើត KHQR: " + (e instanceof Error ? e.message : String(e)));
      }
      if (!qr || !md5) throw new Error("KHQR មិនត្រឹមត្រូវ — សូមពិនិត្យ Bakong account/credentials");

      const { error } = await supabaseAdmin.from("transactions").insert({
        user_id: userId, md5, qr_string: qr, amount_usd: data.amountUsd, coins,
        status: "pending", expires_at: expires,
      });
      if (!error) {
        return { md5, qr, balance: coins, amountUsd: data.amountUsd, expiresAt: expires };
      }
      lastErr = error.message;
      // Only retry on unique-violation; otherwise bail immediately
      if (!/duplicate key|unique constraint|transactions_md5/i.test(error.message)) {
        throw new Error(error.message);
      }
    }
    throw new Error("បរាជ័យបង្កើត KHQR (ID ស្ទួន) — សូមសាកម្តងទៀត។ " + (lastErr ?? ""));
  });


export const checkTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ md5: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const checkedAt = new Date().toISOString();
    type Debug = {
      checkedAt: string;
      source: "db" | "bakong";
      txStatus: string;
      httpStatus: number | null;
      latencyMs: number | null;
      response: string | null;
    };
    const mkDebug = (p: Partial<Debug>): Debug => ({
      checkedAt, source: "db", txStatus: "unknown", httpStatus: null, latencyMs: null, response: null, ...p,
    });

    const { data: tx } = await supabaseAdmin
      .from("transactions").select("*").eq("md5", data.md5).maybeSingle();
    if (!tx || tx.user_id !== userId) throw new Error("transaction_not_found");
    if (tx.status === "paid") {
      const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
      return { status: "paid" as const, balance: w?.balance ?? 0, debug: mkDebug({ source: "db", txStatus: "paid" }) };
    }
    if (new Date(tx.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("transactions").update({ status: "expired" }).eq("md5", data.md5).eq("status", "pending");
      return { status: "expired" as const, balance: null as number | null, debug: mkDebug({ source: "db", txStatus: "expired" }) };
    }

    // Verify with Bakong API
    const token = process.env.BAKONG_DEVELOPER_TOKEN;
    if (!token) throw new Error("Bakong token missing");
    const startedAt = Date.now();
    const res = await fetch("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ md5: data.md5 }),
    });
    const httpStatus = res.status;
    const json = await res.json().catch(() => ({}));
    const latencyMs = Date.now() - startedAt;
    const paid = json?.responseCode === 0 && json?.data;
    const debug = mkDebug({ source: "bakong", httpStatus, latencyMs, response: json, txStatus: tx.status });
    if (!paid) return { status: "pending" as const, balance: null as number | null, debug };

    const { data: credit, error } = await supabaseAdmin.rpc("credit_topup_atomic", { _md5: data.md5 });
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
