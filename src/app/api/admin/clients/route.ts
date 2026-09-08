import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/** Client list for the staff side, with whether each has portal access yet. */
export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clients = await prisma.client.findMany({
    where: { tenantId: await getTenantId() },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, contactName: true, city: true,
      createdAt: true,
      users: { select: { id: true, emailVerifiedAt: true, lastLoginAt: true } },
      _count: { select: { tickets: true, quotes: true } },
    },
  });
  return NextResponse.json({ clients });
}
