/**
 * Local development database.
 *
 * Runs PGlite — real Postgres compiled to WebAssembly — and exposes it on a
 * TCP port so Prisma can connect to it exactly as it would to a real server.
 * No Docker, no install, no cloud signup, works offline.
 *
 *   node tools/local-db.mjs
 *
 * Data lives in .pgdata/ (gitignored). Delete that folder to reset.
 *
 * THIS IS FOR DEVELOPMENT ONLY. In production point DATABASE_URL at a managed
 * Postgres (Neon, Supabase, RDS) — PGlite is single-connection and has no
 * backups, replication, or concurrency story.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const DATA_DIR = process.env.LOCAL_DB_DIR ?? "./.pgdata";

const db = await PGlite.create({ dataDir: DATA_DIR });
const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });

await server.start();
console.log(`local Postgres listening on 127.0.0.1:${PORT} (data: ${DATA_DIR})`);
console.log("press Ctrl+C to stop");

const shutdown = async () => {
  console.log("\nstopping...");
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
