import { UnlockType } from "./enums";

export interface WheelResponse {
  id: number;
  name: string;
  capacity: number;
  unlockType: UnlockType;
  unlockValue: number;
  isActive: boolean;
}

export type WheelsListResponse = WheelResponse[];
