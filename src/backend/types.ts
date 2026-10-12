import type { UpgradeId } from "@/game/core/sim";

export type { UpgradeId };
export type Slot = "kart" | "paint" | "wheels" | "trail";
export type RevivePay = "coins" | "stars" | "owned";

export interface Profile {
  userId: string;
  name: string;
  coins: number;
  bestScore: number;
  owned: string[]; // id degli oggetti posseduti
  equipped: Record<Slot, string>;
  upgrades: Record<UpgradeId, number>; // da 0 a 5
  revives: number; // revive già comprati e non ancora usati (es. dallo starter pack)
}

export interface CatalogItem {
  id: string;
  kind: Slot | "coin_pack" | "starter_pack";
  name: string;
  priceCoins?: number;
  priceStars?: number;
  model?: string; // es. "kart_bolt.glb"
  color?: string; // per le vernici
  finish?: "flat" | "metal" | "neon"; // per le vernici
  coins?: number; // monete date da coin_pack / starter_pack
  revives?: number; // revive dati dallo starter_pack
  grants?: string[]; // oggetti dati dallo starter_pack
}

export interface RunResult {
  runId: string;
  score: number;
  distance: number;
  coins: number;
  durationMs: number;
  revived: boolean;
  /** cambi di sterzata: +1 sinistra, -1 destra, 0 dritto */
  inputs: [tick: number, steer: -1 | 0 | 1][];
}

export interface FinishResult { newBest: boolean; coinsEarned: number; profile: Profile }

export interface LeaderboardEntry { rank: number; userId: string; name: string; score: number }

export interface Backend {
  getProfile(): Promise<Profile>;
  getCatalog(): Promise<CatalogItem[]>;
  startRun(): Promise<{ runId: string; seed: number }>;
  finishRun(r: RunResult): Promise<FinishResult>;
  revive(runId: string, pay: RevivePay): Promise<{ ok: boolean; invoiceLink?: string }>;
  equip(slot: Slot, itemId: string): Promise<Profile>;
  buyWithCoins(itemId: string): Promise<Profile>;
  createStarsInvoice(itemId: string): Promise<{ invoiceLink: string }>;
  buyUpgrade(upgradeId: UpgradeId): Promise<Profile>;
  getLeaderboard(scope: "global" | "weekly"): Promise<LeaderboardEntry[]>;
}

export class BackendError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
