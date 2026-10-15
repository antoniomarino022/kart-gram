"use server";

import { db } from "@/db";
import { cars } from "@/db/schema";
import { CarResponse } from "@/schemas/cars";
import { handleActionError } from "@/utils/errors";
import { eq } from "drizzle-orm";

/**
 * Recupera la lista di cars dal database
 */
export async function getCars(): Promise<CarResponse[]> {
  try {
    const carsList = await db.select().from(cars);
    return carsList;
  } catch (error) {
    handleActionError(error, "Impossibile recuperare la lista di cars.");
  }
}

/**
 * Recupera una car dal database tramite ID
 */
export async function getCarById(id: number): Promise<CarResponse> {
  try {
    const [car] = await db.select().from(cars).where(eq(cars.id, id)).limit(1);

    if (!car) {
      throw new Error(`Macchina con id ${id} non trovata.`);
    }

    return car;
  } catch (error) {
    handleActionError(error, "Impossibile recuperare la macchina.");
  }
}
