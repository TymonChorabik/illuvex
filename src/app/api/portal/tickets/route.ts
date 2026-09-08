import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { createTicket, listTickets, isTicketPriority } from "@/lib/tickets";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function GET() {
  const auth = await requireCustomer();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tickets = await listTickets(await getTenantId(), {
    clientId: auth.user.clientId,
  });
  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const auth = await requireCustomer();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limit = rateLimit(clientKey(request, "ticket-create"), 10, 10 * 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "Too many tickets opened. Give it a few minutes.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const message = typeof b.body === "string" ? b.body.trim() : "";

  if (subject.length < 3 || subject.length > 200) {
    return NextResponse.json({ error: "Give the ticket a short subject." }, { status: 400 });
  }
  if (message.length < 5 || message.length > 10_000) {
    return NextResponse.json({ error: "Describe the problem in a bit more detail." }, { status: 400 });
  }

  const ticket = await createTicket(await getTenantId(), auth.user.id, {
    // The client id comes from the session, never from the request body.
    clientId: auth.user.clientId,
    subject,
    body: message,
    priority: isTicketPriority(b.priority) ? b.priority : "NORMAL",
    orderId: typeof b.orderId === "string" ? b.orderId : null,
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
