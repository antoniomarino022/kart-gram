"use client";

import { useQuery } from "@tanstack/react-query";
import { getCars, getCarById } from "@/app/actions/carActions";

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
    queryFn: () => getCars(),
  });
}

/**
 * Hook per recuperare una singola auto per ID
 */
export function useCar(id: number) {
  return useQuery({
    queryKey: carQueryKeys.detail(id),
    queryFn: () => getCarById(id),
    enabled: typeof id === "number" && id > 0,
  });
}
