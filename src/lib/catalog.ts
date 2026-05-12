// Shared price tables (no asset imports — safe to import in server functions)
export const COIN_PACK_PRICES: Record<string, { coins: number; bonus?: number; price: number; name: string }> = {
  starter: { name: "Starter Pack", coins: 500, price: 0.99 },
  gamer:   { name: "Gamer Pack",   coins: 2500, bonus: 250, price: 4.99 },
  pro:     { name: "Pro Pack",     coins: 6000, bonus: 900, price: 9.99 },
  elite:   { name: "Elite Pack",   coins: 15000, bonus: 3000, price: 24.99 },
};

export const GAME_PRICES: Record<string, { title: string; price: number; discount?: number }> = {
  gta5:    { title: "GTA 5 MODE",          price: 100, discount: 20 },
  neon:    { title: "Neon Drift Legends",  price: 150, discount: 20 },
  realm:   { title: "Realmforge Odyssey",  price: 250 },
  shadow:  { title: "Shadow Ops",          price: 180, discount: 15 },
  neonity: { title: "Neonity Tactics",     price: 200 },
  void:    { title: "Void Wanderer",       price: 220, discount: 25 },
};

export function finalGamePrice(id: string): number | null {
  const g = GAME_PRICES[id];
  if (!g) return null;
  return Math.round(g.price * (1 - (g.discount ?? 0) / 100));
}
