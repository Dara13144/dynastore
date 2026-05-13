import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// Inline minimal KHQR (EMV-style TLV + CRC16-CCITT/0x1021) encoder
function tlv(id: string, val: string) {
  return id + val.length.toString().padStart(2, "0") + val;
}
function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
async function encodeKhqr(o: {
  accountId: string; merchantName: string; merchantCity: string;
  mobileNumber?: string; acquiringBank?: string;
  amount: number; currency: "USD" | "KHR"; dynamic: boolean;
  terminalLabel?: string; storeLabel?: string; billNumber?: string;
}) {
  // Bakong account ID lives directly under tag 29, sub-tag 00 (no GUID prefix)
  const merchantAccount = tlv("00", o.accountId);

  // Tag 62 sub-tags (order matches Bakong reference QRs)
  let extra = "";
  if (o.billNumber)    extra += tlv("01", o.billNumber.slice(0, 25));
  if (o.mobileNumber)  extra += tlv("02", o.mobileNumber.slice(0, 25));
  if (o.storeLabel)    extra += tlv("03", o.storeLabel.slice(0, 25));
  if (o.terminalLabel) extra += tlv("07", o.terminalLabel.slice(0, 25));
  const additional = extra ? tlv("62", extra) : "";

  const payload =
    tlv("00", "01") +
    tlv("01", o.dynamic ? "12" : "11") +
    tlv("29", merchantAccount) +
    tlv("52", "5999") +
    tlv("53", o.currency === "USD" ? "840" : "116") +
    (o.dynamic ? tlv("54", o.amount.toFixed(2)) : "") +
    tlv("58", "KH") +
    tlv("59", o.merchantName.slice(0, 25)) +
    tlv("60", o.merchantCity.slice(0, 15)) +
    additional;
  const toCrc = payload + "6304";
  return { qr: toCrc + crc16(toCrc) };
}

const TTL_MIN = 10;

async function notifyTelegramPaid(args: {
  userName: string;
  userId: string;
  amountUSD: number;
  coins: number;
  md5: string;
  bakongRef: string | null;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const raw = process.env.TELEGRAM_CHAT_IDS;
  if (!token || !raw) return;
  const chatIds = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const text =
    `✅ <b>Top-up paid</b>\n` +
    `👤 ${args.userName} <code>${args.userId.slice(0, 8)}</code>\n` +
    `💵 $${args.amountUSD.toFixed(2)} → <b>${args.coins.toLocaleString()} coins</b>\n` +
    `🔗 ref: <code>${args.bakongRef ?? "—"}</code>\n` +
    `🆔 md5: <code>${args.md5}</code>`;
  await Promise.all(
    chatIds.map((chat_id) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
      }).catch((e) => console.error("telegram_notify_failed", chat_id, e))
    )
  );
}


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

    const encoded = await encodeKhqr({
      accountId,
      merchantName,
      merchantCity,
      mobileNumber: merchantPhone,
      acquiringBank,
      amount: data.amountUSD,
      currency: "USD",
      dynamic: true,
      // Per-tx unique label so each QR (and its MD5) is distinct.
      // Max 25 chars; Bakong terminalLabel is free-form.
      terminalLabel: `${userId.slice(0, 6)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 25),
    });
    const qrString = encoded.qr;
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
        if (row?.message === "credited") {
          const { data: txRow } = await supabaseAdmin
            .from("transactions")
            .select("amount_usd, coins, user_id")
            .eq("md5", data.md5)
            .maybeSingle();
          if (txRow) {
            const { data: prof } = await supabaseAdmin
              .from("profiles").select("display_name").eq("user_id", txRow.user_id).maybeSingle();
            await notifyTelegramPaid({
              userName: prof?.display_name ?? "Player",
              userId: txRow.user_id,
              amountUSD: Number(txRow.amount_usd),
              coins: txRow.coins,
              md5: data.md5,
              bakongRef: ref,
            });
          }
        }
        return { status: "paid" as const, balance: row?.new_balance ?? 0 };
      }
    } catch (e) {
      // Network / Bakong hiccup → keep pending
      console.error("bakong_check_failed", e);
    }

    return { status: "pending" as const, balance: 0 };
  });

export const submitTopupProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      md5: z.string().length(32),
      // data URL or raw base64 of an image
      imageBase64: z.string().min(100).max(8_000_000),
      contentType: z.enum(["image/png", "image/jpeg", "image/webp"]).default("image/png"),
      note: z.string().max(500).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("user_id, amount_usd, coins, status")
      .eq("md5", data.md5)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx || tx.user_id !== userId) throw new Error("transaction_not_found");

    // Strip data-url prefix if present
    const b64 = data.imageBase64.includes(",") ? data.imageBase64.split(",")[1] : data.imageBase64;
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length > 6_000_000) throw new Error("file_too_large");

    const ext = data.contentType === "image/jpeg" ? "jpg" : data.contentType === "image/webp" ? "webp" : "png";
    const path = `${userId}/${data.md5}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("topup-receipts")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("display_name").eq("user_id", userId).maybeSingle();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const raw = process.env.TELEGRAM_CHAT_IDS;
    if (token && raw) {
      const chatIds = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      const caption =
        `📩 <b>Payment proof submitted</b>\n` +
        `👤 ${prof?.display_name ?? "Player"} <code>${userId.slice(0, 8)}</code>\n` +
        `💵 $${Number(tx.amount_usd).toFixed(2)} → <b>${tx.coins.toLocaleString()} coins</b>\n` +
        `🆔 md5: <code>${data.md5}</code>\n` +
        `📌 status: <code>${tx.status}</code>` +
        (data.note ? `\n📝 ${data.note}` : "");

      const results = await Promise.all(
        chatIds.map(async (chat_id) => {
          try {
            const fd = new FormData();
            fd.append("chat_id", chat_id);
            fd.append("caption", caption);
            fd.append("parse_mode", "HTML");
            fd.append("photo", new Blob([new Uint8Array(bytes)], { type: data.contentType }), `proof.${ext}`);
            const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: fd });
            const j: any = await res.json().catch(() => ({}));
            return { chat_id, ok: res.ok && j?.ok === true, error: j?.description ?? null };
          } catch (e) {
            console.error("telegram_proof_failed", chat_id, e);
            return { chat_id, ok: false, error: e instanceof Error ? e.message : "network_error" };
          }
        })
      );
      const sent = results.filter((r) => r.ok).length;
      const failed = results.length - sent;
      const firstError = results.find((r) => !r.ok)?.error ?? null;
      return { ok: true, path, telegram: { sent, failed, total: results.length, error: firstError } };
    }

    return { ok: true, path, telegram: { sent: 0, failed: 0, total: 0, error: "telegram_not_configured" } };
  });

export const adminConfirmTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      md5: z.string().length(32),
      bakong_ref: z.string().max(120).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: role } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("forbidden");

    const { data: rpc, error } = await supabaseAdmin.rpc("credit_topup_atomic", {
      _md5: data.md5,
      _bakong_ref: data.bakong_ref ?? `manual:${userId.slice(0, 8)}`,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    if (row?.message === "credited") {
      const { data: txRow } = await supabaseAdmin
        .from("transactions").select("amount_usd, coins, user_id").eq("md5", data.md5).maybeSingle();
      if (txRow) {
        const { data: prof } = await supabaseAdmin
          .from("profiles").select("display_name").eq("user_id", txRow.user_id).maybeSingle();
        await notifyTelegramPaid({
          userName: prof?.display_name ?? "Player",
          userId: txRow.user_id,
          amountUSD: Number(txRow.amount_usd),
          coins: txRow.coins,
          md5: data.md5,
          bakongRef: data.bakong_ref ?? "manual",
        });
      }
    }
    return { ok: !!row?.ok, message: row?.message ?? "unknown", new_balance: row?.new_balance ?? 0 };
  });
