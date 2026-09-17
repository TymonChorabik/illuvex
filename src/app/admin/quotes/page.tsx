"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { formatMoney } from "@/lib/money";

type QuoteRow = {
  id: string;
  reference: string;
  title: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  currency: string;
  totalCents: number;
  validUntil: string | null;
  createdAt: string;
  client: { name: string; email: string };
  _count: { lines: number };
  invoices: { id: string }[];
};

const STATUS_LABELS: Record<QuoteRow["status"], string> = {
  DRAFT: "Concept",
  SENT: "Wacht op beslissing",
  ACCEPTED: "Geaccepteerd",
  REJECTED: "Afgewezen",
  EXPIRED: "Verlopen",
};

const STATUS_STYLES: Record<QuoteRow["status"], string> = {
  DRAFT: "bg-subtle text-muted",
  SENT: "bg-accent-soft text-accent",
  ACCEPTED: "bg-ink text-white",
  REJECTED: "bg-subtle text-muted",
  EXPIRED: "bg-subtle text-muted",
};

const FILTERS = ["ALL", "DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<{ id: string; link: string } | null>(
    null,
  );
  // quoteId -> invoiceId, so "View invoice" can link straight to the
  // document instead of just the list.
  const [invoiceIdByQuote, setInvoiceIdByQuote] = useState<
    Record<string, string>
  >({});

  const load = useCallback(async (status: (typeof FILTERS)[number]) => {
    setLoading(true);
    setError(null);
    try {
      const query = status === "ALL" ? "" : `?status=${status}`;
      const response = await fetch(`/api/admin/quotes${query}`);
      const data = await response.json();
      if (!response.ok) {
        // Landed here signed out (e.g. a direct link) -- send to the page
        // with the actual sign-in form instead of stranding on an error.
        if (response.status === 401) {
          router.push("/admin");
          return;
        }
        setError(data.error ?? "Kon offertes niet laden.");
        setQuotes(null);
        return;
      }
      const rows = data.quotes as QuoteRow[];
      setQuotes(rows);
      // Server truth for which quotes already have an invoice -- merged
      // rather than replaced, so a filtered view doesn't forget rows it
      // isn't currently showing.
      const known = rows
        .filter((q) => q.invoices.length > 0)
        .map((q) => [q.id, q.invoices[0]!.id] as const);
      if (known.length > 0) {
        setInvoiceIdByQuote((prev) => ({ ...prev, ...Object.fromEntries(known) }));
      }
    } catch {
      setError("Kon de server niet bereiken.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Deferred out of the effect body so the fetch's state updates land in a
    // later task rather than cascading through this render.
    queueMicrotask(() => void load(filter));
  }, [filter, load]);

  async function send(id: string) {
    setSendingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/quotes/${id}/send`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Kon niet versturen.");
        return;
      }
      // Surfaced so staff can copy the link while email is unconfigured.
      setLastLink({ id, link: data.link });
      // load() clears the error at its own start, so it must run before the
      // message below, not after -- otherwise the reload wipes it instantly
      // and this warning is never actually seen.
      await load(filter);
      if (!data.emailSent) {
        setError(
          `Offerte gemarkeerd als verstuurd, maar de e-mail ging niet door (${data.emailError}). Kopieer de link hieronder en stuur hem zelf.`,
        );
      }
    } catch {
      setError("Kon de server niet bereiken.");
    } finally {
      setSendingId(null);
    }
  }

  async function invoice(id: string) {
    setInvoicingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Kon de factuur niet aanmaken.");
        return;
      }
      setInvoiceIdByQuote((prev) => ({ ...prev, [id]: data.invoice.id }));
    } catch {
      setError("Kon de server niet bereiken.");
    } finally {
      setInvoicingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <AdminNav />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Offertes</h1>
          <p className="mt-1.5 text-sm text-muted">
            Offertes die je hebt opgesteld, en de status van elk.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/quotes/new"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            Nieuwe offerte
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === option
                ? "bg-ink text-white"
                : "border border-line text-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            {option === "ALL" ? "Alle" : STATUS_LABELS[option]}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {error}
        </p>
      )}

      {loading && !quotes && (
        <p className="mt-8 text-sm text-muted">Laden...</p>
      )}

      {quotes && quotes.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="font-medium">Nog geen offertes.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Maak er een aan met de knop Nieuwe offerte — de klant krijgt een
            link waarmee die kan accepteren of afwijzen, zonder account nodig
            te hebben.
          </p>
        </div>
      )}

      {quotes && quotes.length > 0 && (
        <ul className="mt-6 space-y-3">
          {quotes.map((quote) => (
            <li
              key={quote.id}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold tracking-tight">
                      {quote.title}
                    </h2>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[quote.status]}`}
                    >
                      {STATUS_LABELS[quote.status]}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {quote.reference}
                  </p>
                  <p className="mt-2 text-sm">
                    {quote.client.name}
                    <span className="text-muted"> · {quote.client.email}</span>
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="font-semibold tabular-nums">
                    {formatMoney(quote.totalCents, quote.currency)}
                  </span>
                  {quote.status === "DRAFT" && (
                    <button
                      type="button"
                      disabled={sendingId === quote.id}
                      onClick={() => void send(quote.id)}
                      className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-55"
                    >
                      {sendingId === quote.id ? "Versturen..." : "Versturen naar klant"}
                    </button>
                  )}
                  {quote.status === "ACCEPTED" &&
                    (invoiceIdByQuote[quote.id] ? (
                      <Link
                        href={`/admin/invoices/${invoiceIdByQuote[quote.id]}`}
                        className="rounded-lg border border-line px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-subtle"
                      >
                        Factuur bekijken
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={invoicingId === quote.id}
                        onClick={() => void invoice(quote.id)}
                        className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-55"
                      >
                        {invoicingId === quote.id
                          ? "Aanmaken..."
                          : "Factuur aanmaken"}
                      </button>
                    ))}
                </div>
              </div>

              {lastLink?.id === quote.id && (
                <div className="mt-3 rounded-lg bg-subtle px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    Link voor klant
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">
                    {lastLink.link}
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                <span>
                  {quote._count.lines}{" "}
                  {quote._count.lines === 1 ? "regel" : "regels"}
                </span>
                <span>
                  Opgesteld{" "}
                  {new Date(quote.createdAt).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {quote.validUntil && (
                  <span>
                    Geldig tot{" "}
                    {new Date(quote.validUntil).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
