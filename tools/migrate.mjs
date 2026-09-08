/**
 * Applies the SQL migrations in prisma/migrations, in order, inside a
 * transaction, tracking what has already run in _migrations.
 *
 * Why not `prisma migrate deploy`? Prisma's migration engine cannot connect to
 * the PGlite dev server (the runtime driver adapter can — see src/lib/prisma.ts).
 * Against a real managed Postgres you can use either this or `prisma migrate
 * deploy`; both read the same checked-in SQL files.
 *
 *   node tools/migrate.mjs
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

try {
  process.loadEnvFile(".env");
} catch {
  // URL may already be exported.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dir = path.join(process.cwd(), "prisma", "migrations");
if (!existsSync(dir)) {
  console.error("No prisma/migrations directory.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name        text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`);

const applied = new Set(
  (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name),
);

const pending = readdirSync(dir)
  .filter((entry) => existsSync(path.join(dir, entry, "migration.sql")))
  .sort()
  .filter((name) => !applied.has(name));

if (pending.length === 0) {
  console.log("database is up to date");
} else {
  for (const name of pending) {
    const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    // All-or-nothing: a half-applied migration is far worse than a failed one.
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`FAILED ${name}: ${error.message}`);
      await client.end();
      process.exit(1);
    }
  }
}

const { rows } = await client.query(
  "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
);
console.log(`public tables: ${rows[0].n}`);
await client.end();
