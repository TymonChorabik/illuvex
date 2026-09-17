"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "@/lib/db";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/order-status";
import { formatMoney } from "@/lib/money";
import { formatPrice, SITE, STORAGE_KEY } from "@/lib/site";

type QuoteRow = {
  id: string;
  reference: string;
  title: string;
  status: "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  currency: string;
  totalCents: number;
  createdAt: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  status: "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  currency: string;
  totalCents: number;
  paidCents: number;
  issuedAt: string | null;
  dueAt: string | null;
};

const QUOTE_LABELS: Record<QuoteRow["status"], string> = {
  SENT: "Wacht op jouw beslissing",
  ACCEPTED: "Geaccepteerd",
  REJECTED: "Afgewezen",
  EXPIRED: "Verlopen",
};

const QUOTE_STYLES: Record<QuoteRow["status"], string> = {
  SENT: "bg-accent-soft text-accent",
  ACCEPTED: "bg-ink text-white",
  REJECTED: "bg-subtle text-muted",
  EXPIRED: "bg-subtle text-muted",
};

const INVOICE_LABELS: Record<InvoiceRow["status"], string> = {
  SENT: "Wacht op betaling",
  PAID: "Betaald",
  OVERDUE: "Verlopen",
  CANCELLED: "Geannuleerd",
};

const INVOICE_STYLES: Record<InvoiceRow["status"], string> = {
  SENT: "bg-accent-soft text-accent",
  PAID: "bg-ink text-white",
  OVERDUE: "bg-accent text-white",
  CANCELLED: "bg-subtle text-muted",
};

function dateLabel(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TransactionsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/orders?email=${encodeURIComponent(trimmed)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Kon je aanvragen niet laden.");
        setOrders(null);
        return;
      }
      setOrders(data.orders as Order[]);
      setQuotes((data.quotes as QuoteRow[]) ?? []);
      setInvoices((data.invoices as InvoiceRow[]) ?? []);
      try {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } catch {
        // Storage unavailable — the lookup still worked.
      }
    } catch {
      setError("Kon de server niet bereiken. Controleer je verbinding en probeer opnieuw.");
      setOrders(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Anyone who has ordered before gets their history without retyping. The
  // input is uncontrolled so this can prefill the DOM without a render pass.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (!saved) return;
    if (inputRef.current) inputRef.current.value = saved;
    // Deferred out of the effect body so the fetch's state updates land in a
    // later task rather than cascading through this render.
    queueMicrotask(() => void lookup(saved));
  }, [lookup]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Jouw transacties</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Elke aanvraag, offerte en factuur die aan jouw e-mailadres is
        gekoppeld, en de status ervan. Zoek ze op met het adres dat je bij ons
        hebt gebruikt.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(inputRef.current?.value ?? "");
        }}
        className="mt-6 flex flex-col gap-2.5 sm:flex-row"
      >
        <input
          ref={inputRef}
          type="email"
          required
          defaultValue=""
          placeholder="jij@voorbeeld.nl"
          autoComplete="email"
          className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-55"
        >
          {loading ? "Zoeken..." : "Zoeken"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {error}
        </p>
      )}

      {orders !== null && !error && (
        <div className="mt-8 space-y-10">
          {orders.length === 0 && quotes.length === 0 && invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
              <p className="font-medium">Niets gevonden onder dat adres.</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                Controleer de spelling, of vraag een offerte aan op de
                homepage om je eerste te starten.
              </p>
            </div>
          ) : (
            <>
          {orders.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
                {orders.length} {orders.length === 1 ? "aanvraag" : "aanvragen"}
              </p>
              <ul className="space-y-3">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-xl border border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold tracking-tight">
                          {order.offerName}
                        </h2>
                        <p className="mt-0.5 font-mono text-xs text-muted">
                          {order.reference}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatPrice(order.price, order.priceUnit)}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[order.status]}`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                    </div>

                    {order.notes && (
                      <p className="mt-3 whitespace-pre-wrap border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">
                        {order.notes}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                      <span>
                        Verstuurd{" "}
                        {new Date(order.createdAt).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span>
                        {order.emailSent
                          ? "Bevestiging gemaild"
                          : "Bevestiging niet verstuurd"}
                      </span>
                      {order.company && <span>{order.company}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quotes.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
                {quotes.length} {quotes.length === 1 ? "offerte" : "offertes"}
              </p>
              <ul className="space-y-3">
                {quotes.map((quote) => (
                  <li
                    key={quote.id}
                    className="rounded-xl border border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold tracking-tight">
                          {quote.title}
                        </h2>
                        <p className="mt-0.5 font-mono text-xs text-muted">
                          {quote.reference}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatMoney(quote.totalCents, quote.currency)}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${QUOTE_STYLES[quote.status]}`}
                        >
                          {QUOTE_LABELS[quote.status]}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
                      <span>Verstuurd {dateLabel(quote.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {invoices.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
                {invoices.length} {invoices.length === 1 ? "factuur" : "facturen"}
              </p>
              <ul className="space-y-3">
                {invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="rounded-xl border border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-mono font-semibold tracking-tight">
                          {invoice.number}
                        </h2>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatMoney(invoice.totalCents, invoice.currency)}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${INVOICE_STYLES[invoice.status]}`}
                        >
                          {INVOICE_LABELS[invoice.status]}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                      {invoice.issuedAt && (
                        <span>Verzonden {dateLabel(invoice.issuedAt)}</span>
                      )}
                      {invoice.dueAt && (
                        <span>Vervalt {dateLabel(invoice.dueAt)}</span>
                      )}
                      {invoice.status !== "PAID" && invoice.paidCents > 0 && (
                        <span>
                          {formatMoney(
                            invoice.totalCents - invoice.paidCents,
                            invoice.currency,
                          )}{" "}
                          openstaand
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
            </>
          )}
        </div>
      )}

      <p className="mt-10 border-t border-line pt-5 text-xs text-muted">
        Klopt er iets niet? Mail{" "}
        <a
          href={`mailto:${SITE.businessEmail}`}
          className="font-medium text-accent hover:underline"
        >
          {SITE.businessEmail}
        </a>{" "}
        met je referentie.
      </p>
    </div>
  );
}
