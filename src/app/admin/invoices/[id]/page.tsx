import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { getInvoice, type BillingSnapshot } from "@/lib/invoices";
import { formatMoney, formatVatRate, lineTotals, documentTotals } from "@/lib/money";
import { SITE } from "@/lib/site";
import { InvoiceSendButton } from "@/components/invoice-send-button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: `Invoice — ${SITE.name}`,
};

/**
 * The invoice document itself. Rendered on the server and styled for print,
 * so "Save as PDF" from the browser produces the file you would send — no PDF
 * library, no second layout that can drift from this one.
 */
export default async function InvoiceDetailPage(
  props: PageProps<"/admin/invoices/[id]">,
) {
  const auth = await requireStaff();
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="font-medium">{auth.error}</p>
        <Link
          href="/admin"
          className="mt-5 inline-block rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const { id } = await props.params;
  const invoice = await getInvoice(await getTenantId(), id);
  if (!invoice) notFound();

  // An issued invoice shows the frozen snapshot; a draft shows live details,
  // because they can still change before issue.
  const snapshot = invoice.billingSnapshot as unknown as BillingSnapshot | null;
  const billTo: BillingSnapshot =
    invoice.status !== "DRAFT" && snapshot?.name
      ? snapshot
      : {
          name: invoice.client.name,
          contactName: invoice.client.contactName,
          email: invoice.client.email,
          vatNumber: invoice.client.vatNumber,
          addressLine1: invoice.client.addressLine1,
          postcode: invoice.client.postcode,
          city: invoice.client.city,
          country: invoice.client.country,
        };

  const totals = documentTotals(invoice.lines);
  const outstanding = invoice.totalCents - invoice.paidCents;
  const date = (value: Date | null) =>
    value
      ? value.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/invoices"
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          ← All invoices
        </Link>
        <div className="flex items-start gap-3">
          <span className="mt-2 text-xs text-muted">
            Or use your browser&apos;s Print → Save as PDF.
          </span>
          <a
            href={`/api/admin/invoices/${invoice.id}/pdf`}
            download={`${invoice.number ?? "invoice-draft"}.pdf`}
            className="btn-gradient rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Download PDF
          </a>
          {invoice.number && (
            <InvoiceSendButton
              invoiceId={invoice.id}
              alreadySentAt={invoice.emailSentAt?.toISOString() ?? null}
            />
          )}
        </div>
      </div>

      <article className="rounded-2xl border border-line bg-surface p-9 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-7">
          <div>
            <p className="text-lg font-semibold tracking-tight">{SITE.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {SITE.addressLine1}
              <br />
              {SITE.city}, {SITE.country}
              <br />
              {SITE.businessEmail}
              <br />
              {SITE.phone}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              KVK {SITE.kvkNumber}
              <br />
              BTW {SITE.vatNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              {invoice.status === "DRAFT" ? "Concept factuur" : "Factuur"}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold">
              {invoice.number ?? "Not issued"}
            </p>
            <p className="mt-2 text-xs text-muted">
              Issued {date(invoice.issuedAt)}
              <br />
              Due {date(invoice.dueAt)}
            </p>
            {invoice.client.number && (
              <p className="mt-2 text-xs text-muted">
                Client {invoice.client.number}
              </p>
            )}
          </div>
        </header>

        <section className="flex flex-wrap justify-between gap-6 border-b border-line py-7">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Bill to
            </p>
            <p className="mt-1.5 font-medium">{billTo.name}</p>
            <p className="text-sm leading-relaxed text-muted">
              {billTo.contactName && (
                <>
                  {billTo.contactName}
                  <br />
                </>
              )}
              {billTo.addressLine1 && (
                <>
                  {billTo.addressLine1}
                  <br />
                </>
              )}
              {(billTo.postcode || billTo.city) && (
                <>
                  {[billTo.postcode, billTo.city].filter(Boolean).join(" ")}
                  <br />
                </>
              )}
              {billTo.country && (
                <>
                  {billTo.country}
                  <br />
                </>
              )}
              {billTo.email}
            </p>
            {billTo.vatNumber && (
              <p className="mt-1 text-sm text-muted">BTW {billTo.vatNumber}</p>
            )}
          </div>
          {invoice.quote && (
            <div className="text-right text-sm text-muted">
              <p className="text-[11px] font-medium uppercase tracking-wider">
                Reference
              </p>
              <p className="mt-1.5">{invoice.quote.reference}</p>
              <p>{invoice.quote.title}</p>
            </div>
          )}
        </section>

        <section className="py-7">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit</th>
                <th className="pb-2 text-right font-medium">BTW</th>
                <th className="pb-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b border-line/70">
                  <td className="py-3 pr-3">{line.description}</td>
                  <td className="py-3 text-right tabular-nums text-muted">
                    {line.quantity}
                  </td>
                  <td className="py-3 text-right tabular-nums text-muted">
                    {formatMoney(line.unitPriceCents, invoice.currency)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-muted">
                    {formatVatRate(line.vatRateBps)}
                  </td>
                  <td className="py-3 pl-3 text-right font-medium tabular-nums">
                    {formatMoney(lineTotals(line).netCents, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-6 max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="tabular-nums">
                {formatMoney(invoice.subtotalCents, invoice.currency)}
              </span>
            </div>
            {/* Per-rate breakdown is what a BTW return needs. */}
            {totals.vatByRate.map((rate) => (
              <div key={rate.rateBps} className="flex justify-between">
                <span className="text-muted">
                  BTW {formatVatRate(rate.rateBps)} over{" "}
                  {formatMoney(rate.netCents, invoice.currency)}
                </span>
                <span className="tabular-nums">
                  {formatMoney(rate.vatCents, invoice.currency)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatMoney(invoice.totalCents, invoice.currency)}
              </span>
            </div>
            {invoice.paidCents > 0 && (
              <>
                <div className="flex justify-between pt-1">
                  <span className="text-muted">Paid</span>
                  <span className="tabular-nums">
                    −{formatMoney(invoice.paidCents, invoice.currency)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Outstanding</span>
                  <span className="tabular-nums">
                    {formatMoney(outstanding, invoice.currency)}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        <footer className="border-t border-line pt-6 text-xs leading-relaxed text-muted">
          {invoice.status === "PAID" ? (
            <p className="font-medium text-ink">
              Paid in full on {date(invoice.paidAt)} — thank you.
            </p>
          ) : invoice.status === "DRAFT" ? (
            <p className="font-medium text-accent">
              This is a draft. It has no invoice number and is not payable until
              issued.
            </p>
          ) : (
            <>
              <p>
                Please pay {formatMoney(outstanding, invoice.currency)} by{" "}
                {date(invoice.dueAt)}, quoting {invoice.number}.
              </p>
              <p className="mt-2">
                {SITE.bankAccount} · {SITE.bic}
              </p>
            </>
          )}
        </footer>
      </article>
    </div>
  );
}
