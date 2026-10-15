"use server";

import { db } from "@/db";
import { maps } from "@/db/schema";
import { MapResponse } from "@/schemas/maps";
import { handleActionError } from "@/utils/errors";
import { eq } from "drizzle-orm";

/**
 * Recupera la lista di tutte le mappe dal database
 */
export async function getMaps(): Promise<MapResponse[]> {
  try {
    const mapsList = await db.select().from(maps);
    return mapsList;
  } catch (error) {
    handleActionError(error, "Impossibile recuperare la lista delle mappe.");
  }
}

/**
 * Recupera una singola mappa dal database tramite ID
 */
export async function getMapById(id: number): Promise<MapResponse> {
  try {
    const [map] = await db
      .select()
      .from(maps)
      .where(eq(maps.id, id))
      .limit(1);

    if (!map) {
      throw new Error(`Mappa con id ${id} non trovata.`);
    }

    return map;
  } catch (error) {
    handleActionError(error, "Impossibile recuperare la mappa.");
  }
}
