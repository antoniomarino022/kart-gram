import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Rate Limiter per la conclusione delle partite (/api/game/runs/[id]/finish).
 * Consente un massimo di 15 richieste al minuto per utente.
 */
export const runFinishLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, "1 m"),
  prefix: "ratelimit:run_finish",
  analytics: false,
});
