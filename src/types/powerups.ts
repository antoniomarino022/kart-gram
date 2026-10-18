import { UnlockType } from "./enums";

export interface PowerupResponse {
  id: number;
  name: string;
  unlockType: UnlockType;
  unlockValue: number;
  isActive: boolean;
}

export type PowerupsListResponse = PowerupResponse[];
