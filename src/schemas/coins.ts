import { z } from "zod";
import { coinReasonEnumSchema } from "./enums";

export const coinTransactionSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  amount: z.number().int(),
  reason: coinReasonEnumSchema,
  refId: z.number().int().nullable(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
});

export const createCoinTransactionSchema = z.object({
  amount: z.number().int(),
  reason: coinReasonEnumSchema,
  refId: z.number().int().optional().nullable(),
});

export const coinTransactionsListResponseSchema = z.array(coinTransactionSchema);

export type CoinTransaction = z.infer<typeof coinTransactionSchema>;
export type CreateCoinTransactionInput = z.infer<typeof createCoinTransactionSchema>;
export type CoinTransactionResponse = z.infer<typeof coinTransactionSchema>;
