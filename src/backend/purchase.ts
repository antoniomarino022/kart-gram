import { openInvoice } from "@/telegram/webapp";
import type { Backend, Profile, RevivePay } from "./types";

const isMockLink = (l: string) => l.startsWith("mock://");

export async function buyWithStars(backend: Backend, itemId: string): Promise<Profile | null> {
  const { invoiceLink } = await backend.createStarsInvoice(itemId);
  if (!isMockLink(invoiceLink) && (await openInvoice(invoiceLink)) !== "paid") return null;
  return backend.getProfile();
}

export async function payRevive(backend: Backend, runId: string, pay: RevivePay): Promise<boolean> {
  const r = await backend.revive(runId, pay);
  if (!r.ok) return false;
  if (r.invoiceLink && !isMockLink(r.invoiceLink)) return (await openInvoice(r.invoiceLink)) === "paid";
  return true;
}
