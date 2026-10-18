import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Errore previsto (input non valido, monete insufficienti…): diventa una risposta con lo stato indicato. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const bad = (message: string) => new HttpError(400, message);

/** Avvolge un route handler: HttpError e ZodError diventano 4xx, il resto 500 senza dettagli. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const data = await fn(...args);
      return data instanceof Response ? data : NextResponse.json(data);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ message: err.message }, { status: err.status });
      if (err instanceof ZodError) return NextResponse.json({ message: "Dati non validi", errors: err.flatten().fieldErrors }, { status: 400 });
      console.error("[api]", err);
      return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
    }
  };
}

