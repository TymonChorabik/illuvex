import { Prisma } from "@/generated/prisma/client";
import type { TicketStatus, TicketPriority } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type { TicketStatus, TicketPriority };

export const TICKET_STATUSES: TicketStatus[] = [
  "OPEN",
  "WAITING_ON_US",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];

export const TICKET_PRIORITIES: TicketPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && TICKET_STATUSES.includes(value as TicketStatus);
}

export function isTicketPriority(value: unknown): value is TicketPriority {
  return (
    typeof value === "string" && TICKET_PRIORITIES.includes(value as TicketPriority)
  );
}

/**
 * Same advisory-lock approach as quote references: allocation is serialised
 * per tenant per year so two simultaneous tickets cannot claim one number.
 */
async function nextReference(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number,
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ticket:${tenantId}:${year}`}))`;

  const prefix = `TCK-${year}-`;
  const latest = await tx.ticket.findFirst({
    where: { tenantId, reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const last = latest ? Number.parseInt(latest.reference.slice(prefix.length), 10) : 0;
  return `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
}

const THREAD_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  order: { select: { reference: true, packageName: true } },
} as const;

export type CreateTicketInput = {
  clientId: string;
  subject: string;
  body: string;
  priority?: TicketPriority;
  orderId?: string | null;
};

export async function createTicket(tenantId: string, authorId: string, input: CreateTicketInput) {
  const year = new Date().getFullYear();

  return prisma.$transaction(async (tx) => {
    // Confirm the client belongs to this tenant before anything is written.
    const client = await tx.client.findFirst({
      where: { id: input.clientId, tenantId },
      select: { id: true },
    });
    if (!client) throw new Error("Client not found for this tenant.");

    // An order may only be attached if it belongs to the same client.
    let orderId: string | null = null;
    if (input.orderId) {
      const order = await tx.order.findFirst({
        where: { id: input.orderId, tenantId, clientId: input.clientId },
        select: { id: true },
      });
      orderId = order?.id ?? null;
    }

    return tx.ticket.create({
      data: {
        tenantId,
        clientId: input.clientId,
        orderId,
        reference: await nextReference(tx, tenantId, year),
        subject: input.subject.trim(),
        priority: input.priority ?? "NORMAL",
        status: "WAITING_ON_US",
        messages: {
          create: { authorId, body: input.body.trim(), internal: false },
        },
      },
      include: THREAD_INCLUDE,
    });
  });
}

/**
 * Lists tickets. `clientId` scopes it to one customer — always pass it for a
 * customer-facing call, never for staff.
 */
export async function listTickets(
  tenantId: string,
  opts: { clientId?: string; status?: TicketStatus } = {},
) {
  return prisma.ticket.findMany({
    where: {
      tenantId,
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      ...THREAD_INCLUDE,
      _count: { select: { messages: true } },
    },
  });
}

/**
 * Fetches one ticket with its thread.
 *
 * `includeInternal` decides whether staff-only notes are returned. It is a
 * required argument rather than an option with a default, so a caller cannot
 * leak internal notes to a customer by forgetting a flag.
 */
export async function getTicket(
  tenantId: string,
  id: string,
  opts: { clientId?: string; includeInternal: boolean },
) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      id,
      tenantId,
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
    },
    include: {
      ...THREAD_INCLUDE,
      messages: {
        where: opts.includeInternal ? {} : { internal: false },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });
  return ticket;
}

export type AddMessageInput = {
  ticketId: string;
  authorId: string;
  body: string;
  internal: boolean;
  /** Who is replying, which decides the resulting status. */
  from: "staff" | "customer";
  /** Present for a customer, so the ticket cannot be reached across accounts. */
  clientId?: string;
};

export async function addMessage(tenantId: string, input: AddMessageInput) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: input.ticketId,
      tenantId,
      ...(input.clientId ? { clientId: input.clientId } : {}),
    },
    select: { id: true, status: true },
  });
  if (!ticket) return { ok: false as const, error: "Ticket not found." };
  if (ticket.status === "CLOSED") {
    return {
      ok: false as const,
      error: "This ticket is closed. Open a new one and reference it.",
    };
  }

  return prisma.$transaction(async (tx) => {
    const message = await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: input.authorId,
        body: input.body.trim(),
        internal: input.internal,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    // An internal note is staff talking to staff; it must not tell the
    // customer we are waiting on them.
    if (!input.internal) {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: input.from === "staff" ? "WAITING_ON_CUSTOMER" : "WAITING_ON_US",
        },
      });
    } else {
      // Still bump updatedAt so the staff list re-sorts.
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
      });
    }

    return { ok: true as const, message };
  });
}

export async function setTicketStatus(
  tenantId: string,
  id: string,
  status: TicketStatus,
) {
  const { count } = await prisma.ticket.updateMany({
    where: { id, tenantId },
    data: {
      status,
      closedAt: status === "CLOSED" ? new Date() : null,
    },
  });
  if (count === 0) return null;
  return prisma.ticket.findFirst({ where: { id, tenantId }, include: THREAD_INCLUDE });
}

export async function setTicketPriority(
  tenantId: string,
  id: string,
  priority: TicketPriority,
) {
  const { count } = await prisma.ticket.updateMany({
    where: { id, tenantId },
    data: { priority },
  });
  return count > 0;
}
