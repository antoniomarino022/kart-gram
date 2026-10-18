import { AdPurpose, PaymentStatus } from "./enums";

export interface AdViewResponse {
  id: number;
  userId: number;
  purpose: AdPurpose;
  carId: number | null;
  paintId: number | null;
  wheelId: number | null;
  characterId: number | null;
  mapId: number | null;
  runId: number | null;
  providerRef: string | null;
  rewardCoins: number | null;
  viewedAt: string | Date | null;
}

export type AdViewsListResponse = AdViewResponse[];

export interface PaymentResponse {
  id: number;
  userId: number;
  carId: number | null;
  paintId: number | null;
  wheelId: number | null;
  characterId: number | null;
  mapId: number | null;
  starsAmount: number;
  telegramChargeId: string;
  status: PaymentStatus;
  createdAt: string | Date | null;
}

export type PaymentsListResponse = PaymentResponse[];
