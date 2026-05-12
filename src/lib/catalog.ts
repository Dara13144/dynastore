// Shared (client + server) catalog of games and coin packs
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
  price: number;       // price in COINS
  discount?: number;
  image: string;
  badge?: string;
};

export type CoinPack = {
  id: string;
  name: string;
  coins: number;
  bonus?: number;
  price: number;       // USD
  tag: string;
};

export const GAMES: Game[] = [
  { id: "gta5", title: "GTA 5 MODE", category: "ប្រណាំង", description: "ហ្គេមប្រណាំងតាមផ្លូវបែប Arcade ជាមួយក្រុមអនឡាញ