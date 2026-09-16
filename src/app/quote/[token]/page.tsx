import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getQuoteByToken } from "@/lib/quotes";
import { formatMoney, formatVatRate, lineTotals } from "@/lib/money";
import { QuoteDecision } from "@/components/quote-decision";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  // A quote is private: never let it reach a search index.
  robots: { index: false, follow: false },
  title: `Your quote — ${SITE.name}`,
};

const STATUS_NOTE: Record<string, { label: string; tone: string }> = {
  ACCEPTED: {
    label: "You accepted this quote.",
    tone: "bg-accent-soft text-accent",
  },
  REJECTED: { label: "You declined this quote.", tone: "bg-subtle text-muted" },
  EXPIRED: { label: "This quote has expired.", tone: "bg-subtle text-muted" },
  DRAFT: {
    label: "This quote is not ready yet.",
    tone: "bg-subtle text-muted",
  },
};

export default async function QuotePage(props: PageProps<"/quote/[token]">) {
  const { token } = await props.params;
  const quote = await getQuoteByToken(token);

  // An invalid, expired or unknown token all look the same from outside: we
  // never confirm a quote exists to someone without the link.
  if (!quote) notFound();

  const note = STATUS_NOTE[quote.status];
  const currency = quote.currency;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="mb-3 text-xs text-muted print:hidden">
        Use your browser&apos;s Print → Save as PDF to download this.
      </p>
      <div className="rounded-2xl border border-line bg-surface print:rounded-none print:border-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-7 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Offerte {quote.reference}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              {quote.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {quote.validUntil && (
                <>
                  Valid until{" "}
                  {quote.validUntil.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </>
              )}
            </p>
          </div>
          <div className="text-right text-xs leading-relaxed text-muted">
            <p className="text-sm font-semibold text-ink">{quote.tenant.name}</p>
            {SITE.addressLine1}
            <br />
            {SITE.city}, {SITE.country}
            <br />
            KVK {SITE.kvkNumber} · BTW {SITE.vatNumber}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-6 border-b border-line px-7 py-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              For
            </p>
            <p className="mt-1.5 font-medium">{quote.client.name}</p>
            <p className="text-sm leading-relaxed text-muted">
              {quote.client.contactName && (
                <>
                  {quote.client.contactName}
                  <br />
                </>
              )}
              {quote.client.addressLine1 && (
                <>
                  {quote.client.addressLine1}
                  <br />
                </>
              )}
              {(quote.client.postcode || quote.client.city) && (
                <>
                  {[quote.client.postcode, quote.client.city]
                    .filter(Boolean)
                    .join(" ")}
                  <br />
                </>
              )}
              {quote.client.country && (
                <>
                  {quote.client.country}
                  <br />
                </>
              )}
              {quote.client.email}
            </p>
            {quote.client.vatNumber && (
              <p className="mt-1 text-sm text-muted">
                BTW {quote.client.vatNumber}
              </p>
            )}
          </div>
          {quote.client.number && (
            <div className="text-right text-sm text-muted">
              <p className="text-[11px] font-medium uppercase tracking-wider">
                Client
              </p>
              <p className="mt-1.5">{quote.client.number}</p>
            </div>
          )}
        </div>

        <div className="px-7 py-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Unit</th>
                  <th className="pb-2 text-right font-medium">BTW</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line) => (
                  <tr key={line.id} className="border-b border-line/70">
                    <td className="py-3 pr-3">{line.description}</td>
                    <td className="py-3 text-right tabular-nums text-muted">
                      {line.quantity}
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted">
                      {formatMoney(line.unitPriceCents, currency)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted">
                      {formatVatRate(line.vatRateBps)}
                    </td>
                    <td className="py-3 pl-3 text-right font-medium tabular-nums">
                      {formatMoney(lineTotals(line).netCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto mt-5 max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="tabular-nums">
                {formatMoney(quote.subtotalCents, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">BTW</span>
              <span className="tabular-nums">
                {formatMoney(quote.vatCents, currency)}
              </span>
            </div>
            <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatMoney(quote.totalCents, currency)}
              </span>
            </div>
          </div>

          {quote.notes && (
            <p className="mt-6 whitespace-pre-wrap rounded-lg bg-subtle px-4 py-3 text-sm leading-relaxed text-muted">
              {quote.notes}
            </p>
          )}
        </div>

        <div className="border-t border-line px-7 py-6">
          {note ? (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${note.tone}`}
            >
              {note.label}
            </div>
          ) : (
            <div className="print:hidden">
              <QuoteDecision token={token} />
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted print:hidden">
            Questions before deciding? Email{" "}
            <a
              href={`mailto:${SITE.businessEmail}?subject=Offerte ${quote.reference}`}
              className="font-medium text-accent hover:underline"
            >
              {SITE.businessEmail}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
