import { UnlockType } from "./enums";

export interface CharacterResponse {
  id: number;
  name: string;
  subtype: string | null;
  bonusStat: string | null;
  unlockType: UnlockType;
  unlockValue: number;
  isActive: boolean;
}

export type CharactersListResponse = CharacterResponse[];
