import { getInitData, openInvoice } from "@/telegram/webapp";
import {
  ApiError,
  type CatalogItem,
  type FinishResult,
  type LeaderboardEntry,
  type Profile,
  type RevivePay,
  type RunResult,
  type Slot,
  type UpgradeId,
} from "@/types/game";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api/game").replace(/\/$/, "");

export async function requestApi<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  fetchFn: typeof fetch = fetch,
): Promise<T> {
  const res = await fetchFn(BASE_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `tma ${getInitData()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;

    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {
      /* testo semplice */
    }

    throw new ApiError(res.status, message || res.statusText);
  }

  return res.json() as Promise<T>;
}

export const getProfile = () =>
  requestApi<Profile>("GET", "/profile");

export const getCatalog = () =>
  requestApi<CatalogItem[]>("GET", "/catalog");

export const startRun = () =>
  requestApi<{
    runId: string;
    seed: number;
    upgrades?: Record<UpgradeId, number>;
    wheels?: string;
  }>("POST", "/runs");

export const finishRun = (run: RunResult) =>
  requestApi<FinishResult>("POST", `/runs/${encodeURIComponent(run.runId)}/finish`, run);

export const revive = (runId: string, pay: RevivePay) =>
  requestApi<{ ok: boolean; invoiceLink?: string }>(
    "POST",
    `/runs/${encodeURIComponent(runId)}/revive`,
    { pay },
  );

export const equip = (slot: Slot, itemId: string) =>
  requestApi<Profile>("POST", "/equip", { slot, itemId });

export const buyWithCoins = (itemId: string) =>
  requestApi<Profile>("POST", "/shop/coins", { itemId });

export const createStarsInvoice = (itemId: string) =>
  requestApi<{ invoiceLink: string }>("POST", "/shop/stars-invoice", { itemId });

export const buyUpgrade = (upgradeId: UpgradeId) =>
  requestApi<Profile>("POST", "/upgrades", { upgradeId });

export const getLeaderboard = (scope: 'score' | 'referrals') =>
  requestApi<LeaderboardEntry[]>("GET", `/leaderboard?scope=${scope}`);

// ---------------------------------------------------------------------------
// Flussi di acquisto con Telegram Stars
// ---------------------------------------------------------------------------

/** I pacchetti di monete non entrano tra i posseduti: per loro conta il saldo, per il resto il possesso. */
function isDelivered(
  before: Profile,
  now: Profile,
  item: Pick<CatalogItem, "id" | "kind">,
): boolean {
  return item.kind === "coin_pack"
    ? now.coins > before.coins
    : now.owned.includes(item.id);
}

export async function buyWithStars(
  item: Pick<CatalogItem, "id" | "kind">,
): Promise<Profile | null> {
  const before = await getProfile();
  const { invoiceLink } = await createStarsInvoice(item.id);
  const status = await openInvoice(invoiceLink);

  if (status !== "paid" && status !== "pending") {
    return null;
  }

  let profile = await getProfile();

  for (let i = 0; i < 8 && !isDelivered(before, profile, item); i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    profile = await getProfile();
  }

  return profile;
}

export async function payRevive(runId: string, pay: RevivePay): Promise<boolean> {
  const res = await revive(runId, pay);
  if (!res.ok) {
    return false;
  }

  if (res.invoiceLink) {
    return (await openInvoice(res.invoiceLink)) === "paid";
  }

  return true;
}

export const claimAdReward = () => requestApi<{ success: boolean; coinsEarned: number; profile: Profile }>('POST', '/ads/reward');
