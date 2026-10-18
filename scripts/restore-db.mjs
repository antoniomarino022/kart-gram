// Ripristina un backup di db:backup su un DB con lo schema già creato (npm run db:migrate).
// Non cancella nulla: inserisce le righe mancanti (ON CONFLICT DO NOTHING) in ordine di dipendenza e riallinea i contatori seriali.
// Uso: npm run db:restore -- backups/<cartella>
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "_info.json"))) {
  console.error("Uso: npm run db:restore -- backups/<cartella>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL mancante nel .env");
  process.exit(1);
}
const { tables } = JSON.parse(readFileSync(join(dir, "_info.json"), "utf8"));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  // ordine: prima le tabelle referenziate, poi quelle che le referenziano
  const fks = (await client.query(`
    SELECT tc.table_name AS child, ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`)).rows;
  const order = [];
  const visit = (t, seen = new Set()) => {
    if (order.includes(t) || seen.has(t)) return;
    seen.add(t);
    for (const { child, parent } of fks) if (child === t && parent !== t) visit(parent, seen);
    order.push(t);
  };
  Object.keys(tables).forEach((t) => visit(t));

  await client.query("BEGIN");
  for (const table of order.filter((t) => t in tables)) {
    const rows = JSON.parse(readFileSync(join(dir, `${table}.json`), "utf8"));
    let added = 0;
    for (const row of rows) {
      const cols = Object.keys(row);
      const values = cols.map((c) => (row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
      const res = await client.query(
        `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT DO NOTHING`,
        values,
      );
      added += res.rowCount ?? 0;
    }
    // i contatori serial ripartono dopo l'id più alto
    const seq = (await client.query(`SELECT pg_get_serial_sequence('"${table}"', 'id') AS s`).catch(() => ({ rows: [{}] }))).rows[0]?.s;
    if (seq) await client.query(`SELECT setval('${seq}', GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${table}"), 1))`);
    console.log(`${table}: ${added}/${rows.length} righe inserite`);
  }
  await client.query("COMMIT");
  console.log("Ripristino completato");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Ripristino annullato:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
