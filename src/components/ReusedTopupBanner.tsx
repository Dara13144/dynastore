import { RefreshCw } from "lucide-react";

export type ReusedTopupInfo = {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  coins: number;
  amountUsd: number;
};

export function ReusedTopupBanner({ info }: { info: ReusedTopupInfo }) {
  return (
    <div
      data-testid="reused-topup-banner"
      className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <RefreshCw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="font-semibold text-amber-700 dark:text-amber-400">
          Reused existing pending KHQR
        </span>
      </div>
      <div className="text-muted-foreground mb-2">
        A duplicate MD5 was detected, so this active topup was reused instead of
        creating a new one.
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
        <dt className="text-muted-foreground">Tx ID</dt>
        <dd data-testid="reused-tx-id" className="break-all">{info.id}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd data-testid="reused-tx-status" className="uppercase">{info.status}</dd>
        <dt className="text-muted-foreground">Amount</dt>
        <dd data-testid="reused-tx-amount">
          ${info.amountUsd.toFixed(2)} · {info.coins} coins
        </dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd data-testid="reused-tx-created">
          {new Date(info.createdAt).toLocaleString()}
        </dd>
        <dt className="text-muted-foreground">Expires</dt>
        <dd data-testid="reused-tx-expires">
          {new Date(info.expiresAt).toLocaleString()}
        </dd>
      </dl>
    </div>
  );
}
