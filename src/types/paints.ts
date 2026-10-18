import { UnlockType } from "./enums";

export interface PaintResponse {
  id: number;
  color: string | null;
  unlockType: UnlockType;
  unlockValue: number;
  isActive: boolean;
}

export type PaintsListResponse = PaintResponse[];
