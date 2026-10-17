import { NextResponse } from "next/server";
import { db } from "@/db";
import { telegramUsers, referrals } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import type { LeaderboardsOverviewResponse } from "@/schemas/leaderboards";

// Risposta sempre dinamica in tempo reale (nessuna cache statica)
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard - Recupera la Top 10 giocatori per punteggio (topScore)
 * e la Top 10 giocatori più fedeli per numero di referral/condivisioni (mostLoyal)
 */
export async function GET() {
  try {
    const sharesCount = sql<number>`cast(count(${referrals.id}) as int)`;

    const [topScoreRows, mostLoyalRows] = await Promise.all([
      db
        .select({
          userId: telegramUsers.id,
          telegramId: telegramUsers.telegramId,
          username: telegramUsers.username,
          profileIcon: telegramUsers.profileIcon,
          score: telegramUsers.allTimeHighScore,
        })
        .from(telegramUsers)
        .orderBy(desc(telegramUsers.allTimeHighScore), telegramUsers.id)
        .limit(10),

      db
        .select({
          userId: telegramUsers.id,
          telegramId: telegramUsers.telegramId,
          username: telegramUsers.username,
          profileIcon: telegramUsers.profileIcon,
          sharesCount,
        })
        .from(telegramUsers)
        .leftJoin(referrals, eq(referrals.inviterUserId, telegramUsers.id))
        .groupBy(telegramUsers.id)
        .orderBy(desc(sharesCount), desc(telegramUsers.allTimeHighScore), telegramUsers.id)
        .limit(10),
    ]);

    const response: LeaderboardsOverviewResponse = {
      topScore: topScoreRows.map((row, index) => ({
        rank: index + 1,
        ...row,
      })),
      mostLoyal: mostLoyalRows.map((row, index) => ({
        rank: index + 1,
        ...row,
      })),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero delle classifiche:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}
