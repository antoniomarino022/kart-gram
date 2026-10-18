// Backup dei dati del DB: un file JSON per tabella in backups/<data-ora>/ (cartella esclusa da git).
// Contiene dati dei giocatori e gli hash delle password admin: non condividerlo.
// Lo schema è nelle migrazioni (drizzle/), quindi qui bastano i dati. Ripristino: npm run db:restore -- backups/<cartella>
// Uso: npm run db:backup
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL mancante nel .env");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// sessioni e token di verifica sono credenziali temporanee: non servono per ripristinare e non devono finire su disco
const SKIP = new Set(["session", "verification"]);
const tables = (await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`)
  .map((r) => r.table_name)
  .filter((t) => !SKIP.has(t));
const dir = join("backups", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
mkdirSync(dir, { recursive: true });

const summary = {};
for (const table of tables) {
  const rows = await sql.query(`SELECT * FROM "${table}"`);
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
  summary[table] = rows.length;
}
writeFileSync(join(dir, "_info.json"), JSON.stringify({ createdAt: new Date().toISOString(), tables: summary }, null, 2));
console.log(`Backup in ${dir}`);
console.table(summary);
