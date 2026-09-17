import crypto from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { QuoteStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { documentTotals, type LineInput } from "@/lib/money";

export type { QuoteStatus };

const TOKEN_VALID_DAYS = 60;

export type QuoteLineInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatRateBps: number;
};

export type ClientInput = {
  name: string;
  contactName?: string;
  email: string;
  phone?: string;
  vatNumber?: string;
  addressLine1?: string;
  postcode?: string;
  city?: string;
  country?: string;
};

/**
 * Allocates the next quote reference, e.g. OFF-2026-0007.
 *
 * Sequential numbering has a race: two concurrent creates can read the same
 * highest number and both claim it. A Postgres advisory lock, held for the
 * duration of the transaction, serialises allocation per tenant per year.
 * The lock is released automatically on commit or rollback, so a crashed
 * request cannot wedge the counter.
 */
async function nextReference(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number,
): Promise<string> {
  const lockKey = `quote:${tenantId}:${year}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const prefix = `OFF-${year}-`;
  const latest = await tx.quote.findFirst({
    where: { tenantId, reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const lastNumber = latest
    ? Number.parseInt(latest.reference.slice(prefix.length), 10)
    : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function totalsFor(lines: QuoteLineInput[]) {
  return documentTotals(
    lines.map<LineInput>((l) => ({
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      vatRateBps: l.vatRateBps,
    })),
  );
}

/**
 * Allocates the next client number, e.g. KLT-0007.
 *
 * Unlike a quote or invoice reference this never resets by year -- a client
 * keeps the same number for as long as they exist. Same advisory-lock
 * pattern as nextReference, scoped per tenant only.
 */
async function nextClientNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const lockKey = `client:${tenantId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const prefix = "KLT-";
  const latest = await tx.client.findFirst({
    where: { tenantId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const lastNumber = latest?.number
    ? Number.parseInt(latest.number.slice(prefix.length), 10)
    : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** Finds a client by email within the tenant, or creates one. */
async function upsertClient(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: ClientInput,
) {
  const email = input.email.trim().toLowerCase();
  const existing = await tx.client.findFirst({
    where: { tenantId, email },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.client.create({
    data: {
      tenantId,
      number: await nextClientNumber(tx, tenantId),
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      email,
      phone: input.phone?.trim() || null,
      vatNumber: input.vatNumber?.trim() || null,
      addressLine1: input.addressLine1?.trim() || null,
      postcode: input.postcode?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || null,
    },
    select: { id: true },
  });
  return created.id;
}

export type CreateQuoteInput = {
  client: ClientInput;
  title: string;
  notes?: string;
  validUntil?: Date | null;
  lines: QuoteLineInput[];
};

export async function createQuote(tenantId: string, input: CreateQuoteInput) {
  const totals = totalsFor(input.lines);
  const year = new Date().getFullYear();

  return prisma.$transaction(async (tx) => {
    const clientId = await upsertClient(tx, tenantId, input.client);
    const reference = await nextReference(tx, tenantId, year);

    return tx.quote.create({
      data: {
        tenantId,
        clientId,
        reference,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        validUntil: input.validUntil ?? null,
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
      include: { lines: { orderBy: { sortOrder: "asc" } }, client: true },
    });
  });
}

export type UpdateQuoteInput = {
  title?: string;
  notes?: string | null;
  validUntil?: Date | null;
  lines?: QuoteLineInput[];
};

/** Only drafts are editable — a sent quote is a document the client has seen. */
export async function updateQuote(
  tenantId: string,
  id: string,
  input: UpdateQuoteInput,
) {
  const quote = await prisma.quote.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!quote) return { ok: false as const, error: "Quote not found." };
  if (quote.status !== "DRAFT") {
    return {
      ok: false as const,
      error: "Only draft quotes can be edited. Duplicate it instead.",
    };
  }

  return prisma.$transaction(async (tx) => {
    if (input.lines) {
      const totals = totalsFor(input.lines);
      await tx.quoteLine.deleteMany({ where: { quoteId: id } });
      await tx.quoteLine.createMany({
        data: input.lines.map((line, index) => ({
          quoteId: id,
          description: line.description.trim(),
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          vatRateBps: line.vatRateBps,
          sortOrder: index,
        })),
      });
      await tx.quote.update({
        where: { id },
        data: {
          subtotalCents: totals.subtotalCents,
          vatCents: totals.vatCents,
          totalCents: totals.totalCents,
        },
      });
    }

    const updated = await tx.quote.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.notes !== undefined
          ? { notes: input.notes?.trim() || null }
          : {}),
        ...(input.validUntil !== undefined
          ? { validUntil: input.validUntil }
          : {}),
      },
      include: { lines: { orderBy: { sortOrder: "asc" } }, client: true },
    });
    return { ok: true as const, quote: updated };
  });
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Moves a draft to SENT and mints the client's access token.
 * Returns the raw token exactly once — only its hash is stored.
 */
export async function sendQuote(tenantId: string, id: string) {
  const quote = await prisma.quote.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!quote) return { ok: false as const, error: "Quote not found." };
  if (quote.status !== "DRAFT") {
    return { ok: false as const, error: "This quote has already been sent." };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + TOKEN_VALID_DAYS * 24 * 60 * 60 * 1000,
  );

  const updated = await prisma.quote.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      accessTokenHash: hashToken(token),
      accessTokenExpiresAt: expiresAt,
    },
    include: { lines: { orderBy: { sortOrder: "asc" } }, client: true },
  });

  return { ok: true as const, quote: updated, token };
}

/** Public lookup by emailed token. Never takes an id from the URL. */
export async function getQuoteByToken(token: string) {
  if (!token || token.length > 200) return null;

  const quote = await prisma.quote.findUnique({
    where: { accessTokenHash: hashToken(token) },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      client: true,
      tenant: { select: { name: true } },
    },
  });

  if (!quote) return null;
  if (quote.accessTokenExpiresAt && quote.accessTokenExpiresAt <= new Date()) {
    return null;
  }
  return quote;
}

export type Decision = "accept" | "reject";

/**
 * Records the client's decision.
 *
 * Idempotent by design: re-submitting the same decision succeeds quietly (the
 * client double-clicked), while trying to reverse a decision is refused. A
 * quote past its validUntil is marked EXPIRED rather than silently accepted.
 */
export async function decideQuote(token: string, decision: Decision) {
  const quote = await getQuoteByToken(token);
  if (!quote) {
    return { ok: false as const, error: "This link is not valid any more." };
  }

  const target: QuoteStatus = decision === "accept" ? "ACCEPTED" : "REJECTED";

  if (quote.status === target) {
    return { ok: true as const, quote, alreadyDecided: true };
  }
  if (quote.status === "ACCEPTED" || quote.status === "REJECTED") {
    return {
      ok: false as const,
      error: "A decision has already been recorded for this quote.",
    };
  }
  if (quote.status === "EXPIRED") {
    return { ok: false as const, error: "This quote has expired." };
  }
  if (quote.status !== "SENT") {
    return { ok: false as const, error: "This quote is not open for a decision." };
  }

  if (quote.validUntil && quote.validUntil < new Date()) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "EXPIRED" },
    });
    return {
      ok: false as const,
      error: "This quote expired before a decision was recorded.",
    };
  }

  // Guarded update: the WHERE still requires SENT, so two simultaneous clicks
  // cannot both win.
  const { count } = await prisma.quote.updateMany({
    where: { id: quote.id, status: "SENT" },
    data: { status: target, decidedAt: new Date() },
  });
  if (count === 0) {
    return {
      ok: false as const,
      error: "A decision has already been recorded for this quote.",
    };
  }

  const fresh = await getQuoteByToken(token);
  return { ok: true as const, quote: fresh!, alreadyDecided: false };
}

export async function listQuotes(tenantId: string, status?: QuoteStatus) {
  return prisma.quote.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true, email: true } },
      _count: { select: { lines: true } },
      // So the list can link straight to an existing invoice instead of
      // only remembering one just created in this browser session.
      invoices: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true },
        take: 1,
      },
    },
  });
}

export async function getQuote(tenantId: string, id: string) {
  return prisma.quote.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, client: true },
  });
}

/**
 * Quotes for the public Transactions lookup, by client email.
 *
 * Read-only summaries only — no accessTokenHash, no line items. The
 * emailed link is the only way to actually open or act on a quote; this
 * must not become a second way to reach one by guessing an address.
 * DRAFTs are excluded too: a client has never seen those.
 */
export async function listQuotesByClientEmail(tenantId: string, email: string) {
  return prisma.quote.findMany({
    where: {
      tenantId,
      status: { not: "DRAFT" },
      client: { email: email.trim().toLowerCase() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      currency: true,
      totalCents: true,
      createdAt: true,
    },
  });
}

/** Marks past-validity sent quotes as expired. Safe to run repeatedly. */
export async function expireStaleQuotes(tenantId: string) {
  const { count } = await prisma.quote.updateMany({
    where: { tenantId, status: "SENT", validUntil: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return count;
}
