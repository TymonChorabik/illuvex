import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { listInvoices } from "@/lib/invoices";

/** A client sees their own issued invoices — never drafts. */
export async function GET() {
  const auth = await requireCustomer();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const invoices = await listInvoices(await getTenantId(), {
    clientId: auth.user.clientId,
  });
  return NextResponse.json({ invoices });
}
