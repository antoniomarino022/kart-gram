"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { equipCar, buyCarWithCoins, watchAdForCar } from "@/app/actions/carActions";
import { EquipCarInput, BuyCarInput } from "@/schemas/cars";
import { carService } from "@/services/carService";

export const carQueryKeys = {
  all: ["cars"] as const,
  detail: (id: number) => ["cars", id] as const,
};

/**
 * Hook per recuperare la lista di tutte le auto con TanStack Query
 */
export function useCars() {
  return useQuery({
    queryKey: carQueryKeys.all,
    queryFn: () => carService.getCars(),
  });
}

/**
 * Hook per recuperare una singola auto per ID
 */
export function useCar(id: number) {
  return useQuery({
    queryKey: carQueryKeys.detail(id),
    queryFn: () => carService.getCarById(id),
    enabled: typeof id === "number" && id > 0,
  });
}

/**
 * Hook per equipaggiare un'auto
 * Invalida automaticamente i dati dell'utente per riflettere subito l'auto equipaggiata
 */
export function useEquipCar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EquipCarInput) => equipCar(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

/**
 * Hook per acquistare un'auto con le monete
 */
export function useBuyCarWithCoins() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyCarInput) => buyCarWithCoins(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}

/**
 * Hook per registrare la visione di un annuncio (ADS) per sbloccare un'auto
 */
export function useWatchAdForCar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyCarInput) => watchAdForCar(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}
