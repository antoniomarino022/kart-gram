import { ApiError } from "@/types/game";

/** Messaggio per il toast: quello dell'API se c'è, altrimenti uno generico. */
export const errorText = (err: unknown, fallback = "Errore di connessione, riprova") =>
  err instanceof ApiError && err.message ? err.message : fallback;
