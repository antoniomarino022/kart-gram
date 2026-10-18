import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";

type TxDb = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<TxDb["transaction"]>[0]>[0];

/**
 * Transazione interattiva (SELECT … FOR UPDATE, più scritture che riescono o falliscono insieme).
 * Il driver HTTP di `@/db` non le supporta: qui si apre un Pool via WebSocket per la sola richiesta.
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle(pool, { schema });
    return await db.transaction(fn);
  } finally {
    // un errore in chiusura (dopo il COMMIT) non deve far sembrare fallita un'operazione riuscita
    await pool.end().catch(() => {});
  }
}
