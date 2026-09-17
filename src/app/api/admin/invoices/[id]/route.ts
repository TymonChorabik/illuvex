import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { cancelInvoice, getInvoice, updateInvoiceLines } from "@/lib/invoices";
import { parseInvoiceLines } from "@/lib/invoice-input";

export async function GET(_r: Request, ctx: RouteContext<"/api/admin/invoices/[id]">) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const invoice = await getInvoice(await getTenantId(), id);
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden." }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/invoices/[id]">) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON-body." }, { status: 400 });
  }
  const lines = parseInvoiceLines((body as Record<string, unknown>).lines);
  if (!lines.ok) return NextResponse.json({ error: lines.error }, { status: 400 });

  const { id } = await ctx.params;
  const result = await updateInvoiceLines(await getTenantId(), id, lines.lines);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("niet gevonden") ? 404 : 409 },
    );
  }
  return NextResponse.json({ invoice: result.invoice });
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/admin/invoices/[id]">) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const result = await cancelInvoice(await getTenantId(), id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("niet gevonden") ? 404 : 409 },
    );
  }
  return NextResponse.json({ invoice: result.invoice });
}
