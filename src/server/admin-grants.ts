import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";

/** Gli oggetti regalati da uno starter pack devono esistere, altrimenti la consegna fallirebbe dopo il pagamento. */
export async function checkGrants(grants: string[] | null | undefined): Promise<string | null> {
  if (!grants?.length) return null;
  const found = await db.select({ id: items.id }).from(items).where(inArray(items.id, grants));
  const missing = grants.filter((g) => !found.some((f) => f.id === g));
  return missing.length ? `Oggetti regalati inesistenti: ${missing.join(", ")}` : null;
}
