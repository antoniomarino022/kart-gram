import { z } from "zod";
import { adPurposeEnumSchema, paymentStatusEnumSchema } from "./enums";
import { PaymentStatus } from "@/types/enums";

export const adViewResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  purpose: adPurposeEnumSchema,
  carId: z.number().int().positive().nullable(),
  characterId: z.number().int().positive().nullable(),
  mapId: z.number().int().positive().nullable(),
  runId: z.number().int().positive().nullable(),
  providerRef: z.string().max(255).nullable(),
  rewardCoins: z.number().int().default(0).nullable(),
  viewedAt: z.union([z.string(), z.date()]).nullable(),
});

export const recordAdViewSchema = z.object({
  purpose: adPurposeEnumSchema,
  carId: z.number().int().positive().optional().nullable(),
  characterId: z.number().int().positive().optional().nullable(),
  mapId: z.number().int().positive().optional().nullable(),
  runId: z.number().int().positive().optional().nullable(),
  providerRef: z.string().max(255).optional().nullable(),
  rewardCoins: z.number().int().default(0).optional(),
});

export const paymentResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive().nullable(),
  characterId: z.number().int().positive().nullable(),
  mapId: z.number().int().positive().nullable(),
  starsAmount: z.number().int(),
  telegramChargeId: z.string().max(255),
  status: paymentStatusEnumSchema.default(PaymentStatus.PENDING),
  createdAt: z.union([z.string(), z.date()]).nullable(),
});

export const createPaymentSchema = z.object({
  carId: z.number().int().positive().optional().nullable(),
  characterId: z.number().int().positive().optional().nullable(),
  mapId: z.number().int().positive().optional().nullable(),
  starsAmount: z.number().int().positive(),
  telegramChargeId: z.string().max(255),
});

export const adViewsListResponseSchema = z.array(adViewResponseSchema);
export const paymentsListResponseSchema = z.array(paymentResponseSchema);

export type AdViewResponse = z.infer<typeof adViewResponseSchema>;
export type AdViewsListResponse = z.infer<typeof adViewsListResponseSchema>;
export type RecordAdViewInput = z.infer<typeof recordAdViewSchema>;
export type PaymentResponse = z.infer<typeof paymentResponseSchema>;
export type PaymentsListResponse = z.infer<typeof paymentsListResponseSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
