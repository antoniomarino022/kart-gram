import { z } from "zod";
import {
  UnlockType,
  ReferralStatus,
  RunStatus,
  LeaderboardType,
  CoinReason,
  PaymentStatus,
  AdPurpose,
} from "@/types/enums";

export const unlockTypeEnumSchema = z.nativeEnum(UnlockType);
export const referralStatusEnumSchema = z.nativeEnum(ReferralStatus);
export const runStatusEnumSchema = z.nativeEnum(RunStatus);
export const leaderboardTypeEnumSchema = z.nativeEnum(LeaderboardType);
export const coinReasonEnumSchema = z.nativeEnum(CoinReason);
export const paymentStatusEnumSchema = z.nativeEnum(PaymentStatus);
export const adPurposeEnumSchema = z.nativeEnum(AdPurpose);

export type UnlockTypeEnum = z.infer<typeof unlockTypeEnumSchema>;
export type ReferralStatusEnum = z.infer<typeof referralStatusEnumSchema>;
export type RunStatusEnum = z.infer<typeof runStatusEnumSchema>;
export type LeaderboardTypeEnum = z.infer<typeof leaderboardTypeEnumSchema>;
export type CoinReasonEnum = z.infer<typeof coinReasonEnumSchema>;
export type PaymentStatusEnum = z.infer<typeof paymentStatusEnumSchema>;
export type AdPurposeEnum = z.infer<typeof adPurposeEnumSchema>;
