import { ReferralStatus } from "./enums";

export interface ReferralResponse {
  id: number;
  inviterUserId: number;
  invitedUserId: number;
  status: ReferralStatus;
  createdAt: string | Date | null;
  qualifiedAt: string | Date | null;
}

export type ReferralsListResponse = ReferralResponse[];
