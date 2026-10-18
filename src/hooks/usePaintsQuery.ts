"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { equipPaint, buyPaintWithCoins, watchAdForPaint } from "@/app/actions/paintActions";
import { EquipPaintInput, BuyPaintInput } from "@/schemas/paints";
import { paintService } from "@/services/paintService";

export const paintQueryKeys = {
  all: ["paints"] as const,
  detail: (id: number) => ["paints", id] as const,
};

/**
 * Hook per recuperare la lista di tutte le vernici con TanStack Query
 */
export function usePaints() {
  return useQuery({
    queryKey: paintQueryKeys.all,
    queryFn: () => paintService.getPaints(),
  });
}

/**
 * Hook per recuperare una singola vernice per ID
 */
export function usePaint(id: number) {
  return useQuery({
    queryKey: paintQueryKeys.detail(id),
    queryFn: () => paintService.getPaintById(id),
    enabled: typeof id === "number" && id > 0,
  });
}

/**
 * Hook per equipaggiare una vernice
 */
export function useEquipPaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EquipPaintInput) => equipPaint(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

/**
 * Hook per acquistare una vernice con le monete
 */
export function useBuyPaintWithCoins() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyPaintInput) => buyPaintWithCoins(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}

/**
 * Hook per registrare la visione di un annuncio (ADS) per sbloccare una vernice
 */
export function useWatchAdForPaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyPaintInput) => watchAdForPaint(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}
