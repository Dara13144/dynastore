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
  { id: "3", name: "Vireak Pro", game: "Shadow Ops", text: "ហ្គេមច្រើន តម្លៃ Coins យ