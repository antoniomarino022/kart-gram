import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { stats } from "@/server/admin-players";

/** GET /api/admin/stats - numeri per la panoramica della dashboard */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  return stats();
});
