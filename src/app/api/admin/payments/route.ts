import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { listPayments } from "@/server/admin-players";

/** GET /api/admin/payments?page= - pagamenti in Stelle, dal più recente */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  return listPayments(Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1));
});
