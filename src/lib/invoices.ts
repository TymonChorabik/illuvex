import { Prisma } from "@/generated/prisma/client";
import type { InvoiceStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { documentTotals, type LineInput } from "@/lib/money";

export type { InvoiceStatus };

/** Default payment terms when none is given. */
const DEFAULT_PAYMENT_DAYS = 14;

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatRateBps: number;
};

/**
 * The client's details as they were when the invoice was issued.
 *
 * An issued invoice is a legal record: if the client moves office next year,
 * last year's invoice must still show the old address. So we freeze a copy
 * rather than joining to the live client row.
 */
export type BillingSnapshot = {
  name: string;
  contactName?: string | null;
  email: string;
  vatNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string | null;
};

const INCLUDE = {
  client: true,
  lines: { orderBy: { sortOrder: "asc" } },
  quote: { select: { reference: true, title: true } },
} as const;

function totalsFor(lines: InvoiceLineInput[]) {
  return documentTotals(
    lines.map<LineInput>((l) => ({
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      vatRateBps: l.vatRateBps,
    })),
  );
}

/**
 * Allocates the next invoice number.
 *
 * Gapless numbering is a legal requirement in most of the EU, so this must be
 * both unique AND without holes. The advisory lock serialises allocation per
 * tenant per year; because it runs inside the same transaction that flips the
 * invoice to SENT, a failure rolls the number back rather than consuming it.
 */
async function nextNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number,
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${tenantId}:${year}`}))`;

  const prefix = `INV-${year}-`;
  const latest = await tx.invoice.findFirst({
    where: { tenantId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const last = latest?.number
    ? Number.parseInt(latest.number.slice(prefix.length), 10)
    : 0;
  return `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
}

export type CreateInvoiceInput = {
  clientId: string;
  lines: InvoiceLineInput[];
  quoteId?: string | null;
  orderId?: string | null;
  dueDays?: number;
};

/** Creates a DRAFT. Drafts have no number and are freely editable. */
export async function createInvoice(tenantId: string, input: CreateInvoiceInput) {
  const totals = totalsFor(input.lines);

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: input.clientId, tenantId },
      select: { id: true },
    });
    if (!client) throw new Error("Client not found for this tenant.");

    return tx.invoice.create({
      data: {
        tenantId,
        clientId: input.clientId,
        quoteId: input.quoteId ?? null,
        orderId: input.orderId ?? null,
        status: "DRAFT",
        subtotalCents: totals.subtotalCents,
        vatCents: totals.vatCents,
        totalCents: totals.totalCents,
        lines: {
          create: input.lines.map((line, index) => ({
            description: line.description.trim(),
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            vatRateBps: line.vatRateBps,
            sortOrder: index,
          })),
        },
      },
      include: INCLUDE,
    });
  });
}

/**
 * Builds a draft invoice from an accepted quote, copying its lines.
 * Refuses if the quote was not accepted — you do not invoice for work the
 * client declined.
 */
export async function invoiceFromQuote(tenantId: string, quoteId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, tenantId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) return { ok: false as const, error: "Quote not found." };
  if (quote.status !== "ACCEPTED") {
    return {
      ok: false as const,
      error: "Only an accepted quote can be turned into an invoice.",
    };
  }

  const existing = await prisma.invoice.findFirst({
    where: { tenantId, quoteId, status: { not: "CANCELLED" } },
    select: { id: true, number: true },
  });
  if (existing) {
    return {
      ok: false as const,
      error: `This quote already has an invoice (${existing.number ?? "draft"}).`,
    };
  }

  const invoice = await createInvoice(tenantId, {
    clientId: quote.clientId,
    quoteId: quote.id,
    lines: quote.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      vatRateBps: line.vatRateBps,
    })),
  });
  return { ok: true as const, invoice };
}

/** Drafts only. An issued invoice is immutable. */
export async function updateInvoiceLines(
  tenantId: string,
  id: string,
  lines: InvoiceLineInput[],
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!invoice) return { ok: false as const, error: "Invoice not found." };
  if (invoice.status !== "DRAFT") {
    return {
      ok: false as const,
      error:
        "An issued invoice cannot be changed. Cancel it and issue a corrected one.",
    };
  }

  const totals = totalsFor(lines);
  return prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoiceLine.createMany({
      data: lines.map((line, index) => ({
        invoiceId: id,
        description: line.description.trim(),
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        vatRateBps: line.vatRateBps,
        sortOrder: index,
      })),
    });
    const updated = await tx.invoice.update({
      where: { id },
      data: {
        subtotalCents: totals.subtotalCents,
        vatCents: totals.vatCents,
        totalCents: totals.totalCents,
      },
      include: INCLUDE,
    });
    return { ok: true as const, invoice: updated };
  });
}

/**
 * Issues a draft: allocates the number, freezes the billing details, and
 * makes the invoice immutable. This is the point of no return.
 */
export async function issueInvoice(
  tenantId: string,
  id: string,
  opts: { dueDays?: number } = {},
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id, tenantId },
      include: { client: true, lines: true },
    });
    if (!invoice) return { ok: false as const, error: "Invoice not found." };
    if (invoice.status !== "DRAFT") {
      return { ok: false as const, error: "This invoice has already been issued." };
    }
    if (invoice.lines.length === 0) {
      return { ok: false as const, error: "An invoice needs at least one line." };
    }

    const now = new Date();
    const dueDays = opts.dueDays ?? DEFAULT_PAYMENT_DAYS;

    const snapshot: BillingSnapshot = {
      name: invoice.client.name,
      contactName: invoice.client.contactName,
      email: invoice.client.email,
      vatNumber: invoice.client.vatNumber,
      addressLine1: invoice.client.addressLine1,
      addressLine2: invoice.client.addressLine2,
      postcode: invoice.client.postcode,
      city: invoice.client.city,
      country: invoice.client.country,
    };

    const updated = await tx.invoice.update({
      where: { id },
      data: {
        number: await nextNumber(tx, tenantId, now.getFullYear()),
        status: "SENT",
        issuedAt: now,
        dueAt: new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000),
        billingSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      include: INCLUDE,
    });

    return { ok: true as const, invoice: updated };
  });
}

/**
 * Records a payment. Amounts are cumulative, so a partial payment can be
 * topped up later; the invoice flips to PAID only once fully covered.
 */
export async function recordPayment(
  tenantId: string,
  id: string,
  amountCents: number,
) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false as const, error: "Payment amount must be a positive whole number of cents." };
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, paidCents: true, totalCents: true },
    });
    if (!invoice) return { ok: false as const, error: "Invoice not found." };
    if (invoice.status === "DRAFT") {
      return { ok: false as const, error: "Issue the invoice before recording a payment." };
    }
    if (invoice.status === "CANCELLED") {
      return { ok: false as const, error: "This invoice was cancelled." };
    }

    const paid = invoice.paidCents + amountCents;
    if (paid > invoice.totalCents) {
      return {
        ok: false as const,
        error: "That is more than the outstanding amount.",
      };
    }

    const fullyPaid = paid >= invoice.totalCents;
    const updated = await tx.invoice.update({
      where: { id },
      data: {
        paidCents: paid,
        status: fullyPaid ? "PAID" : "SENT",
        paidAt: fullyPaid ? new Date() : null,
      },
      include: INCLUDE,
    });
    return { ok: true as const, invoice: updated };
  });
}

/**
 * Cancels an invoice. The number is deliberately NOT released — a gap would
 * break the sequence, and the cancelled record is the audit trail.
 */
export async function cancelInvoice(tenantId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!invoice) return { ok: false as const, error: "Invoice not found." };
  if (invoice.status === "PAID") {
    return {
      ok: false as const,
      error: "A paid invoice cannot be cancelled. Issue a credit note instead.",
    };
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: INCLUDE,
  });
  return { ok: true as const, invoice: updated };
}

/** Marks past-due sent invoices as overdue. Idempotent. */
export async function markOverdue(tenantId: string) {
  const { count } = await prisma.invoice.updateMany({
    where: { tenantId, status: "SENT", dueAt: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
  return count;
}

export async function listInvoices(
  tenantId: string,
  opts: { clientId?: string; status?: InvoiceStatus } = {},
) {
  return prisma.invoice.findMany({
    where: {
      tenantId,
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      // A customer sees an invoice only once it has been issued. Testing the
      // number rather than the status matters: a draft that was cancelled is
      // still CANCELLED-with-no-number, and filtering on status alone leaked
      // it into the portal.
      ...(opts.clientId ? { number: { not: null } } : {}),
    },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    include: {
      client: { select: { name: true, email: true } },
      _count: { select: { lines: true } },
    },
  });
}

/**
 * Invoices for the public Transactions lookup, by client email.
 *
 * Same number-not-null rule as the portal: a draft has no number and a
 * client has never seen it, so it must not appear here either.
 */
export async function listInvoicesByClientEmail(tenantId: string, email: string) {
  return prisma.invoice.findMany({
    where: {
      tenantId,
      number: { not: null },
      client: { email: email.trim().toLowerCase() },
    },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      number: true,
      status: true,
      currency: true,
      totalCents: true,
      paidCents: true,
      issuedAt: true,
      dueAt: true,
    },
  });
}

export async function getInvoice(
  tenantId: string,
  id: string,
  opts: { clientId?: string } = {},
) {
  return prisma.invoice.findFirst({
    where: {
      id,
      tenantId,
      ...(opts.clientId ? { clientId: opts.clientId, number: { not: null } } : {}),
    },
    include: INCLUDE,
  });
}

/** Totals for the bookkeeping overview, excluding drafts and cancellations. */
export async function invoiceSummary(tenantId: string, year?: number) {
  const where: Prisma.InvoiceWhereInput = {
    tenantId,
    status: { notIn: ["DRAFT", "CANCELLED"] },
    ...(year
      ? {
          issuedAt: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        }
      : {}),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      status: true,
      subtotalCents: true,
      vatCents: true,
      totalCents: true,
      paidCents: true,
    },
  });

  const summary = {
    count: invoices.length,
    netCents: 0,
    vatCents: 0,
    grossCents: 0,
    paidCents: 0,
    outstandingCents: 0,
    overdueCents: 0,
  };

  for (const invoice of invoices) {
    summary.netCents += invoice.subtotalCents;
    summary.vatCents += invoice.vatCents;
    summary.grossCents += invoice.totalCents;
    summary.paidCents += invoice.paidCents;
    const outstanding = invoice.totalCents - invoice.paidCents;
    summary.outstandingCents += outstanding;
    if (invoice.status === "OVERDUE") summary.overdueCents += outstanding;
  }

  return summary;
}
