import { and, eq } from "drizzle-orm";
import { referrals } from "@/db/schema";
import { CoinReason, ReferralStatus } from "@/types/enums";
import type { Tx } from "@/server/tx";
import { addCoins } from "./coins";

/** Monete date a chi ha invitato, quando l'invitato completa la sua prima partita. */
const REFERRAL_REWARD_COINS = 100;

/**
 * Se il giocatore era stato invitato e il referral è ancora PENDING,
 * lo qualifica e premia l'invitante.
 */
export async function qualifyPendingReferral(tx: Tx, invitedUserId: number): Promise<void> {
  const [pending] = await tx
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.invitedUserId, invitedUserId),
        eq(referrals.status, ReferralStatus.PENDING),
      ),
    )
    .limit(1);

  if (!pending) {
    return;
  }

  await tx
    .update(referrals)
    .set({
      status: ReferralStatus.QUALIFIED,
      qualifiedAt: new Date(),
    })
    .where(eq(referrals.id, pending.id));

  await addCoins(tx, pending.inviterUserId, REFERRAL_REWARD_COINS, CoinReason.REFERRAL);
}
