import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { toCsv, centsToDecimal, csvResponse } from "@/lib/csv";
import { NextResponse } from "next/server";

/**
 * Bookkeeping export.
 *
 * `format=lines` gives one row per invoice line with its VAT rate, which is
 * what an accountant needs to file a BTW return. `format=invoices` (default)
 * gives one row per invoice for reconciliation.
 *
 * Drafts are excluded — an unissued invoice is not a financial document.
 */
export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "lines" ? "lines" : "invoices";
  const yearRaw = params.get("year");
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: await getTenantId(),
      status: { notIn: ["DRAFT", "CANCELLED"] },
      ...(year
        ? {
            issuedAt: {
              gte: new Date(Date.UTC(year, 0, 1)),
              lt: new Date(Date.UTC(year + 1, 0, 1)),
            },
          }
        : {}),
    },
    orderBy: { number: "asc" },
    include: {
      client: { select: { name: true, vatNumber: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  const date = (value: Date | null) =>
    value ? value.toISOString().slice(0, 10) : "";

  if (format === "lines") {
    const rows = invoices.flatMap((invoice) =>
      invoice.lines.map((line) => {
        const net = line.quantity * line.unitPriceCents;
        // Same per-line rounding the invoice itself used.
        const vat = Math.round((net * line.vatRateBps) / 10_000);
        return [
          invoice.number ?? "",
          date(invoice.issuedAt),
          invoice.client.name,
          invoice.client.vatNumber ?? "",
          line.description,
          line.quantity,
          centsToDecimal(line.unitPriceCents),
          `${line.vatRateBps / 100}%`,
          centsToDecimal(net),
          centsToDecimal(vat),
          centsToDecimal(net + vat),
          invoice.currency,
        ];
      }),
    );

    return csvResponse(
      `illuvex-invoice-lines${year ? `-${year}` : ""}.csv`,
      toCsv(
        ["invoice_number","issue_date","client","client_vat_number","description",
         "quantity","unit_price","vat_rate","net","vat","gross","currency"],
        rows,
      ),
    );
  }

  const rows = invoices.map((invoice) => [
    invoice.number ?? "",
    date(invoice.issuedAt),
    date(invoice.dueAt),
    invoice.client.name,
    invoice.client.vatNumber ?? "",
    invoice.status,
    centsToDecimal(invoice.subtotalCents),
    centsToDecimal(invoice.vatCents),
    centsToDecimal(invoice.totalCents),
    centsToDecimal(invoice.paidCents),
    centsToDecimal(invoice.totalCents - invoice.paidCents),
    date(invoice.paidAt),
    invoice.currency,
  ]);

  return csvResponse(
    `illuvex-invoices${year ? `-${year}` : ""}.csv`,
    toCsv(
      ["invoice_number","issue_date","due_date","client","client_vat_number","status",
       "net","vat","gross","paid","outstanding","paid_date","currency"],
      rows,
    ),
  );
}
