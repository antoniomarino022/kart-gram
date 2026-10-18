import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

type TxDb = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<TxDb["transaction"]>[0]>[0];

/**
 * Transazione interattiva (SELECT … FOR UPDATE, più scritture che riescono o falliscono insieme).
 * Il driver HTTP non le supporta: qui si apre un Pool via WebSocket per la sola richiesta.
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const poolDb = drizzlePool(pool, { schema });
    return await poolDb.transaction(fn);
  } finally {
    await pool.end().catch(() => {});
  }
}
