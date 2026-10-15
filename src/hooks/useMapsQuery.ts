"use client";

import { useQuery } from "@tanstack/react-query";
import { getMaps, getMapById } from "@/app/actions/mapActions";

export const mapQueryKeys = {
  all: ["maps"] as const,
  detail: (id: number) => ["maps", id] as const,
};

/**
 * Hook per recuperare tutte le mappe con TanStack Query
 */
export function useMaps() {
  return useQuery({
    queryKey: mapQueryKeys.all,
    queryFn: () => getMaps(),
  });
}

/**
 * Hook per recuperare una singola mappa per ID
 */
export function useMap(id: number) {
  return useQuery({
    queryKey: mapQueryKeys.detail(id),
    queryFn: () => getMapById(id),
    enabled: typeof id === "number" && id > 0,
  });
}
