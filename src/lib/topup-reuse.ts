// Pure helper for createTopup's insert-or-reuse loop. Extracted so it can be
// unit-tested independently of TanStack server-fn middleware / Supabase env.

export type ReusedTx = {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  amountUsd: number;
  coins: number;
};

export type TopupResult =
  | {
      md5: string;
      qrPayload: string;
      amountUsd: number;
      coins: number;
      packName: string;
      billNumber: string | null;
      reused: true;
      reusedTx: ReusedTx;
    }
  | {
      md5: string;
      qrPayload: string;
      amountUsd: number;
      coins: number;
      packName: string;
      billNumber: string | null;
      reused?: false;
    };

export type ExistingRow = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  amount_usd: number | string;
  coins: number;
  qr_payload: string;
};

export interface TopupDeps {
  build: () => { md5: string; payload: string; billNumber: string };
  insert: (row: {
    user_id: string;
    md5: string;
    qr_payload: string;
    amount_usd: number;
    coins: number;
    status: "pending";
  }) => Promise<{ error: { message: string } | null }>;
  fetchByMd5: (md5: string) => Promise<{ data: ExistingRow | null }>;
  now?: () => number;
}

export async function tryInsertOrReuseTopup(opts: {
  userId: string;
  pack: { name: string; price: number; coins: number; bonus?: number };
  deps: TopupDeps;
  maxAttempts?: number;
}): Promise<TopupResult> {
  const { userId, pack, deps } = opts;
  const totalCoins = pack.coins + (pack.bonus ?? 0);
  const now = deps.now ?? (() => Date.now());
  const maxAttempts = opts.maxAttempts ?? 4;

  let lastErr: string | null = null;
  let md5 = "";
  let payload = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const built = deps.build();
    md5 = built.md5;
    payload = built.payload;
    const { error } = await deps.insert({
      user_id: userId,
      md5,
      qr_payload: payload,
      amount_usd: pack.price,
      coins: totalCoins,
      status: "pending",
    });
    if (!error) {
      lastErr = null;
      break;
    }
    lastErr = error.message;
    if (/duplicate key|unique constraint/i.test(error.message)) {
      const { data: existing } = await deps.fetchByMd5(md5);
      if (
        existing &&
        existing.user_id === userId &&
        existing.status === "pending" &&
        new Date(existing.expires_at).getTime() > now() &&
        Number(existing.amount_usd) === pack.price &&
        existing.coins === totalCoins
      ) {
        return {
          md5,
          qrPayload: existing.qr_payload,
          amountUsd: pack.price,
          coins: totalCoins,
          packName: pack.name,
          reused: true,
          reusedTx: {
            id: existing.id,
            status: existing.status,
            createdAt: existing.created_at,
            expiresAt: existing.expires_at,
            amountUsd: Number(existing.amount_usd),
            coins: existing.coins,
          },
        };
      }
      continue;
    }
    break;
  }
  if (lastErr) throw new Error(lastErr);

  return {
    md5,
    qrPayload: payload,
    amountUsd: pack.price,
    coins: totalCoins,
    packName: pack.name,
  };
}
