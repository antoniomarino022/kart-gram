import { z } from "zod";
import { referralStatusEnumSchema } from "./enums";
import { ReferralStatus } from "@/types/enums";

export const referralResponseSchema = z.object({
  id: z.number().int().positive(),
  inviterUserId: z.number().int().positive(),
  invitedUserId: z.number().int().positive(),
  status: referralStatusEnumSchema.default(ReferralStatus.PENDING),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  qualifiedAt: z.union([z.string(), z.date()]).nullable(),
});

export const referralsListResponseSchema = z.array(referralResponseSchema);

export type ReferralResponse = z.infer<typeof referralResponseSchema>;
export type ReferralsListResponse = z.infer<typeof referralsListResponseSchema>;
