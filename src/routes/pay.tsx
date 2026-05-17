import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "Bakong Payment Test" },
      { name: "description", content: "Create a KHQR payment and poll its status until paid." },
    ],
  }),
  component: PayPage,
});

type CreateResp = {
  paymentId?: string;
  qr?: string;
  qrImage?: string;
  amount?: number;
  md5?: string;
  error?: string;
  reqId?: string;
};

type StatusResp = {
  status?: "pending" | "paid" | string;
  amount?: number;
  paidAt?: string | null;
  error?: string;
  reqId?: string;
};

export default function PayPage() {
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<CreateResp | null>(null);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendLog = (line: string) =>
    setLog((l) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...l].slice(0, 50));

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const createPayment = async () => {
    stopPolling();
    setLoading(true);
    setPayment(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/payment/create?amount=${encodeURIComponent(amount)}`, {
        method: "POST",
      });
      const data: CreateResp = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setPayment(data);
      appendLog(`Created payment ${data.paymentId} (${data.amount} USD)`);
      startPolling(data.paymentId!);
    } catch (e: unknown) {
      appendLog(`Create failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id: string) => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/payment/status/${id}`);
        const data: StatusResp = await res.json();
        setStatus(data);
        appendLog(`Status: ${data.status ?? data.error ?? "?"}`);
        if (data.status === "paid") stopPolling();
      } catch (e: unknown) {
        appendLog(`Status error: ${(e as Error).message}`);
      }
    };
    tick();
    pollRef.current = setInterval(tick, 3000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Bakong Payment Test</h1>
          <p className="text-sm text-muted-foreground">
            Create a KHQR payment and poll until it is paid.
          </p>
        </header>

        <div className="flex items-end gap-3">
          <label className="flex-1">
            <span className="block text-sm mb-1">Amount (USD)</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <button
            onClick={createPayment}
            disabled={loading}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create payment"}
          </button>
        </div>

        {payment && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm">
              <div>
                <strong>ID:</strong> {payment.paymentId}
              </div>
              <div>
                <strong>Amount:</strong> ${payment.amount}
              </div>
              <div className="break-all">
                <strong>MD5:</strong> {payment.md5}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <span className={status?.status === "paid" ? "text-green-600 font-semibold" : ""}>
                  {status?.status ?? "pending"}
                </span>
              </div>
            </div>
            {payment.qrImage && (
              <img
                src={payment.qrImage}
                alt="KHQR code"
                className="w-64 h-64 mx-auto border rounded-md bg-white p-2"
              />
            )}
            {payment.qr && (
              <details>
                <summary className="text-xs cursor-pointer">Raw KHQR payload</summary>
                <pre className="text-xs break-all whitespace-pre-wrap">{payment.qr}</pre>
              </details>
            )}
          </div>
        )}

        {log.length > 0 && (
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold mb-1">Log</div>
            <ul className="text-xs space-y-0.5 max-h-56 overflow-auto">
              {log.map((l, i) => (
                <li key={i} className="font-mono">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
