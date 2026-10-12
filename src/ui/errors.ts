import { BackendError } from "@/backend/types";

/** Messaggio per il toast: quello del backend se c'è, altrimenti uno generico. */
export const errorText = (err: unknown, fallback = "Errore di connessione, riprova") =>
  err instanceof BackendError && err.message ? err.message : fallback;
