import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { addMessage, getTicket } from "@/lib/tickets";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/portal/tickets/[id]">,
) {
  const auth = await requireCustomer();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const ticket = await getTicket(await getTenantId(), id, {
    clientId: auth.user.clientId,
    // Customers never see staff-only notes.
    includeInternal: false,
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/portal/tickets/[id]">,
) {
  const auth = await requireCustomer();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = (body as { body?: unknown }).body;
  if (typeof message !== "string" || message.trim().length < 2 || message.length > 10_000) {
    return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await addMessage(await getTenantId(), {
    ticketId: id,
    authorId: auth.user.id,
    body: message,
    internal: false,
    from: "customer",
    clientId: auth.user.clientId,
  });

  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ message: result.message }, { status: 201 });
}
