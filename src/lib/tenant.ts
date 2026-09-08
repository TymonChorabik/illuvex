import { prisma } from "@/lib/prisma";

/**
 * Resolves the active tenant.
 *
 * Today there is exactly one, named by TENANT_SLUG. When the system is resold,
 * this is the single place that changes — resolve from the request's subdomain
 * or path instead — and every caller keeps working, because they already scope
 * their queries by the id this returns.
 */
const DEFAULT_SLUG = process.env.TENANT_SLUG ?? "illuvex";

let cached: { id: string; slug: string } | null = null;

export async function getTenant(): Promise<{ id: string; slug: string }> {
  if (cached) return cached;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_SLUG },
    select: { id: true, slug: true },
  });

  if (!tenant) {
    throw new Error(
      `No tenant with slug "${DEFAULT_SLUG}". Run: npm run db:migrate && npm run db:seed`,
    );
  }

  cached = tenant;
  return tenant;
}

export async function getTenantId(): Promise<string> {
  return (await getTenant()).id;
}
