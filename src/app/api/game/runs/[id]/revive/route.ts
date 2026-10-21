import { and, eq, sql } from "drizzle-orm";
import { db, withTx } from "@/db";
import { runs, telegramUsers } from "@/db/schema";
import { requirePlayer } from "@/lib/auth";
import { REVIVE_PRICE } from "@/lib/constants";
import { createInvoice, lockPlayer, spendCoins } from "@/lib/game-helpers";
import { bad, handle } from "@/lib/http";
import { reviveBodySchema } from "@/schemas/game";
import { CoinReason } from "@/types/enums";
import type { IdParamContext } from "@/types/game";
import { parseRunId } from "../params";

/**
 * POST /api/game/runs/:id/revive
 *
 * Permette al giocatore di rianimarsi (una sola volta per partita) dopo un incidente o caduta.
 * Body: `{ pay: "coins" | "stars" | "owned" | "ad" }`
 *
 * Modalità di pagamento:
 * - `"stars"`: crea una fattura Telegram Stars (`REVIVE_PRICE.stars = 5`) e restituisce `{ ok: true, invoiceLink }`;
 * - `"coins"`: scala `REVIVE_PRICE.coins = 500` monete in transazione e segna `run.revived = true`;
 * - `"owned"`: consuma 1 revive già posseduto dal giocatore (`player.revives - 1`) e segna `run.revived = true`;
 * - `"ad"`: ricompensa per visione sponsor pubblicitario (gratis, 1 sola volta a partita).
 */
export const POST = handle(async (request: Request, context: IdParamContext) => {
  const player = await requirePlayer(request);
  const runId = await parseRunId(context);
  const { pay } = reviveBodySchema.parse(await request.json());

  // Revive tramite Telegram Stars: genera il link fattura
  if (pay === "stars") {
    const [run] = await db
      .select()
      .from(runs)
      .where(and(eq(runs.id, runId), eq(runs.userId, player.id)))
      .limit(1);

    if (!run || run.status !== "running" || run.revived) {
      throw bad("Revive non disponibile");
    }

    const invoiceLink = await createInvoice(player.id, {
      purpose: "revive",
      runId,
      stars: REVIVE_PRICE.stars,
      title: "Revive",
      description: "Riparti dal punto in cui sei caduto",
    });

    return { ok: true, invoiceLink };
  }

  // Revive immediato tramite monete, revive posseduto o sponsor (AD)
  return withTx(async (tx) => {
    const [run] = await tx
      .select()
      .from(runs)
      .where(and(eq(runs.id, runId), eq(runs.userId, player.id)))
      .for("update");

    if (!run || run.status !== "running" || run.revived) {
      throw bad("Revive non disponibile");
    }

    const locked = await lockPlayer(tx, player.id);

    if (pay === "coins") {
      if (locked.coins < REVIVE_PRICE.coins) {
        return { ok: false };
      }
      await spendCoins(tx, player.id, locked.coins, REVIVE_PRICE.coins, CoinReason.REVIVE);
    } else if (pay === "owned") {
      if (locked.revives <= 0) {
        return { ok: false };
      }
      await tx
        .update(telegramUsers)
        .set({ revives: sql`${telegramUsers.revives} - 1` })
        .where(eq(telegramUsers.id, player.id));
    } else if (pay === "ad") {
      // Visione video sponsor confermata: incrementa contatore totale ads viste
      await tx
        .update(telegramUsers)
        .set({ adsWatchedTotal: sql`${telegramUsers.adsWatchedTotal} + 1` })
        .where(eq(telegramUsers.id, player.id));
    }

    await tx
      .update(runs)
      .set({ revived: true })
      .where(eq(runs.id, run.id));

    return { ok: true };
  });
});
