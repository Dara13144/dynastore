import { createContext, useContext, useState, type ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import gtaImg from "@/assets/game-gta.jpg";
import neonImg from "@/assets/game-neon.jpg";
import rpgImg from "@/assets/game-rpg.jpg";
import shadowImg from "@/assets/game-shadow.jpg";
import strategyImg from "@/assets/game-strategy.jpg";
import spaceImg from "@/assets/game-space.jpg";

export type Game = {
  id: string; title: string; category: string; description: string;
  image: string; badge?: string;
};
export type Recommendation = { id: string; name: string; game: string; text: string; initial: string };
export type Profile = { name: string; avatar: string | null };

export const GAMES: Game[] = [
  { id: "gta5", title: "GTA 5 MODE", category: "ប្រណាំង", description: "ហ្គេមប្រណាំងតាមផ្លូវបែប Arcade ជាមួយក្រុមអនឡាញ។", image: gtaImg, badge: "ពេញនិយម" },
  { id: "neon", title: "Neon Drift Legends", category: "Racing", description: "ប្រណាំងក្នុងទីក្រុងសាយប័រ ជាមួយមិត្តភក្តិអនឡាញ។", image: neonImg, badge: "ពិសេស" },
  { id: "realm", title: "Realmforge Odyssey", category: "RPG", description: "ដំណើរផ្សងព្រេងបែប Fantasy ដ៏ស្រស់ស្អាត។", image: rpgImg },
  { id: "shadow", title: "Shadow Ops", category: "Action", description: "បេសកកម្មសម្ងាត់ពេលយប់ ជាមួយយុទ្ធសាស្ត្រ។", image: shadowImg },
  { id: "neonity", title: "Neonity Tactics", category: "Strategy", description: "កសាងទីក្រុងនាពេលអនាគត។", image: strategyImg },
  { id: "void", title: "Void Wanderer", category: "Adventure", description: "ដំណើរផ្សងព្រេងលើភពផ្សេង។", image: spaceImg },
];

const INITIAL_RECS: Recommendation[] = [
  { id: "1", name: "Dara Player", game: "GTA 5 MODE", text: "ក្រាហ្វិកស្អាត លេងបានគ្រប់ពេល។", initial: "D" },
  { id: "2", name: "Sokha Gamer", game: "Realmforge Odyssey", text: "រឿងវាសាហាយ ហ្គេមរីករាយណាស់។", initial: "S" },
  { id: "3", name: "Vireak Pro", game: "Shadow Ops", text: "ហ្គេមមានជម្រើសច្រើន គួរសាកល្បង។", initial: "V" },
];

type StoreCtx = {
  authed: boolean;
  loading: boolean;
  profile: Profile;
  recs: Recommendation[];
  signOut: () => Promise<void>;
  setProfile: (p: Profile) => void;
  addRec: (r: Omit<Recommendation, "id" | "initial">) => void;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const [profile, setProfile] = useState<Profile>({ name: "Player", avatar: null });
  const [recs, setRecs] = useState<Recommendation[]>(INITIAL_RECS);

  const value: StoreCtx = {
    authed: !!session,
    loading,
    profile,
    recs,
    signOut: async () => { await supabase.auth.signOut(); },
    setProfile,
    addRec: (r) => setRecs((rs) => [{ id: crypto.randomUUID(), initial: r.name.charAt(0).toUpperCase() || "?", ...r }, ...rs]),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}
