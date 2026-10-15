import { z } from "zod";
import { referralStatusEnumSchema } from "./enums";
import { ReferralStatus } from "@/types/enums";

export const referralSchema = z.object({
  id: z.number().int().positive(),
  inviterUserId: z.number().int().positive(),
  invitedUserId: z.number().int().positive(),
  status: referralStatusEnumSchema.default(ReferralStatus.PENDING),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  qualifiedAt: z.union([z.string(), z.date()]).nullable(),
});

export const referralsListResponseSchema = z.array(referralSchema);

export type Referral = z.infer<typeof referralSchema>;
export type ReferralResponse = z.infer<typeof referralSchema>;
