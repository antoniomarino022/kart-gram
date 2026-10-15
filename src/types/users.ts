export interface UserResponse {
  id: number;
  telegramId: number;
  username: string | null;
  profileIcon: string | null;
  coins: number;
  allTimeHighScore: number;
  adsWatchedTotal: number;
  equippedCarId: number | null;
  equippedCharacterId: number | null;
  equippedMapId: number | null;
  createdAt: string | Date | null;
}
