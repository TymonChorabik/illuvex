import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { recordPayment } from "@/lib/invoices";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/invoices/[id]/payment">) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const amount = (body as { amountCents?: unknown }).amountCents;
  if (typeof amount !== "number") {
    return NextResponse.json({ error: "Bedrag is verplicht." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await recordPayment(await getTenantId(), id, amount);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("niet gevonden") ? 404 : 409 },
    );
  }
  return NextResponse.json({ invoice: result.invoice });
}
