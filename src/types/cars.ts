import { UnlockType } from "./enums";

export interface CarResponse {
  id: number;
  name: string;
  carType: string;
  speed: number;
  baseLives: number;
  unlockType: UnlockType;
  unlockValue: number;
  isActive: boolean;
}

export type CarsListResponse = CarResponse[];
