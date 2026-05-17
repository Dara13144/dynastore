import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  image: string;
  badge?: string | null;
  price_coins: number;
  file_path?: string | null;
  screenshots?: string[];
  preview_video_url?: string | null;
};
export type Recommendation = {
  id: string;
  name: string;
  game: string;
  text: string;
  initial: string;
};
export type Profile = {
  id?: string;
  user_id?: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at?: string;
  updated_at?: string;
};
export type LibraryItem = { id: string; game_id: string; kind: "wishlist" | "owned" };

const IMAGES: Record<string, string> = {
  gta5: gtaImg,
  neon: neonImg,
  realm: rpgImg,
  shadow: shadowImg,
  neonity: strategyImg,
  void: spaceImg,
};

const INITIAL_RECS: Recommendation[] = [
  {
    id: "1",
    name: "Dara Player",
    game: "GTA 5 MODE",
    text: "ក្រាហ្វិកស្អាត លេងបានគ្រប់ពេល។",
    initial: "D",
  },
  {
    id: "2",
    name: "Sokha Gamer",
    game: "Realmforge Odyssey",
    text: "រឿងវាសាហាយ ហ្គេមរីករាយណាស់។",
    initial: "S",
  },
  {
    id: "3",
    name: "Vireak Pro",
    game: "Shadow Ops",
    text: "ហ្គេមមានជម្រើសច្រើន គួរសាកល្បង។",
    initial: "V",
  },
];

const GUEST_PROFILE: Profile = { display_name: "Player", avatar_url: null, bio: null };

type StoreCtx = {
  authed: boolean;
  isAdmin: boolean;
  loading: boolean;
  profile: Profile;
  games: Game[];
  balance: number;
  library: LibraryItem[];
  recs: Recommendation[];
  signOut: () => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<Profile, "display_name" | "avatar_url" | "bio">>,
  ) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  setBalance: (n: number) => void;
  refreshLibrary: () => Promise<void>;
  toggleWishlist: (gameId: string) => Promise<{ error: string | null; added: boolean }>;
  removeFromLibrary: (id: string) => Promise<void>;
  addRec: (r: Omit<Recommendation, "id" | "initial">) => void;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const [profile, setProfile] = useState<Profile>(GUEST_PROFILE);
  const [games, setGames] = useState<Game[]>([]);
  const [balance, setBalance] = useState(0);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>(INITIAL_RECS);
  const [isAdmin, setIsAdmin] = useState(false);

  const userId = session?.user?.id ?? null;

  // Load games catalog (public)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("games").select("*").order("title");
      if (data)
        setGames(
          data.map(
            (g: {
              id: string;
              title: string;
              category: string;
              price_coins: number;
              description?: string | null;
              image_url?: string | null;
              file_path?: string | null;
              badge?: string | null;
            }) => ({
              id: g.id,
              title: g.title,
              category: g.category,
              description: g.description ?? "",
              image: g.image_url || IMAGES[g.id] || gtaImg,
              badge: g.badge,
              price_coins: g.price_coins,
              file_path: g.file_path ?? null,
            }),
          ),
        );
    })();
  }, []);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (data) setProfile(data as Profile);
  }, []);
  const fetchWallet = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", uid)
      .maybeSingle();
    setBalance(data?.balance ?? 0);
  }, []);
  const fetchLibrary = useCallback(async (uid: string) => {
    const { data } = await supabase.from("library").select("id, game_id, kind").eq("user_id", uid);
    setLibrary((data ?? []) as LibraryItem[]);
  }, []);

  const prevBalance = useRef<number | null>(null);
  useEffect(() => {
    if (!userId) {
      setProfile(GUEST_PROFILE);
      setBalance(0);
      setLibrary([]);
      setIsAdmin(false);
      prevBalance.current = null;
      return;
    }
    fetchProfile(userId);
    fetchWallet(userId);
    fetchLibrary(userId);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));

    // Live wallet updates: notify user when admin credits coins
    const ch = supabase
      .channel(`wallet:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = Number((payload.new as { balance?: number })?.balance ?? 0);
          const prev = prevBalance.current;
          setBalance(next);
          if (prev !== null && next > prev) {
            toast.success(
              `💰 +${(next - prev).toLocaleString()} coins · balance ${next.toLocaleString()}`,
            );
          }
          prevBalance.current = next;
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, fetchProfile, fetchWallet, fetchLibrary]);

  // Track balance for delta toast
  useEffect(() => {
    prevBalance.current = balance;
  }, [balance]);

  const value: StoreCtx = {
    authed: !!session,
    isAdmin,
    loading,
    profile,
    games,
    balance,
    library,
    recs,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshProfile: async () => {
      if (userId) await fetchProfile(userId);
    },
    refreshWallet: async () => {
      if (userId) await fetchWallet(userId);
    },
    setBalance,
    refreshLibrary: async () => {
      if (userId) await fetchLibrary(userId);
    },
    updateProfile: async (patch) => {
      if (!userId) return { error: "សូមចូលគណនីជាមុនសិន" };
      const { data, error } = await supabase
        .from("profiles")
        .update({ ...patch })
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return { error: error.message };
      if (data) setProfile(data as Profile);
      return { error: null };
    },
    toggleWishlist: async (gameId) => {
      if (!userId) return { error: "សូមចូលគណនីជាមុនសិន", added: false };
      const existing = library.find((l) => l.game_id === gameId && l.kind === "wishlist");
      if (existing) {
        await supabase.from("library").delete().eq("id", existing.id);
        setLibrary((ls) => ls.filter((l) => l.id !== existing.id));
        return { error: null, added: false };
      }
      const { data, error } = await supabase
        .from("library")
        .insert({ user_id: userId, game_id: gameId, kind: "wishlist" })
        .select()
        .maybeSingle();
      if (error) return { error: error.message, added: false };
      if (data) setLibrary((ls) => [...ls, data as LibraryItem]);
      return { error: null, added: true };
    },
    removeFromLibrary: async (id) => {
      await supabase.from("library").delete().eq("id", id);
      setLibrary((ls) => ls.filter((l) => l.id !== id));
    },
    addRec: (r) =>
      setRecs((rs) => [
        { id: crypto.randomUUID(), initial: r.name.charAt(0).toUpperCase() || "?", ...r },
        ...rs,
      ]),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}
