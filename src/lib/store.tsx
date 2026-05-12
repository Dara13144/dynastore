import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import gtaImg from "@/assets/game-gta.jpg";
import neonImg from "@/assets/game-neon.jpg";
import rpgImg from "@/assets/game-rpg.jpg";
import shadowImg from "@/assets/game-shadow.jpg";
import strategyImg from "@/assets/game-strategy.jpg";
import spaceImg from "@/assets/game-space.jpg";

export type Game = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  discount?: number;
  image: string;
  badge?: string;
};

export type CoinPack = {
  id: string;
  name: string;
  coins: number;
  bonus?: number;
  price: number;
  tag: string;
};

export type Recommendation = {
  id: string;
  name: string;
  game: string;
  text: string;
  initial: string;
};

export const GAMES: Game[] = [
  { id: "gta5", title: "GTA 5 MODE", category: "ប្រណាំង", description: "ហ្គេមប្រណាំងតាមផ្លូវបែប Arcade ជាមួយក្រុមអនឡាញ និងផ្លូវក្នុងទីក្រុងពេលយប់។", price: 100, discount: 20, image: gtaImg, badge: "-20%" },
  { id: "neon", title: "Neon Drift Legends", category: "Racing", description: "ប្រណាំងក្នុងទីក្រុងសាយប័រដែលមានភ្លើង ជាមួយមិត្តភក្តិអនឡាញ។", price: 150, discount: 20, image: neonImg, badge: "ពិសេស" },
  { id: "realm", title: "Realmforge Odyssey", category: "RPG", description: "ដំណើរផ្សងព្រេងបែប Fantasy ដ៏ស្រស់ស្អាតក្នុងពិភពលោកដ៏អស្ចារ្យ។", price: 250, image: rpgImg },
  { id: "shadow", title: "Shadow Ops", category: "Action", description: "បេសកកម្មសម្ងាត់ពេលយប់ ជាមួយឧបករណ៍ទាន់សម័យ និងការប្រយុទ្ធយុទ្ធសាស្ត្រ។", price: 180, discount: 15, image: shadowImg, badge: "-15%" },
  { id: "neonity", title: "Neonity Tactics", category: "Strategy", description: "កសាងទីក្រុងនាពេលអនាគត ហើយដឹកនាំក្រុមរបស់អ្នកទៅជោគជ័យ។", price: 200, image: strategyImg },
  { id: "void", title: "Void Wanderer", category: "Adventure", description: "ដំណើរផ្សងព្រេងលើភពផ្សេង ជាមួយរឿងរ៉ាវដ៏ជ្រៅជ្រះ។", price: 220, discount: 25, image: spaceImg, badge: "-25%" },
];

export const COIN_PACKS: CoinPack[] = [
  { id: "starter", name: "Starter Pack", coins: 500, price: 0.99, tag: "សាកល្បងទិញហ្គេមតម្លៃតូច" },
  { id: "gamer", name: "Gamer Pack", coins: 2500, bonus: 250, price: 4.99, tag: "+250 Bonus Coins" },
  { id: "pro", name: "Pro Pack", coins: 6000, bonus: 900, price: 9.99, tag: "+900 Bonus Coins" },
  { id: "elite", name: "Elite Pack", coins: 15000, bonus: 3000, price: 24.99, tag: "+3,000 Bonus Coins" },
];

const INITIAL_RECS: Recommendation[] = [
  { id: "1", name: "Dara Player", game: "GTA 5 MODE", text: "ទិញ Coins លឿន ហើយអាចយកទៅទិញហ្គេមបានងាយ។ UI ស្រួលប្រើណាស់។", initial: "D" },
  { id: "2", name: "Sokha Gamer", game: "Realmforge Odyssey", text: "មានប្រូម៉ូសិនល្អៗ ហើយការទូទាត់តាម KHQR ងាយស្រួលសម្រាប់ខ្ញុំ។", initial: "S" },
  { id: "3", name: "Vireak Pro", game: "Shadow Ops", text: "ហ្គេមមានជម្រើសច្រើន តម្លៃ Coins មើលងាយយល់ ហើយទិញបានភ្លាមៗ។", initial: "V" },
];

export type Profile = { name: string; avatar: string | null };
export type Order = { id: string; gameId: string; title: string; price: number; date: string };

type StoreCtx = {
  coins: number;
  cart: string[];
  library: string[];
  orders: Order[];
  profile: Profile;
  recs: Recommendation[];
  isAdmin: boolean;
  addToCart: (id: string) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  buyGame: (id: string) => { ok: boolean; msg: string };
  checkoutCart: () => { ok: boolean; msg: string };
  addCoins: (n: number) => void;
  setProfile: (p: Profile) => void;
  addRec: (r: Omit<Recommendation, "id" | "initial">) => void;
  toggleAdmin: () => void;
};

const Ctx = createContext<StoreCtx | null>(null);

const KEY = "dynastore-state-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [coins, setCoins] = useState(0);
  const [cart, setCart] = useState<string[]>([]);
  const [library, setLibrary] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Profile>({ name: "Player", avatar: null });
  const [recs, setRecs] = useState<Recommendation[]>(INITIAL_RECS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setCoins(s.coins ?? 0);
        setCart(s.cart ?? []);
        setLibrary(s.library ?? []);
        setOrders(s.orders ?? []);
        setProfile(s.profile ?? { name: "Player", avatar: null });
        setRecs(s.recs ?? INITIAL_RECS);
        setIsAdmin(s.isAdmin ?? false);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify({ coins, cart, library, orders, profile, recs, isAdmin }));
  }, [coins, cart, library, orders, profile, recs, isAdmin, hydrated]);

  const finalPrice = (g: Game) => Math.round(g.price * (1 - (g.discount ?? 0) / 100));

  const value: StoreCtx = {
    coins, cart, library, orders, profile, recs, isAdmin,
    addToCart: (id) => setCart((c) => (c.includes(id) ? c : [...c, id])),
    removeFromCart: (id) => setCart((c) => c.filter((x) => x !== id)),
    clearCart: () => setCart([]),
    buyGame: (id) => {
      const g = GAMES.find((x) => x.id === id);
      if (!g) return { ok: false, msg: "ហ្គេមមិនមាន" };
      if (library.includes(id)) return { ok: false, msg: "អ្នកមានហ្គេមនេះរួចហើយ" };
      const price = finalPrice(g);
      if (coins < price) return { ok: false, msg: "Coins មិនគ្រប់គ្រាន់" };
      setCoins((c) => c - price);
      setLibrary((l) => [...l, id]);
      setOrders((o) => [{ id: crypto.randomUUID(), gameId: id, title: g.title, price, date: new Date().toLocaleString() }, ...o]);
      return { ok: true, msg: `ទិញ ${g.title} ជោគជ័យ` };
    },
    checkoutCart: () => {
      const items = cart.map((id) => GAMES.find((g) => g.id === id)).filter(Boolean) as Game[];
      const items2 = items.filter((g) => !library.includes(g.id));
      const total = items2.reduce((s, g) => s + finalPrice(g), 0);
      if (total === 0) return { ok: false, msg: "កន្ត្រកគ្មានហ្គេមថ្មី" };
      if (coins < total) return { ok: false, msg: "Coins មិនគ្រប់គ្រាន់សម្រាប់កន្ត្រកទាំងមូល" };
      setCoins((c) => c - total);
      setLibrary((l) => [...l, ...items2.map((g) => g.id)]);
      setOrders((o) => [...items2.map((g) => ({ id: crypto.randomUUID(), gameId: g.id, title: g.title, price: finalPrice(g), date: new Date().toLocaleString() })), ...o]);
      setCart([]);
      return { ok: true, msg: `ទិញ ${items2.length} ហ្គេម — សរុប ${total} Coins` };
    },
    addCoins: (n) => setCoins((c) => c + n),
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
