import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  notifyTelegram,
  notifyTelegramPhotoFromStorage,
  formatUserById,
} from "@/lib/telegram.server";
import {
  buildKhqr,
  md5Hex,
  checkTransactionByMd5,
  BakongApiError,
  getEffectiveBakongAccountId,
} from "@/lib/bakong.server";
import { generateIkhodeKhqr, isIkhodeEnabled } from "@/lib/ikhode.server";


// Static KHQR payload for DynaStore (Bakong account: ben_sothida@bkr)
export const KHQR_PAYLOAD =
  "00020101021129200016ben_sothida@bkrt5204599953038405802KH5909DynaStore6010Phnom Penh62570310Dyna Store021009740310410111TRX012345670710Cashier-0199170013177868551539963040973";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

const userLabel = formatUserById;

/**
 * Forward a topup notice to Telegram. Sends the slip image when slip_path is
 * a non-empty string; otherwise falls back to a plain text message with the
 * same caption and logs the reason so missed images are easy to diagnose.
 */
async function sendTopupNotice(
  eventType: "topup_submitted" | "topup_approved" | "topup_rejected",
  slipPath: string | null | undefined,
  caption: string,
  requestId: string,
) {
  const trimmed = typeof slipPath === "string" ? slipPath.trim() : "";
  if (!trimmed) {
    console.warn("[topup] slip_path missing — sending text-only Telegram notice", {
      eventType,
      requestId,
      slip_path_raw: slipPath ?? null,
    });
    await notifyTelegram(caption, eventType);
    return;
  }
  console.info("[topup] forwarding slip image to Telegram", {
    eventType,
    requestId,
    slip_path: trimmed,
  });
  await notifyTelegramPhotoFromStorage("topup-slips", trimmed, caption, eventType);
}

async function coinsPerUsd(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("coins_per_usd")
    .eq("id", 1)
    .maybeSingle();
  return Math.max(1, Number(data?.coins_per_usd ?? 1));
}

// Public: get the static KHQR payload + current rate
export const getTopupConfig = createServerFn({ method: "GET" }).handler(async () => {
  const rate = await coinsPerUsd();
  return { qr: KHQR_PAYLOAD, coins_per_usd: rate };
});

// User: submit a topup request with an uploaded slip
export const createTopupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        amount_usd: z.number().min(0.5).max(10000),
        slip_path: z.string().min(1).max(500),
        note: z.string().trim().max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const rate = await coinsPerUsd();
    const coins = Math.round(data.amount_usd * rate);
    const { data: row, error } = await supabaseAdmin
      .from("topup_requests")
      .insert({
        user_id: context.userId,
        amount_usd: data.amount_usd,
        coins,
        slip_path: data.slip_path,
        note: data.note ?? null,
      })
      .select("id, created_at, status, amount_usd, coins")
      .single();
    if (error) throw new Error(error.message);
    const who = await userLabel(context.userId);
    const caption = `🆕 <b>New Topup Request</b>\n👤 ${who}\n💵 $${Number(data.amount_usd).toFixed(2)} → <b>${coins.toLocaleString()} coins</b>${data.note ? `\n📝 ${data.note}` : ""}\n🆔 <code>${row.id}</code>`;
    await sendTopupNotice("topup_submitted", data.slip_path, caption, row.id);
    return row;
  });

// User: list own requests
export const listMyTopupRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("topup_requests")
      .select("id, amount_usd, coins, status, slip_path, created_at, reviewed_at, reject_reason")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const out = await Promise.all(
      (data ?? []).map(async (r) => {
        let slip_url: string | null = null;
        if (r.slip_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("topup-slips")
            .createSignedUrl(r.slip_path, 60 * 30);
          slip_url = signed?.signedUrl ?? null;
        }
        return { ...r, slip_url };
      }),
    );
    return out;
  });

// Admin: list all requests
export const adminListTopupRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        status: z.enum(["all", "pending", "approved", "rejected"]).default("pending"),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("topup_requests")
      .select(
        "id, user_id, amount_usd, coins, status, slip_path, note, created_at, reviewed_at, reviewed_by, reject_reason",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", ids)
      : { data: [] as { user_id: string; display_name: string }[] };
    const map = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));
    // sign slip URLs
    const out = await Promise.all(
      (rows ?? []).map(async (r) => {
        let slip_url: string | null = null;
        if (r.slip_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("topup-slips")
            .createSignedUrl(r.slip_path, 60 * 30);
          slip_url = signed?.signedUrl ?? null;
        }
        return { ...r, user_name: map.get(r.user_id) ?? "—", slip_url };
      }),
    );
    return out;
  });

// Admin: approve → credits coins to user wallet via admin_set_balance
export const adminApproveTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // Atomic claim: only succeeds if still pending. Prevents double credit.
    const { data: claimed, error: e0 } = await supabaseAdmin
      .from("topup_requests")
      .update({
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, user_id, coins, amount_usd, slip_path")
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!claimed) {
      // Idempotent path: request was already processed. Do NOT credit again.
      const { data: existing } = await supabaseAdmin
        .from("topup_requests")
        .select("status, user_id, coins, amount_usd, reject_reason")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing) throw new Error("not_found");
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("user_id", existing.user_id)
        .maybeSingle();
      return {
        ok: true,
        status: existing.status as "approved" | "rejected",
        already_reviewed: true,
        credited: 0,
        coins: Number(existing.coins),
        amount_usd: Number(existing.amount_usd),
        new_balance: Number(w?.balance ?? 0),
        reject_reason: existing.reject_reason ?? null,
      };
    }

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", claimed.user_id)
      .maybeSingle();
    const current = Number(wallet?.balance ?? 0);
    const newBalance = current + Number(claimed.coins);
    // Use service-role client directly (RPC admin_set_balance checks auth.uid() which is null here)
    const { data: upserted, error: e2 } = await supabaseAdmin
      .from("wallets")
      .upsert(
        { user_id: claimed.user_id, balance: newBalance, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )
      .select("balance")
      .single();
    if (e2) {
      await supabaseAdmin
        .from("topup_requests")
        .update({ status: "pending", reviewed_by: null, reviewed_at: null })
        .eq("id", data.id);
      throw new Error(e2.message);
    }
    const bal = Number(upserted.balance);
    await supabaseAdmin.from("balance_changes").insert({
      user_id: claimed.user_id,
      changed_by: context.userId,
      old_balance: current,
      new_balance: newBalance,
      reason: `Topup approved: $${claimed.amount_usd} (+${claimed.coins})`,
    });
    const who = await userLabel(claimed.user_id);
    const caption = `✅ <b>Topup Approved</b>\n👤 ${who}\n💵 $${Number(claimed.amount_usd).toFixed(2)} → <b>+${Number(claimed.coins).toLocaleString()} coins</b>\n💼 New balance: ${bal.toLocaleString()}\n🆔 <code>${data.id}</code>`;
    await sendTopupNotice("topup_approved", claimed.slip_path, caption, data.id);
    return {
      ok: true,
      status: "approved" as const,
      already_reviewed: false,
      credited: Number(claimed.coins),
      coins: Number(claimed.coins),
      amount_usd: Number(claimed.amount_usd),
      new_balance: bal,
      reject_reason: null,
    };
  });

// Admin: reject
export const adminRejectTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().trim().min(1).max(300),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: claimed, error } = await supabaseAdmin
      .from("topup_requests")
      .update({
        status: "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        reject_reason: data.reason,
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, user_id, amount_usd, slip_path")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claimed) throw new Error("already_reviewed");
    const who = await userLabel(claimed.user_id);
    const caption = `❌ <b>Topup Rejected</b>\n👤 ${who}\n💵 $${Number(claimed.amount_usd).toFixed(2)}\n📝 ${data.reason}\n🆔 <code>${data.id}</code>`;
    await sendTopupNotice("topup_rejected", claimed.slip_path, caption, data.id);
    return { ok: true };
  });

// ============================================================
// Bakong auto-payment flow
// ============================================================

const BAKONG_TTL_SEC = 5 * 60; // 5 minutes

// Create a unique amount-bound KHQR + pending request row.
export const createBakongTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        amount_usd: z.number().min(0.5).max(10000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const rate = await coinsPerUsd();
    const coins = Math.round(data.amount_usd * rate);

    let billNumber: string;
    let qr: string;
    let md5: string;

    if (isIkhodeEnabled()) {
      // Route through iKhode KHQR Bridge — it registers the transaction with
      // NBC Bakong and returns the canonical qr_string + md5 used for status
      // polling. No local token management needed.
      const bridge = await generateIkhodeKhqr(data.amount_usd);
      billNumber = bridge.bill_number;
      qr = bridge.qr_string;
      md5 = bridge.md5;
    } else {
      billNumber = `DS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      if (typeof buildKhqr !== "function" || typeof md5Hex !== "function") {
        throw new Error(
          `[createBakongTopup] buildKhqr/md5Hex missing from "@/lib/bakong.server".`,
        );
      }
      const accountId = await getEffectiveBakongAccountId();
      qr = buildKhqr(data.amount_usd, billNumber, accountId);
      md5 = md5Hex(qr);
    }

    const expiresAt = new Date(Date.now() + BAKONG_TTL_SEC * 1000).toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("topup_requests")
      .insert({
        user_id: context.userId,
        amount_usd: data.amount_usd,
        coins,
        slip_path: null,
        qr_payload: qr,
        md5,
        expires_at: expiresAt,
        note: `Bakong auto · ${billNumber}`,
      })
      .select("id, created_at, status, amount_usd, coins, qr_payload, md5, expires_at")
      .single();
    if (error) throw new Error(error.message);

    const who = await formatUserById(context.userId);
    await notifyTelegram(
      `🆕 <b>Bakong QR Created</b>\n👤 ${who}\n💵 $${Number(data.amount_usd).toFixed(2)} → ${coins.toLocaleString()} coins\n🆔 <code>${row.id}</code>\n⏱ TTL ${BAKONG_TTL_SEC}s`,
      "topup_submitted",
    );

    return {
      id: row.id,
      qr_payload: row.qr_payload as string,
      md5: row.md5 as string,
      expires_at: row.expires_at as string,
      coins: row.coins,
      amount_usd: Number(row.amount_usd),
    };
  });

// Poll: ask Bakong if the QR has been paid. Credits wallet atomically on success.
// Returns a typed shape so the client can render specific messages instead of
// generic "error" toasts. Transient upstream issues (rate-limit, 5xx, network)
// return `{ status: "pending", error: ... }` so the client keeps polling with
// backoff. Hard errors (not_found / forbidden / missing_md5 / auth_error) throw.
export const verifyBakongTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("topup_requests")
      .select("id, user_id, status, md5, amount_usd, coins, expires_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found");
    if (row.user_id !== context.userId) throw new Error("forbidden");

    type Out =
      | { status: "approved"; new_balance: number; credited: number; error?: undefined }
      | {
          status: "pending";
          new_balance: 0;
          credited: 0;
          error?: "rate_limited" | "upstream_error" | "network_error" | "auth_error";
        }
      | { status: "rejected" | "expired"; new_balance: 0; credited: 0; error?: undefined };

    // Already final?
    if (row.status === "approved") {
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("user_id", row.user_id)
        .maybeSingle();
      return {
        status: "approved",
        new_balance: Number(w?.balance ?? 0),
        credited: 0,
      } satisfies Out;
    }
    if (row.status === "rejected" || row.status === "expired") {
      return {
        status: row.status as "rejected" | "expired",
        new_balance: 0,
        credited: 0,
      } satisfies Out;
    }

    // Expired?
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("topup_requests")
        .update({ status: "expired", reviewed_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending");
      return { status: "expired", new_balance: 0, credited: 0 } satisfies Out;
    }

    if (!row.md5) throw new Error("missing_md5");

    let check;
    try {
      check = await checkTransactionByMd5(row.md5);
    } catch (e) {
      if (e instanceof BakongApiError) {
        if (e.kind === "auth_error") {
          console.error("[verifyBakongTopup] Bakong auth_error — token invalid/expired", {
            id: row.id,
            status: e.status,
          });
        } else {
          console.warn("[verifyBakongTopup] transient Bakong error", {
            id: row.id,
            kind: e.kind,
            status: e.status,
          });
        }
        const errKind = e.kind === "auth_error" ? "auth_error" : "upstream_error";
        return { status: "pending", new_balance: 0, credited: 0, error: errKind } satisfies Out;
      }
      console.error("[verifyBakongTopup] unexpected error", e);
      return {
        status: "pending",
        new_balance: 0,
        credited: 0,
        error: "network_error",
      } satisfies Out;
    }

    // responseCode 0 = found/paid; non-zero = not found yet
    if (check.responseCode !== 0 || !check.data) {
      return { status: "pending", new_balance: 0, credited: 0 } satisfies Out;
    }

    // Optional sanity-check on amount
    const paid = Number(check.data.amount ?? 0);
    if (paid && Math.abs(paid - Number(row.amount_usd)) > 0.01) {
      console.warn("[bakong] amount mismatch", { expected: row.amount_usd, paid, id: row.id });
    }

    const { data: credit, error: cErr } = await supabaseAdmin.rpc("credit_topup_atomic", {
      _request_id: row.id,
      _bakong_response: JSON.parse(JSON.stringify(check)),
    });
    if (cErr) throw new Error(cErr.message);
    const result = Array.isArray(credit) ? credit[0] : credit;

    if (result?.ok && result?.credited > 0) {
      const who = await formatUserById(row.user_id);
      await notifyTelegram(
        `✅ <b>Bakong Auto-Topup Approved</b>\n👤 ${who}\n💵 $${Number(row.amount_usd).toFixed(2)} → <b>+${Number(row.coins).toLocaleString()} coins</b>\n💼 New balance: ${Number(result.new_balance).toLocaleString()}\n🔗 hash <code>${check.data.hash}</code>\n🆔 <code>${row.id}</code>`,
        "topup_approved",
      );
    }

    const status = (result?.status ?? "approved") as "approved" | "pending";
    if (status === "pending") {
      return { status: "pending", new_balance: 0, credited: 0 } satisfies Out;
    }
    return {
      status: "approved",
      new_balance: Number(result?.new_balance ?? 0),
      credited: Number(result?.credited ?? 0),
    } satisfies Out;
  });
