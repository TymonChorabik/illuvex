import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { listTickets, isTicketStatus } from "@/lib/tickets";

export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const raw = new URL(request.url).searchParams.get("status");
  const tickets = await listTickets(await getTenantId(), {
    status: isTicketStatus(raw) ? raw : undefined,
  });
  return NextResponse.json({ tickets });
}
