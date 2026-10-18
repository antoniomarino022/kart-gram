import { openInvoice } from "@/telegram/webapp";
import type { Backend, CatalogItem, Profile, RevivePay } from "./types";

const isMockLink = (l: string) => l.startsWith("mock://");

export async function buyWithStars(backend: Backend, item: Pick<CatalogItem, "id" | "kind">): Promise<Profile | null> {
  const itemId = item.id;
  const before = await backend.getProfile();
  const { invoiceLink } = await backend.createStarsInvoice(itemId);
  if (isMockLink(invoiceLink)) return backend.getProfile();
  const status = await openInvoice(invoiceLink);
  // "pending": il backend assegna l'oggetto quando il pagamento si conclude
  if (status !== "paid" && status !== "pending") return null;
  // l'oggetto lo consegna il webhook successful_payment, che può arrivare qualche istante dopo
  let profile = await backend.getProfile();
  for (let i = 0; i < 8 && !delivered(before, profile, item); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    profile = await backend.getProfile();
  }
  return profile;
}

/** I pacchetti di monete non entrano tra i posseduti: per loro conta il saldo, per il resto il possesso. */
const delivered = (before: Profile, now: Profile, item: Pick<CatalogItem, "id" | "kind">) =>
  item.kind === "coin_pack" ? now.coins > before.coins : now.owned.includes(item.id);

export async function payRevive(backend: Backend, runId: string, pay: RevivePay): Promise<boolean> {
  const r = await backend.revive(runId, pay);
  if (!r.ok) return false;
  if (r.invoiceLink && !isMockLink(r.invoiceLink)) return (await openInvoice(r.invoiceLink)) === "paid";
  return true;
}
