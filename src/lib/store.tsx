import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  getWalletState,
  buyGame as buyGameFn,
  checkoutCart as checkoutCartFn,
} from "./bakong.functions";
import gtaImg from "@/assets/game-gta.jpg";
import neonImg from "@/assets/game-neon.jpg";
import rpgImg from "@/assets/game-rpg.jpg";
import shadowImg from "@/assets/game-shadow.jpg";
import strategyImg from "@/assets/game-strategy.jpg";
import spaceImg from "@/assets/game-space.jpg";

export type Game = {
  id: string; title: string; category: string; description: string;
  price: number; discount?: number; image: string; badge?: string;
};
export type CoinPack = { id: string; name: string; coins: number; bonus?: number; price: number; tag: string };
export type Recommendation = { id: string; name: string; game: string; text: string; initial: string };
export type Profile = { name: string; avatar: string | null };

export const GAMES: Game[] = [
  { id: "gta5", title: "GTA 5 MODE", category: "ប្រណាំង", description: "ហ្គេមប្រណាំងតាមផ្លូវបែប Arcade ជាមួយក្រុមអនឡាញ។", price: 100, discount: 20, image: gtaImg, badge: "-20%" },
  { id: "neon", title: "Neon Drift Legends", category: "Racing", description: "ប្រណាំងក្នុងទីក្រុងសាយប័រ ជាមួយមិត្តភក្តិអនឡាញ។", price: 150, discount: 20, image: neonImg, badge: "ពិសេស" },
  { id: "realm", title: "Realmforge Odyssey", category: "RPG", description: "ដំណើរផ្សងព្រេងបែប Fantasy ដ៏ស្រស់ស្អាត។", price: 250, image: rpgImg },
  { id: "shadow", title: "Shadow Ops", category: "Action", description: "បេសកកម្មសម្ងាត់ពេលយប់ ជាមួយយុទ្ធសាស្ត្រ។", price: 180, discount: 15, image: shadowImg, badge: "-15%" },
  { id: "neonity", title: "Neonity Tactics", category: "Strategy", description: "កសាងទីក្រុងនាពេលអនាគត។", price: 200, image: strategyImg },
  { id: "void", title: "Void Wanderer", category: "Adventure", description: "ដំណើរផ្សងព្រេងលើភពផ្សេង។", price: 220, discount: 25, image: spaceImg, badge: "-25%" },
];

export const COIN_PACKS: CoinPack[] = [
  { id: "starter", name: "Starter Pack", coins: 500, price: 0.99, tag: "សាកល្បងទិញហ្គេមតម្លៃតូច" },
  { id: "gamer", name: "Gamer Pack", coins: 2500, bonus: 250, price: 4.99, tag: "+250 Bonus Coins" },
  { id: "pro", name: "Pro Pack", coins: 6000, bonus: 900, price: 9.99, tag: "+900 Bonus Coins" },
  { id: "elite", name: "Elite Pack", coins: 15000, bonus: 3000, price: 24.99, tag: "+3,000 Bonus Coins" },
];

const INITIAL_RECS: Recommendation[] = [
  { id: "1", name: "Dara Player", game: "GTA 5 MODE", text: "ទិញ Coins លឿន ហើយ UI ស្រួលប្រើ។", initial: "D" },
  { id: "2", name: "Sokha Gamer", game: "Realmforge Odyssey", text: "ការទូទាត់តាម KHQR ងាយស្រួលណាស់។", initial: "S" },
  { id: "3", name: "Vireak Pro", game: "Shadow Ops", text: "ហ្គេមមានជម្រើសច្រើន តម្លៃ Coins ងាយយល់។", initial: "V" },
];

type StoreCtx = {
  authed: boolean;
  loading: boolean;
  coins: number;
  cart: string[];
  library: string[];
  profile: Profile;
  recs: Recommendation[];
  isAdmin: boolean;
  addToCart: (id: string) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  buyGame: (id: string) => Promise<{ ok: boolean; msg: string }>;
  checkoutCart: () => Promise<{ ok: boolean; msg: string }>;
  refresh: () => void;
  signOut: () => Promise<void>;
  setProfile: (p: Profile) => void;
  addRec: (r: Omit<Recommendation, "id" | "initial">) => void;
  toggleAdmin: () => void;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useSession();
  const authed = !!session;
  const qc = useQueryClient();
  const fetchState = useServerFn(getWalletState);
  const buyFn = useServerFn(buyGameFn);
  const checkoutFn = useServerFn(checkoutCartFn);

  const [cart, setCart] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile>({ name: "Player", avatar: null });
  const [recs, setRecs] = useState<Recommendation[]>(INITIAL_RECS);
  const [isAdmin, setIsAdmin] = useState(false);

  const wallet = useQuery({
    queryKey: ["wallet", session?.user.id],
    queryFn: () => fetchState(),
    enabled: authed,
    staleTime: 5_000,
  });

  const buyMut = useMutation({
    mutationFn: (gameId: string) => buyFn({ data: { gameId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  });
  const checkoutMut = useMutation({
    mutationFn: (gameIds: string[]) => checkoutFn({ data: { gameIds } }),
    onSuccess: (r) => {
      if (r.ok) setCart([]);
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  const value: StoreCtx = {
    authed,
    loading: authLoading || (authed && wallet.isLoading),
    coins: wallet.data?.coins ?? 0,
    cart,
    library: wallet.data?.library ?? [],
    profile, recs, isAdmin,
    addToCart: (id) => setCart((c) => (c.includes(id) ? c : [...c, id])),
    removeFromCart: (id) => setCart((c) => c.filter((x) => x !== id)),
    clearCart: () => setCart([]),
    buyGame: async (id) => {
      if (!authed) return { ok: false, msg: "សូមចូលគណនីសិន" };
      try { const r = await buyMut.mutateAsync(id); return { ok: r.ok, msg: r.msg }; }
      catch (e: any) { return { ok: false, msg: e.message ?? "មានបញ្ហា" }; }
    },
    checkoutCart: async () => {
      if (!authed) return { ok: false, msg: "សូមចូលគណនីសិន" };
      if (cart.length === 0) return { ok: false, msg: "កន្ត្រកទទេ" };
      try { const r = await checkoutMut.mutateAsync(cart); return { ok: r.ok, msg: r.msg }; }
      catch (e: any) { return { ok: false, msg: e.message ?? "មានបញ្ហា" }; }
    },
    refresh: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
    signOut: async () => { await supabase.auth.signOut(); qc.clear(); },
    setProfile,
    addRec: (r) => setRecs((rs) => [{ id: crypto.randomUUID(), initial: r.name.charAt(0).toUpperCase() || "?", ...r }, ...rs]),
    toggleAdmin: () => setIsAdmin((a) => !a),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

export function gameFinalPrice(g: Game) {
  return Math.round(g.price * (1 - (g.discount ?? 0) / 100));
}
