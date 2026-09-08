import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 connects through a driver adapter rather than a URL in the schema.
 * We use the node-postgres adapter, which works against both a managed
 * Postgres and the PGlite dev server in tools/local-db.mjs.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your database.",
    );
  }

  /**
   * Connection pool size.
   *
   * The PGlite dev database (tools/local-db.mjs) serves exactly one
   * connection: a second concurrent request gets `P1017 Server has closed the
   * connection`. Capping the pool at 1 makes requests queue instead of fail.
   * Against a real Postgres, raise DATABASE_POOL_MAX (10 is a sane start).
   */
  const isLocalPglite = connectionString.includes(":5433");
  const max = Number(
    process.env.DATABASE_POOL_MAX ?? (isLocalPglite ? 1 : 10),
  );

  const adapter = new PrismaPg({ connectionString, max });
  return new PrismaClient({
    adapter,
    // Queries are noisy; warnings and errors are what you actually want to see.
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next's dev server hot-reloads modules, which would otherwise open a new pool
// on every edit until Postgres refuses connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
