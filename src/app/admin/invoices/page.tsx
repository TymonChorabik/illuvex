"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { formatMoney } from "@/lib/money";

type InvoiceRow = {
  id: string;
  number: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  currency: string;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  paidCents: number;
  issuedAt: string | null;
  dueAt: string | null;
  client: { name: string; email: string };
};

type Summary = {
  count: number;
  netCents: number;
  vatCents: number;
  grossCents: number;
  paidCents: number;
  outstandingCents: number;
  overdueCents: number;
};

const STATUS_LABELS: Record<InvoiceRow["status"], string> = {
  DRAFT: "Draft",
  SENT: "Awaiting payment",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<InvoiceRow["status"], string> = {
  DRAFT: "bg-subtle text-muted",
  SENT: "bg-accent-soft text-accent",
  PAID: "bg-ink text-white",
  OVERDUE: "bg-accent text-white",
  CANCELLED: "bg-subtle text-muted line-through",
};

const FILTERS = ["ALL", "DRAFT", "SENT", "OVERDUE", "PAID"] as const;

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (status: (typeof FILTERS)[number], forYear: string) => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams();
        if (status !== "ALL") query.set("status", status);
        if (forYear) query.set("year", forYear);
        const response = await fetch(`/api/admin/invoices?${query}`);
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            router.push("/admin");
            return;
          }
          setError(data.error ?? "Could not load invoices.");
          return;
        }
        setInvoices(data.invoices as InvoiceRow[]);
        setSummary(data.summary as Summary);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    queueMicrotask(() => void load(filter, year));
  }, [filter, year, load]);

  async function act(id: string, path: string, body?: unknown) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/invoices/${id}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "That did not work.");
        return;
      }
      await load(filter, year);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  const stat = (label: string, cents: number, tone = "") => (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>
        {formatMoney(cents)}
      </p>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <AdminNav />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Facturen</h1>
          <p className="mt-1.5 text-sm text-muted">
            Invoices and the bookkeeping totals behind them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/invoices/export?format=invoices&year=${year}`}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Export CSV
          </a>
          <a
            href={`/api/admin/invoices/export?format=lines&year=${year}`}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            Export for BTW
          </a>
        </div>
      </div>

      {summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stat("Net (excl. BTW)", summary.netCents)}
          {stat("BTW", summary.vatCents)}
          {stat("Gross", summary.grossCents)}
          {stat("Paid", summary.paidCents)}
          {stat(
            "Outstanding",
            summary.outstandingCents,
            summary.overdueCents > 0 ? "text-accent" : "",
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-1.5">
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
            {option === "ALL" ? "All" : STATUS_LABELS[option]}
          </button>
        ))}
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="ml-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        >
          {[0, 1, 2].map((back) => {
            const value = String(new Date().getFullYear() - back);
            return (
              <option key={value} value={value}>
                {value}
              </option>
            );
          })}
        </select>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {error}
        </p>
      )}

      {loading && !invoices && <p className="mt-8 text-sm text-muted">Loading...</p>}

      {invoices && invoices.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="font-medium">No invoices here.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Accept a quote and turn it into an invoice from the Offertes page.
          </p>
        </div>
      )}

      {invoices && invoices.length > 0 && (
        <ul className="mt-6 space-y-3">
          {invoices.map((invoice) => {
            const outstanding = invoice.totalCents - invoice.paidCents;
            return (
              <li key={invoice.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-mono font-semibold tracking-tight">
                        {invoice.number ?? "Draft"}
                      </h2>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[invoice.status]}`}
                      >
                        {STATUS_LABELS[invoice.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      {invoice.client.name}
                      <span className="text-muted"> · {invoice.client.email}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {invoice.issuedAt
                        ? `Issued ${new Date(invoice.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                        : "Not issued yet"}
                      {invoice.dueAt &&
                        ` · due ${new Date(invoice.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatMoney(invoice.totalCents, invoice.currency)}
                    </span>
                    {outstanding > 0 && invoice.status !== "DRAFT" && (
                      <span className="text-xs text-muted">
                        {formatMoney(outstanding, invoice.currency)} outstanding
                      </span>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-subtle"
                      >
                        View
                      </Link>
                      {invoice.status !== "DRAFT" && (
                        <a
                          href={`/api/admin/invoices/${invoice.id}/pdf`}
                          download={`${invoice.number}.pdf`}
                          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-subtle"
                        >
                          PDF
                        </a>
                      )}
                      {invoice.status === "DRAFT" && (
                        <button
                          type="button"
                          disabled={busyId === invoice.id}
                          onClick={() => void act(invoice.id, "/issue")}
                          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-55"
                        >
                          {busyId === invoice.id ? "Issuing..." : "Issue"}
                        </button>
                      )}
                      {outstanding > 0 &&
                        (invoice.status === "SENT" || invoice.status === "OVERDUE") && (
                          <button
                            type="button"
                            disabled={busyId === invoice.id}
                            onClick={() =>
                              void act(invoice.id, "/payment", {
                                amountCents: outstanding,
                              })
                            }
                            className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-55"
                          >
                            Mark paid
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
