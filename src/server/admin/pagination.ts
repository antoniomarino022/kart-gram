export const PAGE_SIZE = 50;

/** Numero di pagina dal parametro `page` della query string: 1 se assente o non valido. */
export function pageFrom(params: URLSearchParams): number {
  return Math.max(1, Number(params.get("page")) || 1);
}

/** Stringa di ricerca dal parametro `q`, ripulita e limitata a 100 caratteri. */
export function searchQueryFrom(params: URLSearchParams): string {
  return (params.get("q") ?? "").trim().slice(0, 100);
}
