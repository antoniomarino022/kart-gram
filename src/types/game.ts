import type { z } from "zod";
import type { db } from "@/db";
import type { items, runs, telegramUsers } from "@/db/schema";
import type { finishRunBodySchema } from "@/schemas/game";
import type { Tx } from "@/server/tx";

export type DbClient = Tx | typeof db;

export type ItemRow = typeof items.$inferSelect;
export type PlayerRow = typeof telegramUsers.$inferSelect;
export type RunRow = typeof runs.$inferSelect;

export type GrantSource = "coins" | "stars" | "grant" | "admin";
export type LeaderboardScope = "global" | "weekly";

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
