import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import {
  createInvoice, invoiceFromQuote, listInvoices, markOverdue, invoiceSummary,
} from "@/lib/invoices";
import { parseInvoiceLines } from "@/lib/invoice-input";
import type { InvoiceStatus } from "@/generated/prisma/client";

const STATUSES = ["DRAFT","SENT","PAID","OVERDUE","CANCELLED"] as const;

export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = await getTenantId();
  // Cheap and idempotent — keeps the list honest without a cron job.
  await markOverdue(tenantId);

  const params = new URL(request.url).searchParams;
  const raw = params.get("status");
  const yearRaw = params.get("year");
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;

  const [invoices, summary] = await Promise.all([
    listInvoices(tenantId, {
      status: STATUSES.includes(raw as InvoiceStatus) ? (raw as InvoiceStatus) : undefined,
    }),
    invoiceSummary(tenantId, year),
  ]);

  return NextResponse.json({ invoices, summary });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON-body." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const tenantId = await getTenantId();

  // Building from an accepted quote is the common path.
  if (typeof b.quoteId === "string" && !b.lines) {
    const result = await invoiceFromQuote(tenantId, b.quoteId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ invoice: result.invoice }, { status: 201 });
  }

  if (typeof b.clientId !== "string" || !b.clientId) {
    return NextResponse.json({ error: "Een klant is verplicht." }, { status: 400 });
  }
  const lines = parseInvoiceLines(b.lines);
  if (!lines.ok) return NextResponse.json({ error: lines.error }, { status: 400 });

  const invoice = await createInvoice(tenantId, {
    clientId: b.clientId,
    lines: lines.lines,
  });
  return NextResponse.json({ invoice }, { status: 201 });
}
