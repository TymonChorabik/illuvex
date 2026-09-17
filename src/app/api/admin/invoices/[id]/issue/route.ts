import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { issueInvoice } from "@/lib/invoices";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/invoices/[id]/issue">) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let dueDays: number | undefined;
  try {
    const body = await request.json();
    const raw = (body as { dueDays?: unknown }).dueDays;
    if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 365) {
      dueDays = raw;
    }
  } catch {
    // No body is fine — fall back to the default payment terms.
  }

  const { id } = await ctx.params;
  const result = await issueInvoice(await getTenantId(), id, { dueDays });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("niet gevonden") ? 404 : 409 },
    );
  }
  return NextResponse.json({ invoice: result.invoice });
}
