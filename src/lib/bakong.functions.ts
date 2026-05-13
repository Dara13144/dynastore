import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildKhqr, checkBakongMd5 } from "./khqr.server";
import { COIN_PACK_PRICES, GAME_PRICES, finalGamePrice } from "./catalog";

const maskAccount = (id: string) => {
  if (!id) return "";
  const [user, host] = id.split("@");
  if (!host) return id.length <= 4 ? id : `${id.slice(0, 2)}***${id.slice(-2)}`;
  const u = user.length <= 2 ? user : `${user.slice(0, 2)}***${user.slice(-1)}`;
  return `${u}@${host}`;
};

const readBakongAccountId = () =>
  process.env.BAKONG_ACCOUNT_ID ||
  process.env.BAKONG_MERCHANT_ID ||
  process.env.BAKONG_MERCHANT_ACCOUNT_NUMBER ||
  "";

const sanitizePhone = (value?: string | null) => value?.replace(/\D+/g, "") || undefined;

export const getMerchantInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const accountIdRaw = readBakongAccountId();
    return {
      merchantName: process.env.BAKONG_MERCHANT_NAME || null,
      merchantCity: process.env.BAKONG_MERCHANT_CITY || null,
      merchantPhone: process.env.BAKONG_MERCHANT_PHONE || null,
      acquiringBank: process.env.BAKONG_ACQUIRING_BANK || null,
      bakongAccountId: accountIdRaw || null,
      bakongAccountIdMasked: accountIdRaw ? maskAccount(accountIdRaw) : null,
    };
  });

export const getWalletState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [walletRes, libRes, txRes] = await Promise.all([
      supabase.from("wallets").select("coins").eq("user_id", userId).maybeSingle(),
      supabase.from("library").select("game_id, acquired_at").eq("user_id", userId),
      supabase.from("transactions")
        .select("id, md5, amount_usd, coins, status, created_at, paid_at, expires_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    let coins = walletRes.data?.coins ?? 0;
    if (!walletRes.data) {
      await supabaseAdmin.from("wallets").insert({ user_id: userId, coins: 0 });
      coins = 0;
    }
    return {
      coins,
      library: (libRes.data ?? []).map((r) => r.game_id),
      transactions: txRes.data ?? [],
    };
  });

export const createTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ packId: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const pack = COIN_PACK_PRICES[data.packId];
    if (!pack) throw new Error("Invalid coin pack");

    // Read merchant configuration entirely from environment — no hardcoded values.
    const accountId = readBakongAccountId();
    const merchantName = process.env.BAKONG_MERCHANT_NAME;
    const merchantCity = process.env.BAKONG_MERCHANT_CITY;
    const merchantPhone = sanitizePhone(process.env.BAKONG_MERCHANT_PHONE);
    const acquiringBank = process.env.BAKONG_ACQUIRING_BANK;
    const merchantId = process.env.BAKONG_MERCHANT_ID_NUMBER;
    if (!accountId) throw new Error("Bakong merchant account is not configured");
    if (!merchantName) throw new Error("BAKONG_MERCHANT_NAME is not configured");
    if (!merchantCity) throw new Error("BAKONG_MERCHANT_CITY is not configured");

    const totalCoins = pack.coins + (pack.bonus ?? 0);
    let lastErr: string | null = null;
    let md5 = "";
    let payload = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
      const billNumber = `T${Date.now().toString(36).toUpperCase()}${rand}`;
      const built = buildKhqr({
        bakongAccountId: accountId,
        merchantName,
        merchantCity,
        amount: pack.price,
        currency: "USD",
        billNumber,
        storeLabel: pack.name.slice(0, 25),
        mobileNumber: merchantPhone,
        terminalLabel: undefined,
        acquiringBank: acquiringBank || undefined,
        accountInformation: merchantPhone,
        merchantId: merchantId || undefined,
      });
      md5 = built.md5;
      payload = built.payload;
      const { error } = await supabaseAdmin.from("transactions").insert({
        user_id: userId, md5, qr_payload: payload,
        amount_usd: pack.price, coins: totalCoins, status: "pending",
      });
      if (!error) { lastErr = null; break; }
      lastErr = error.message;
      // Only retry on unique-violation; otherwise abort.
      if (!/duplicate key|unique constraint/i.test(error.message)) break;
    }
    if (lastErr) throw new Error(lastErr);

    return { md5, qrPayload: payload, amountUsd: pack.price, coins: totalCoins, packName: pack.name };
  });

export const checkPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ md5: z.string().regex(/^[a-f0-9]{32}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const token = process.env.BAKONG_DEVELOPER_TOKEN;
    if (!token) throw new Error("BAKONG_DEVELOPER_TOKEN not configured");

    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions").select("*").eq("md5", data.md5).maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("Transaction not found");
    if (tx.user_id !== userId) throw new Error("Forbidden");
    if (tx.status === "paid") {
      const { data: w } = await supabaseAdmin.from("wallets").select("coins").eq("user_id", userId).maybeSingle();
      return {
        status: "paid" as const,
        coinsCredited: tx.coins,
        creditedNow: false,
        bakongRef: tx.bakong_ref ?? null,
        bakongHash: tx.bakong_ref ?? null,
        newBalance: w?.coins ?? null,
        paidAt: tx.paid_at ?? null,
      };
    }

    if (new Date(tx.expires_at).getTime() < Date.now() && tx.status === "pending") {
      await supabaseAdmin.from("transactions").update({ status: "expired" }).eq("id", tx.id);
      return { status: "expired" as const };
    }

    const result = await checkBakongMd5(data.md5, token);
    const responseCode = result.raw?.responseCode ?? null;
    const responseMessage = result.raw?.responseMessage ?? result.raw?.errorCode ?? null;
    if (result.status === "SUCCESS") {
      const { data: rpc, error: rpcErr } = await supabaseAdmin.rpc("credit_topup_atomic", {
        _md5: data.md5,
        _bakong_ref: result.raw?.data?.hash ?? null,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const row = Array.isArray(rpc) ? rpc[0] : rpc;
      const hash = result.raw?.data?.hash ?? null;
      return {
        status: "paid" as const,
        coinsCredited: tx.coins,
        creditedNow: !!row?.credited,
        bakongRef: hash,
        bakongHash: hash,
        newBalance: row?.new_balance ?? null,
        paidAt: new Date().toISOString(),
        responseCode,
        responseMessage,
        creditResult: row ?? null,
      };
    }
    return { status: "pending" as const, responseCode, responseMessage, raw: result.raw ?? null };
  });

export const buyGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ gameId: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const game = GAME_PRICES[data.gameId];
    if (!game) throw new Error("Invalid game");
    const price = finalGamePrice(data.gameId)!;

    const { data: existing } = await supabaseAdmin
      .from("library").select("id").eq("user_id", userId).eq("game_id", data.gameId).maybeSingle();
    if (existing) return { ok: false as const, msg: "អ្នកមានហ្គេមនេះរួចហើយ" };

    const { data: w } = await supabaseAdmin.from("wallets").select("coins").eq("user_id", userId).maybeSingle();
    const cur = w?.coins ?? 0;
    if (cur < price) return { ok: false as const, msg: "Coins មិនគ្រប់គ្រាន់" };

    const { error: wErr } = await supabaseAdmin.from("wallets")
      .update({ coins: cur - price, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (wErr) throw new Error(wErr.message);

    const { error: lErr } = await supabaseAdmin.from("library").insert({ user_id: userId, game_id: data.gameId });
    if (lErr) {
      await supabaseAdmin.from("wallets").update({ coins: cur }).eq("user_id", userId);
      throw new Error(lErr.message);
    }
    return { ok: true as const, msg: `ទិញ ${game.title} ជោគជ័យ`, newCoins: cur - price };
  });

export const checkoutCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ gameIds: z.array(z.string().min(1).max(40)).min(1).max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: owned } = await supabaseAdmin
      .from("library").select("game_id").eq("user_id", userId).in("game_id", data.gameIds);
    const ownedSet = new Set((owned ?? []).map((r) => r.game_id));
    const toBuy = data.gameIds.filter((id) => !ownedSet.has(id) && GAME_PRICES[id]);
    if (toBuy.length === 0) return { ok: false as const, msg: "កន្ត្រកគ្មានហ្គេមថ្មី" };

    const total = toBuy.reduce((s, id) => s + (finalGamePrice(id) ?? 0), 0);
    const { data: w } = await supabaseAdmin.from("wallets").select("coins").eq("user_id", userId).maybeSingle();
    const cur = w?.coins ?? 0;
    if (cur < total) return { ok: false as const, msg: "Coins មិនគ្រប់គ្រាន់" };

    const { error: wErr } = await supabaseAdmin.from("wallets")
      .update({ coins: cur - total, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (wErr) throw new Error(wErr.message);

    const rows = toBuy.map((id) => ({ user_id: userId, game_id: id }));
    const { error: lErr } = await supabaseAdmin.from("library").insert(rows);
    if (lErr) {
      await supabaseAdmin.from("wallets").update({ coins: cur }).eq("user_id", userId);
      throw new Error(lErr.message);
    }
    return { ok: true as const, msg: `ទិញ ${toBuy.length} ហ្គេម — សរុប ${total} Coins`, newCoins: cur - total };
  });
