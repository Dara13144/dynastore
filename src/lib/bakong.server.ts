// server.ts
// FULL WORKING BAKONG AUTO PAYMENT SYSTEM

import express from "express";
import dotenv from "dotenv";
import QRCode from "qrcode";
import crypto from "crypto";
dotenv.config();
const app = express();
app.use(express.json());
// =====================================
// ENV
// =====================================
const BAKONG_ACCOUNT_ID = process.env.BAKONG_ACCOUNT_ID || "ben_sothida@bkrt";
const BAKONG_MERCHANT_NAME = process.env.BAKONG_MERCHANT_NAME || "Dyna Store";
const BAKONG_MERCHANT_CITY = process.env.BAKONG_MERCHANT_CITY || "Phnom Penh";
const BAKONG_ACQUIRING_BANK = process.env.BAKONG_ACQUIRING_BANK || "Bakong";
const BAKONG_MERCHANT_PHONE = process.env.BAKONG_MERCHANT_PHONE || "+855974031041";
const BAKONG_DEVELOPER_TOKEN = process.env.BAKONG_DEVELOPER_TOKEN || "";
const PORT = process.env.PORT || 3000;
// =====================================
// MEMORY DATABASE
// =====================================
const payments = new Map();
// =====================================
// TLV HELPER
// =====================================
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");

  return `${id}${len}${value}`;
}
// =====================================
// CRC16
// =====================================

function crc16(payload: string): string {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// =====================================
// MD5
// =====================================

function md5Hex(input: string): string {
  return crypto.createHash("md5").update(input, "utf8").digest("hex");
}

// =====================================
// BUILD KHQR
// =====================================

function buildKhqr(amountUsd: number, billNumber: string): string {
  const merchantName = BAKONG_MERCHANT_NAME.slice(0, 25);

  const merchantCity = BAKONG_MERCHANT_CITY.slice(0, 15);

  const sub00 = tlv("00", BAKONG_ACCOUNT_ID);

  let mai = sub00;

  if (BAKONG_ACQUIRING_BANK) {
    mai += tlv("01", BAKONG_ACQUIRING_BANK);
  }

  const merchantAccountInfo = tlv("29", mai);

  let additional = tlv("01", billNumber.slice(0, 25));

  if (BAKONG_MERCHANT_PHONE) {
    additional += tlv("03", BAKONG_MERCHANT_PHONE.slice(0, 25));
  }

  const additionalData = tlv("62", additional);

  const amount = amountUsd.toFixed(2);

  const payloadNoCrc =
    tlv("00", "01") +
    tlv("01", "12") +
    merchantAccountInfo +
    tlv("52", "5999") +
    tlv("53", "840") +
    tlv("54", amount) +
    tlv("58", "KH") +
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    additionalData +
    "6304";

  const crc = crc16(payloadNoCrc);

  return payloadNoCrc + crc;
}

// =====================================
// CHECK BAKONG TRANSACTION
// =====================================

async function checkTransactionByMd5(md5: string) {
  const res = await fetch("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BAKONG_DEVELOPER_TOKEN}`,
    },
    body: JSON.stringify({ md5 }),
  });

  return res.json();
}

// =====================================
// CREATE PAYMENT
// =====================================

app.get("/api/payment/create", async (req, res) => {
  try {
    const amount = Number(req.query.amount || 1);

    const paymentId = crypto.randomUUID();

    const billNumber = `BILL-${Date.now()}`;

    const khqr = buildKhqr(amount, billNumber);

    const md5 = md5Hex(khqr);

    const qrImage = await QRCode.toDataURL(khqr, {
      width: 400,
      margin: 2,
    });

    payments.set(paymentId, {
      id: paymentId,
      amount,
      billNumber,
      md5,
      khqr,
      status: "pending",
      createdAt: Date.now(),
    });

    res.json({
      success: true,
      paymentId,
      amount,
      billNumber,
      md5,
      khqr,
      qrImage,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      success: false,
      error: "Failed to create payment",
    });
  }
});

// =====================================
// PAYMENT STATUS
// =====================================

app.get("/api/payment/status/:id", async (req, res) => {
  try {
    const payment = payments.get(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment not found",
      });
    }

    // already paid
    if (payment.status === "paid") {
      return res.json(payment);
    }

    // check Bakong API
    const result = await checkTransactionByMd5(payment.md5);

    console.log(result);

    if (result?.responseCode === 0 && result?.data) {
      payment.status = "paid";
      payment.paidAt = Date.now();

      payments.set(payment.id, payment);
    }

    res.json(payment);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      success: false,
      error: "Failed to check payment",
    });
  }
});

// =====================================
// FRONTEND DEMO
// =====================================

app.get("/", (req, res) => {
  res.send(`
  <html>
    <head>
      <title>Dyna Store Payment</title>

      <style>
        body {
          background: #0f172a;
          color: white;
          font-family: Arial;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          flex-direction: column;
        }

        button {
          padding: 12px 20px;
          border: none;
          border-radius: 10px;
          background: cyan;
          font-size: 18px;
          cursor: pointer;
        }

        img {
          margin-top: 20px;
          border-radius: 20px;
          background: white;
          padding: 10px;
          width: 320px;
        }
      </style>
    </head>

    <body>
      <h1>Dyna Store Bakong Payment</h1>

      <button onclick="createPayment()">
        Create $1 Payment
      </button>

      <div id="app"></div>

      <script>
        let paymentId = null;

        async function createPayment() {
          const res = await fetch('/api/payment/create?amount=1');

          const data = await res.json();

          paymentId = data.paymentId;

          document.getElementById('app').innerHTML = \`
            <img src="\${data.qrImage}" />

            <p>Payment ID: \${data.paymentId}</p>

            <p>Status: <span id="status">pending</span></p>
          \`;

          checkStatus();
        }

        async function checkStatus() {
          const interval = setInterval(async () => {
            const res = await fetch('/api/payment/status/' + paymentId);

            const data = await res.json();

            document.getElementById('status').innerText = data.status;

            if (data.status === 'paid') {
              clearInterval(interval);

              alert('Payment Success');
            }
          }, 3000);
        }
      </script>
    </body>
  </html>
  `);
});

// =====================================
// START SERVER
// =====================================

app.listen(PORT, () => {
  console.log("Bakong payment server running on port " + PORT);
});
