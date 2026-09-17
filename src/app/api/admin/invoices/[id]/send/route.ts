import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { getInvoice, markInvoiceEmailed } from "@/lib/invoices";
import { renderPagePdf, PdfUnavailableError } from "@/lib/pdf";
import { sendInvoiceEmail } from "@/lib/invoice-email";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Emails the invoice PDF to the client. Not a one-shot action like a
 * quote's send -- an invoice has no decision to make, so calling this
 * again (client lost the email, ask to resend) is expected and allowed.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/invoices/[id]/send">,
) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Same cost as a PDF download plus an outgoing email -- worth throttling.
  const limit = rateLimit(clientKey(request, "invoice-send"), 10, 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "Too many sends. Slow down.");
  }

  const tenantId = await getTenantId();
  const { id } = await ctx.params;
  const invoice = await getInvoice(tenantId, id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (!invoice.number) {
    return NextResponse.json(
      { error: "Issue the invoice before emailing it." },
      { status: 409 },
    );
  }

  const origin = process.env.PUBLIC_URL ?? new URL(request.url).origin;
  const target = `${origin}/admin/invoices/${id}`;

  let pdf: Buffer;
  try {
    pdf = await renderPagePdf(target, request.headers.get("cookie"));
  } catch (error) {
    if (error instanceof PdfUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    console.error("[invoice-send] PDF render failed:", error);
    return NextResponse.json(
      { error: "Could not generate the PDF to attach." },
      { status: 500 },
    );
  }

  const result = await sendInvoiceEmail(
    {
      number: invoice.number,
      currency: invoice.currency,
      totalCents: invoice.totalCents,
      dueAt: invoice.dueAt,
      client: invoice.client,
    },
    pdf,
  );
  if (result.sent) await markInvoiceEmailed(tenantId, id);

  return NextResponse.json({ emailSent: result.sent, emailError: result.reason });
}
