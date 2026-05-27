import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStockCounts } from "@/lib/stock.functions";

export function useStockCounts(gameIds?: string[]) {
  const fn = useServerFn(getStockCounts);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const key = gameIds ? gameIds.slice().sort().join(",") : "";

  const refresh = useCallback(async () => {
    try {
      const r = await fn({ data: gameIds && gameIds.length ? { gameIds } : {} });
      setCounts(r.counts || {});
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, key]);

  useEffect(() => {
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener("stock:refresh", onRefresh);
    window.addEventListener("wallet:refresh", onRefresh);
    return () => {
      window.removeEventListener("stock:refresh", onRefresh);
      window.removeEventListener("wallet:refresh", onRefresh);
    };
  }, [refresh]);

  return { counts, loading, refresh };
}
