"use client";

import { useCallback, useEffect, useState } from "react";
import { SITE } from "@/lib/site";
import { formatMoney } from "@/lib/money";

type Invoice = {
  id: string;
  number: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  currency: string;
  totalCents: number;
  paidCents: number;
  issuedAt: string | null;
  dueAt: string | null;
};

const STATUS_LABELS: Record<Invoice["status"], string> = {
  DRAFT: "Draft",
  SENT: "Awaiting payment",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<Invoice["status"], string> = {
  DRAFT: "bg-subtle text-muted",
  SENT: "bg-accent-soft text-accent",
  PAID: "bg-ink text-white",
  OVERDUE: "bg-accent text-white",
  CANCELLED: "bg-subtle text-muted",
};

export default function PortalPage() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    const response = await fetch("/api/portal/invoices");
    if (!response.ok) return;
    const data = await response.json();
    setInvoices(data.invoices as Invoice[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/session")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.authenticated) {
          setUser(data.user);
          void loadInvoices();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadInvoices]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      setUser(data.user);
      setPassword("");
      await loadInvoices();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/portal/session", { method: "DELETE" });
    setUser(null);
    setInvoices([]);
  }

  if (checking) {
    return (
      <div className="mx-auto max-w-sm px-5 py-24 text-center text-sm text-muted">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-5 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Client portal</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Sign in to see your invoices.
        </p>
        <form onSubmit={signIn} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com"
            autoComplete="username"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-55"
          >
            {loading ? "Checking..." : "Sign in"}
          </button>
        </form>
        {error && (
          <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
            {error}
          </p>
        )}
        <p className="mt-6 text-xs leading-relaxed text-muted">
          No account yet? We create one for you when your project starts. Email{" "}
          <a
            href={`mailto:${SITE.businessEmail}`}
            className="font-medium text-accent hover:underline"
          >
            {SITE.businessEmail}
          </a>{" "}
          and we will send an invite.
        </p>
      </div>
    );
  }

  const outstanding = invoices.filter(
    (i) => i.status === "SENT" || i.status === "OVERDUE",
  ).length;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hello, {user.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
            {outstanding > 0 && ` · ${outstanding} awaiting payment`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          Sign out
        </button>
      </div>

      {invoices.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="font-medium">No invoices yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            They will show up here once one is issued to you.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono font-semibold tracking-tight">
                      {invoice.number}
                    </h2>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[invoice.status]}`}
                    >
                      {STATUS_LABELS[invoice.status]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {invoice.issuedAt &&
                      `Issued ${new Date(invoice.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                    {invoice.dueAt &&
                      ` · due ${new Date(invoice.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {formatMoney(invoice.totalCents, invoice.currency)}
                  </p>
                  {invoice.status !== "PAID" && invoice.paidCents > 0 && (
                    <p className="text-xs text-muted">
                      {formatMoney(
                        invoice.totalCents - invoice.paidCents,
                        invoice.currency,
                      )}{" "}
                      outstanding
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Questions about an invoice? Email{" "}
        <a
          href={`mailto:${SITE.businessEmail}`}
          className="font-medium text-accent hover:underline"
        >
          {SITE.businessEmail}
        </a>
      </p>
    </div>
  );
}
