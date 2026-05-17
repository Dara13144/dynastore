// src/lib/topup.functions.ts

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import QRCode from "qrcode";

import { buildKhqr, md5Of, checkTransactionByMd5 } from "./bakong.server";

const payments = new Map();

export const createBakongTopup = createServerFn({
  method: "POST",
})
  .validator(
    z.object({
      amount_usd: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const billNumber = `BILL-${Date.now()}`;

    const qr_payload = buildKhqr(data.amount_usd, billNumber);

    const md5 = md5Of(qr_payload);

    const qrImage = await QRCode.toDataURL(qr_payload);

    const id = crypto.randomUUID();

    payments.set(id, {
      id,
      amount: data.amount_usd,
      md5,
      status: "pending",
    });

    return {
      id,
      md5,
      qr_payload,
      qrImage,
      coins: data.amount_usd * 100,
    };
  });

export const verifyBakongTopup = createServerFn({
  method: "POST",
})
  .validator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const payment = payments.get(data.id);

    if (!payment) {
      return {
        status: "not_found",
      };
    }

    if (payment.status === "approved") {
      return payment;
    }

    const bakong = await checkTransactionByMd5(payment.md5);

    if (bakong?.responseCode === 0 && bakong?.data) {
      payment.status = "approved";

      payments.set(payment.id, payment);

      return {
        status: "approved",
        coins: payment.amount * 100,
      };
    }

    return {
      status: "pending",
    };
  });
