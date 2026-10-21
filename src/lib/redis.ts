import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * Client Upstash Redis configurato con Keep-Alive e timeout rapido.
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Esegue un comando Redis con un timeout stretto (default 250ms).
 * Se Redis è lento o irraggiungibile, fallisce subito senza bloccare la richiesta dell'utente.
 */
export async function withRedisTimeout<T>(promise: Promise<T>, timeoutMs = 250): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch (err) {
    console.warn("[redis] operazione fallita o timeout:", err);
    return null;
  }
}

/**
 * Rate Limiter per la conclusione delle partite (/api/game/runs/[id]/finish).
 */
export const runFinishLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, "1 m"),
  prefix: "ratelimit:run_finish",
  analytics: false,
});
