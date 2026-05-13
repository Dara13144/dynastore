import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// @ts-ignore - bakong-khqr is plain js
import { BakongKHQR, IndividualInfo, khqrData } from "bakong-khqr";

async function loadSettings() {
  const { data } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return {
    coinsPerUsd: data?.coins_per_usd ?? 1,
    ttlMin: data?.tx_ttl_min ?? 5,
    accountId: data?.bakong_account_id || process.env.BAKONG_ACCOUNT_ID || "",
    merchantName: data?.bakong_merchant_name || process.env.BAKONG_MERCHANT_NAME || "Dyna Store",
    merchantCity: data?.bakong_merchant_city || process.env.BAKONG_MERCHANT_CITY || "Phnom Penh",
    phone: data?.bakong_merchant_phone || process.env.BAKONG_MERCHANT_PHONE || "",
  };
}

export const createTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ amountUsd: z.number().min(1).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { coinsPerUsd, ttlMin, accountId, merchantName, merchantCity, phone } = await loadSettings();
    if (!accountId) throw new Error("Bakong មិនទាន់កំណត់ — សូមកំណត់ Account ID នៅ Admin Settings");

    const info = new IndividualInfo(accountId, merchantName, merchantCity, {
      currency: khqrData.currency.usd,
      amount: Number(data.amountUsd.toFixed(2)),
      mobileNumber: phone,
      storeLabel: "Dyna Store",
      terminalLabel: "topup",
      expirationTimestamp: Date.now() + TX_TTL_MIN * 60_000,
    });
    let qr: string | undefined;
    let md5: string | undefined;
    try {
      const res = new BakongKHQR().generateIndividual(info);
      qr = res?.data?.qr;
      md5 = res?.data?.md5;
    } catch (e) {
      throw new Error("បរាជ័យបង្កើត KHQR: " + (e instanceof Error ? e.message : String(e)));
    }
    if (!qr || !md5) throw new Error("KHQR មិនត្រឹមត្រូវ — សូមពិនិត្យ Bakong account/credentials");

    const coins = Math.round(data.amountUsd * COINS_PER_USD);
    const expires = new Date(Date.now() + TX_TTL_MIN * 60_000).toISOString();
    const { error } = await supabaseAdmin.from("transactions").insert({
      user_id: userId, md5, qr_string: qr, amount_usd: data.amountUsd, coins,
      status: "pending", expires_at: expires,
    });
    if (error) throw new Error(error.message);
    return { md5, qr, balance: coins, amountUsd: data.amountUsd, expiresAt: expires };
  });


export const checkTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ md5: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: tx } = await supabaseAdmin
      .from("transactions").select("*").eq("md5", data.md5).maybeSingle();
    if (!tx || tx.user_id !== userId) throw new Error("transaction_not_found");
    if (tx.status === "paid") {
      const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
      return { status: "paid" as const, balance: w?.balance ?? 0 };
    }
    if (new Date(tx.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("transactions").update({ status: "expired" }).eq("md5", data.md5).eq("status", "pending");
      return { status: "expired" as const, balance: null };
    }

    // Verify with Bakong API
    const token = process.env.BAKONG_DEVELOPER_TOKEN;
    if (!token) throw new Error("Bakong token missing");
    const res = await fetch("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ md5: data.md5 }),
    });
    const json = await res.json().catch(() => ({}));
    const paid = json?.responseCode === 0 && json?.data;
    if (!paid) return { status: "pending" as const, balance: null };

    const { data: credit, error } = await supabaseAdmin.rpc("credit_topup_atomic", { _md5: data.md5 });
    if (error) throw new Error(error.message);
    const row = Array.isArray(credit) ? credit[0] : credit;
    return { status: "paid" as const, balance: row?.new_balance ?? 0 };
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
