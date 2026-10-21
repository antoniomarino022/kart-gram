import type { z } from "zod";
import type { db, Tx } from "@/db";
import type { items, runs, telegramUsers } from "@/db/schema";
import type { UpgradeId } from "@/game/core/sim";
import type { finishRunBodySchema } from "@/schemas/game";

export type { UpgradeId };

export type Slot = "kart" | "paint" | "wheels" | "trail";
export type RevivePay = "coins" | "stars" | "owned";

export interface Profile {
  userId: string;
  name: string;
  coins: number;
  bestScore: number;
  /** ID degli oggetti posseduti */
  owned: string[];
  equipped: Record<Slot, string>;
  /** Livelli da 0 a 5 */
  upgrades: Record<UpgradeId, number>;
  /** Revive già comprati e non ancora usati (es. dallo starter pack) */
  revives: number;
}

export interface CatalogItem {
  id: string;
  kind: Slot | "coin_pack" | "starter_pack";
  name: string;
  priceCoins?: number;
  priceStars?: number;
  /** Modello 3D (es. "kart_bolt.glb") */
  model?: string;
  /** Colore per le vernici e scie */
  color?: string;
  /** Finitura per le vernici */
  finish?: "flat" | "metal" | "neon";
  /** Monete date da coin_pack / starter_pack */
  coins?: number;
  /** Revive dati dallo starter_pack */
  revives?: number;
  /** Oggetti dati dallo starter_pack */
  grants?: string[];
}

export interface RunResult {
  runId: string;
  score: number;
  distance: number;
  coins: number;
  durationMs: number;
  revived: boolean;
  /** Tick simulati: il server rigioca gli input fino a qui */
  ticks: number;
  /** Cambi di sterzata: +1 sinistra, -1 destra, 0 dritto */
  inputs: [tick: number, steer: -1 | 0 | 1][];
}

export interface FinishResult {
  newBest: boolean;
  coinsEarned: number;
  profile: Profile;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  score: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Tipi DB e API
// ---------------------------------------------------------------------------

export type DbClient = typeof db | Tx;

export type ItemRow = typeof items.$inferSelect;
export type PlayerRow = typeof telegramUsers.$inferSelect;
export type RunRow = typeof runs.$inferSelect;

export type GrantSource = "coins" | "stars" | "admin";


export interface IdParamContext {
  params: Promise<{ id: string }>;
}

export type FinishRunBody = z.infer<typeof finishRunBodySchema>;

export interface LeaderboardRow {
  userId: number;
  displayName: string | null;
  username: string | null;
  score: number | null;
}

export interface PaymentCheck {
  payload: string;
  telegramId: number;
  amount: number;
  currency: string;
}

export interface InvoiceRequest {
  purpose: "item" | "revive";
  itemId?: string;
  runId?: string;
  stars: number;
  title: string;
  description: string;
}

export type LeaderboardScope = 'score' | 'referrals';
