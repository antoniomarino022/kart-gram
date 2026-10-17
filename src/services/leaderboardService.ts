import { apiClient } from "./apiClient";
import { LeaderboardsOverviewResponse } from "@/schemas/leaderboards";

export const leaderboardService = {
  /**
   * Recupera la classifica Top 10 per punteggio e Top 10 per condivisioni (referrals)
   */
  async getLeaderboards(): Promise<LeaderboardsOverviewResponse> {
    const { data } = await apiClient.get<LeaderboardsOverviewResponse>("/leaderboard");
    return data;
  },
};
