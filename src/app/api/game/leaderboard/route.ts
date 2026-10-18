import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { leaderboard } from "@/server/game/leaderboard";

/** GET /api/game/leaderboard?scope=global|weekly */
export const GET = handle(async (request: Request) => {
  await requirePlayer(request);
  const scope = new URL(request.url).searchParams.get("scope") === "weekly" ? "weekly" : "global";
  return leaderboard(scope);
});
