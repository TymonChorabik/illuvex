import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import {
  addMessage, getTicket, setTicketStatus, setTicketPriority,
  isTicketStatus, isTicketPriority,
} from "@/lib/tickets";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/tickets/[id]">,
) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  // Staff see everything, internal notes included.
  const ticket = await getTicket(await getTenantId(), id, { includeInternal: true });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  return NextResponse.json({ ticket });
}

/** Staff reply, optionally as an internal note. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/tickets/[id]">,
) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const message = b.body;
  if (typeof message !== "string" || message.trim().length < 2 || message.length > 10_000) {
    return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await addMessage(await getTenantId(), {
    ticketId: id,
    authorId: auth.user.id,
    body: message,
    internal: b.internal === true,
    from: "staff",
  });

  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ message: result.message }, { status: 201 });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/tickets/[id]">,
) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const tenantId = await getTenantId();
  const { id } = await ctx.params;

  if (b.priority !== undefined) {
    if (!isTicketPriority(b.priority)) {
      return NextResponse.json({ error: "Unknown priority." }, { status: 400 });
    }
    const ok = await setTicketPriority(tenantId, id, b.priority);
    if (!ok) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  if (b.status !== undefined) {
    if (!isTicketStatus(b.status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const ticket = await setTicketStatus(tenantId, id, b.status);
    if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    return NextResponse.json({ ticket });
  }

  const ticket = await getTicket(tenantId, id, { includeInternal: true });
  return NextResponse.json({ ticket });
}
