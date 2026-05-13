import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encodeKhqr } from "./khqr-encode";

const TTL_MIN = 10;

export const createTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ amountUSD: z.number().min(0.5).max(500) }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const accountId = process.env.BAKONG_ACCOUNT_ID;
    const merchantName = process.env.BAKONG_MERCHANT_NAME || "Dyna Store";
    const merchantCity = process.env.BAKONG_MERCHANT_CITY || "Phnom Penh";
    const merchantPhone = process.env.BAKONG_MERCHANT_PHONE || undefined;
    const acquiringBank = process.env.BAKONG_ACQUIRING_BANK || undefined;
    if (!accountId) throw new Error("bakong_not_configured");

    // 1 USD = 1 coin (per app_settings default coins_per_usd)
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("coins_per_usd")
      .eq("id", 1)
      .maybeSingle();
    const coinsPerUsd = settings?.coins_per_usd ?? 1;
    const coins = Math.round(data.amountUSD * coinsPerUsd);

    const qrString = buildKHQR({
      bakongAccountID: accountId,
      merchantName,
      merchantCity,
      merchantPhone,
      acquiringBank,
      amountUSD: data.amountUSD,
      terminalLabel: userId.slice(0, 8),
    });
    const md5 = createHash("md5").update(qrString).digest("hex");
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        md5,
        qr_string: qrString,
        amount_usd: data.amountUSD,
        coins,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id, md5, qr_string, amount_usd, coins, expires_at, status")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: tx.id,
      md5: tx.md5,
      qrString: tx.qr_string,
      amountUSD: Number(tx.amount_usd),
      coins: tx.coins,
      expiresAt: tx.expires_at,
      status: tx.status,
    };
  });

export const checkTopupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ md5: z.string().length(32) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("user_id, status, expires_at")
      .eq("md5", data.md5)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx || tx.user_id !== userId) return { status: "not_found" as const, balance: 0 };

    if (tx.status === "paid") {
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      return { status: "paid" as const, balance: w?.balance ?? 0 };
    }

    // Expire if past TTL
    if (tx.status === "pending" && new Date(tx.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "expired" })
        .eq("md5", data.md5)
        .eq("status", "pending");
      return { status: "expired" as const, balance: 0 };
    }

    // Ask Bakong
    const token = process.env.BAKONG_DEVELOPER_TOKEN;
    if (!token) return { status: "pending" as const, balance: 0 };

    try {
      const res = await fetch("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ md5: data.md5 }),
      });
      const json: any = await res.json().catch(() => ({}));
      // Bakong success shape: { responseCode: 0, data: { hash, ... } }
      const paid = json?.responseCode === 0 && json?.data;
      if (paid) {
        const ref = json?.data?.hash || json?.data?.externalRef || null;
        const { data: rpc, error: rpcErr } = await supabaseAdmin.rpc("credit_topup_atomic", {
          _md5: data.md5,
          _bakong_ref: ref,
        });
        if (rpcErr) throw new Error(rpcErr.message);
        const row = Array.isArray(rpc) ? rpc[0] : rpc;
        return { status: "paid" as const, balance: row?.new_balance ?? 0 };
      }
    } catch (e) {
      // Network / Bakong hiccup → keep pending
      console.error("bakong_check_failed", e);
    }

    return { status: "pending" as const, balance: 0 };
  });
