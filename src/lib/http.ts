import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Errore previsto (input non valido, monete insufficienti…): diventa una risposta con lo stato indicato. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const bad = (message: string) => new HttpError(400, message);

/** Numero di pagina dal parametro `page` della query string: 1 se assente o non valido. */
export function pageFrom(params: URLSearchParams): number {
  return Math.max(1, Number(params.get("page")) || 1);
}

/** Stringa di ricerca dal parametro `q`, ripulita e limitata a 100 caratteri. */
export function searchQueryFrom(params: URLSearchParams): string {
  return (params.get("q") ?? "").trim().slice(0, 100);
}

/** Avvolge un route handler: HttpError e ZodError diventano 4xx, il resto 500 senza dettagli. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const data = await fn(...args);
      return data instanceof Response ? data : NextResponse.json(data);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ message: err.message }, { status: err.status });
      }

      if (err instanceof ZodError) {
        return NextResponse.json(
          { message: "Dati non validi", errors: err.flatten().fieldErrors },
          { status: 400 },
        );
      }

      console.error("[api]", err);
      return NextResponse.json(
        { message: "Errore interno del server" },
        { status: 500 },
      );
    }
  };
}
