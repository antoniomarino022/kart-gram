import { z } from "zod";
import { coinReasonEnumSchema } from "./enums";

export const coinTransactionResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  amount: z.number().int(),
  reason: coinReasonEnumSchema,
  refId: z.number().int().nullable(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
});

export const coinTransactionsListResponseSchema = z.array(coinTransactionResponseSchema);

export const createCoinTransactionSchema = z.object({
  amount: z.number().int(),
  reason: coinReasonEnumSchema,
  refId: z.number().int().optional().nullable(),
});

export type CoinTransactionResponse = z.infer<typeof coinTransactionResponseSchema>;
export type CoinTransactionsListResponse = z.infer<typeof coinTransactionsListResponseSchema>;
export type CreateCoinTransactionInput = z.infer<typeof createCoinTransactionSchema>;
