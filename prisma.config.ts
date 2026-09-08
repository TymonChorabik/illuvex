import { defineConfig, env } from "@prisma/config";

// Prisma 7 no longer reads .env implicitly. Node 22 can load it natively, so
// this needs no dotenv dependency.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env locally (CI, or the URL is already exported) — fall through.
}

/**
 * Prisma 7 moved the connection URL out of schema.prisma. The CLI (migrate,
 * studio) reads it from here; the runtime client gets it via the driver
 * adapter in src/lib/prisma.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
