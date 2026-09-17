import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { createQuote, listQuotes, expireStaleQuotes } from "@/lib/quotes";
import { parseQuoteBody } from "@/lib/quote-input";
import type { QuoteStatus } from "@/generated/prisma/client";

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenantId = await getTenantId();
  // Cheap and idempotent: keeps the list honest without a cron job.
  await expireStaleQuotes(tenantId);

  const raw = new URL(request.url).searchParams.get("status");
  const status = STATUSES.includes(raw as QuoteStatus)
    ? (raw as QuoteStatus)
    : undefined;

  return NextResponse.json({ quotes: await listQuotes(tenantId, status) });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const parsed = parseQuoteBody(body, { requireClient: true });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const quote = await createQuote(await getTenantId(), {
    client: parsed.client!,
    title: parsed.title!,
    notes: parsed.notes,
    validUntil: parsed.validUntil,
    lines: parsed.lines!,
  });

  return NextResponse.json({ quote }, { status: 201 });
}
