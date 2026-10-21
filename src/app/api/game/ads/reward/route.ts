import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { withTx } from "@/db";
import { coinTransactions, telegramUsers } from "@/db/schema";
import { requirePlayer } from "@/lib/auth";
import { buildProfile } from "@/lib/game-helpers";
import { handle, HttpError } from "@/lib/http";
import { redis } from "@/lib/redis";
import { CoinReason } from "@/types/enums";

const AD_REWARD_COINS = 50;
const AD_COOLDOWN_SECONDS = 60; // Minimo 60 secondi tra una ricompensa e l'altra

/**
 * POST /api/game/ads/reward
 *
 * Accredita +50 monete al giocatore che ha completato la visione di una pubblicità.
 * Protezione Anti-Spam tramite Redis (cooldown 60s per giocatore).
 */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);

  // Rate Limiting anti-farming tramite Redis
  const cooldownKey = `ad:cooldown:${player.id}`;
  try {
    const isAllowed = await redis.set(cooldownKey, "1", {
      nx: true,
      ex: AD_COOLDOWN_SECONDS,
    });

    if (!isAllowed) {
      throw new HttpError(429, "Attendi prima di guardare un altro video");
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error("Redis ad cooldown error:", err);
  }

  // Accredito monete e incremento contatore ads
  await withTx(async (tx) => {
    await tx
      .update(telegramUsers)
      .set({
        coins: sql`${telegramUsers.coins} + ${AD_REWARD_COINS}`,
        adsWatchedTotal: sql`${telegramUsers.adsWatchedTotal} + 1`,
      })
      .where(eq(telegramUsers.id, player.id));

    await tx.insert(coinTransactions).values({
      userId: player.id,
      amount: AD_REWARD_COINS,
      reason: CoinReason.AD,
    });
  });

  const profile = await buildProfile(player.id);

  return {
    success: true,
    coinsEarned: AD_REWARD_COINS,
    profile,
  };
});
