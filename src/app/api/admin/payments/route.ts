import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { listPayments } from "@/server/admin/dashboard";
import { pageFrom } from "@/server/admin/pagination";

/** GET /api/admin/payments?page= - pagamenti in Stelle, dal più recente */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  return listPayments(pageFrom(params));
});
