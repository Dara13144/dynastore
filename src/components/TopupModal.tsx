// src/components/TopupModal.tsx

import { useEffect, useState } from "react";

import { createBakongTopup, verifyBakongTopup } from "@/lib/topup.functions";

export default function TopupModal() {
  const [amount, setAmount] = useState(1);

  const [payment, setPayment] = useState<any>();

  const [status, setStatus] = useState("pending");

  async function createPayment() {
    const res = await createBakongTopup({
      data: {
        amount_usd: amount,
      },
    });

    setPayment(res);
  }

  useEffect(() => {
    if (!payment) return;

    const interval = setInterval(async () => {
      const res = await verifyBakongTopup({
        data: {
          id: payment.id,
        },
      });

      setStatus(res.status);

      if (res.status === "approved") {
        clearInterval(interval);

        alert(`✅ +${res.coins} coins credited`);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [payment]);

  return (
    <div className="p-6 rounded-2xl bg-zinc-900 text-white max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Bakong Auto Payment</h1>

      {!payment && (
        <div className="space-y-4">
          <input
            type="number"
            value={amount}
            min={1}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full p-3 rounded-xl bg-zinc-800"
          />

          <button onClick={createPayment} className="w-full bg-cyan-500 p-3 rounded-xl font-bold">
            Create Payment
          </button>
        </div>
      )}

      {payment && (
        <div className="text-center">
          <img src={payment.qrImage} className="bg-white p-2 rounded-xl mx-auto w-72" />

          <p className="mt-4">Amount: ${amount.toFixed(2)}</p>

          <p className="mt-2">Status: {status}</p>

          {status === "approved" && <div className="mt-4 text-green-400 text-xl font-bold">✅ Payment Success</div>}
        </div>
      )}
    </div>
  );
}
