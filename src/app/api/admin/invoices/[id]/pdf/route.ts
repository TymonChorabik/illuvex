import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { getInvoice } from "@/lib/invoices";
import { renderPagePdf, PdfUnavailableError } from "@/lib/pdf";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Downloads the invoice as a real PDF file — the same document staff see
 * on screen, rendered headlessly instead of walked through a print dialog,
 * so it's ready to attach to an email the moment an invoice is issued. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/admin/invoices/[id]/pdf">,
) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Headless rendering is heavy compared to the rest of the app -- a slip
  // of the finger shouldn't be able to spin up ten browsers.
  const limit = rateLimit(clientKey(request, "invoice-pdf"), 10, 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "Te veel PDF-downloads. Rustig aan.");
  }

  const { id } = await ctx.params;
  const invoice = await getInvoice(await getTenantId(), id);
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden." }, { status: 404 });

  const origin = process.env.PUBLIC_URL ?? new URL(request.url).origin;
  const target = `${origin}/admin/invoices/${id}`;

  try {
    const pdf = await renderPagePdf(target, request.headers.get("cookie"));
    const filename = `${invoice.number ?? `invoice-draft-${id.slice(0, 8)}`}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PdfUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    console.error("[invoice-pdf] render failed:", error);
    return NextResponse.json(
      { error: "De PDF kon niet worden gegenereerd. Probeer Afdrukken → Opslaan als PDF." },
      { status: 500 },
    );
  }
}
