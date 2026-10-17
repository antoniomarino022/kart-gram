"use client";

import { useQuery } from "@tanstack/react-query";
import { userService } from "@/services/userService";

export const userQueryKeys = {
  profile: (userId?: number) => (userId ? (["user", userId] as const) : (["user"] as const)),
};

/**
 * Hook per recuperare il profilo completo del giocatore (dati utente, oggetti posseduti, progressi di sblocco e referral).
 * La queryKey ["user", userId] viene invalidata automaticamente da tutte le mutazioni (equip, acquisti, ads, fine partita).
 */
export function useUserProfile(params?: { userId?: number; telegramId?: number }) {
  return useQuery({
    queryKey: userQueryKeys.profile(params?.userId),
    queryFn: () => userService.getUserProfile(params),
  });
}
