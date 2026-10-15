import { RunStatus } from "./enums";

export interface GameRunResponse {
  id: number;
  userId: number;
  carId: number;
  characterId: number;
  mapId: number;
  status: RunStatus;
  startingLives: number;
  revivesUsed: number;
  score: number;
  coinsCollected: number;
  startedAt: string | Date | null;
  endedAt: string | Date | null;
}

export type GameRunsListResponse = GameRunResponse[];
