import { UnlockType } from "./enums";

export interface MapResponse {
  id: number;
  name: string;
  mapType: string | null;
  unlockType: UnlockType;
  unlockValue: number;
  isActive: boolean;
}

export type MapsListResponse = MapResponse[];
