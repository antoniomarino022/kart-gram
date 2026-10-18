import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { listPlayers } from "@/server/admin-players";

/** GET /api/admin/players?q=&page= - giocatori, cercabili per nome, username, id o telegram id */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  return listPlayers((params.get("q") ?? "").trim().slice(0, 100), page);
});
