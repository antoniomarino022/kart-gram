"use client";

import { useQuery } from "@tanstack/react-query";
import { leaderboardService } from "@/services/leaderboardService";

export const leaderboardQueryKeys = {
  all: ["leaderboards"] as const,
};

/**
 * Hook per recuperare le classifiche (Top 10 Score e Top 10 Più Fedeli / Referral)
 * Si aggiorna automaticamente ogni 15 secondi e ad ogni fine partita.
 */
export function useLeaderboards() {
  return useQuery({
    queryKey: leaderboardQueryKeys.all,
    queryFn: () => leaderboardService.getLeaderboards(),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}
