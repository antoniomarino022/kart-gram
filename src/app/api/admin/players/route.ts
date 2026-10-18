import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { listPlayers } from "@/server/admin/players";
import { pageFrom, searchQueryFrom } from "@/server/admin/pagination";

/** GET /api/admin/players?q=&page= - giocatori, cercabili per nome, username, id o telegram id */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  return listPlayers(searchQueryFrom(params), pageFrom(params));
});
