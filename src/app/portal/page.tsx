"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SITE } from "@/lib/site";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  type TicketStatusName,
  type TicketPriorityName,
} from "@/lib/ticket-display";

type Ticket = {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatusName;
  priority: TicketPriorityName;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
};

export default function PortalPage() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    const response = await fetch("/api/portal/tickets");
    if (!response.ok) return;
    const data = await response.json();
    setTickets(data.tickets as Ticket[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/session")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.authenticated) {
          setUser(data.user);
          void loadTickets();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadTickets]);

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
      await loadTickets();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/portal/session", { method: "DELETE" });
    setUser(null);
    setTickets([]);
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
          Sign in to see your projects and raise a support ticket.
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

  const needsReply = tickets.filter((t) => t.status === "WAITING_ON_CUSTOMER").length;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hello, {user.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
            {needsReply > 0 && ` · ${needsReply} waiting on you`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/portal/tickets/new"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            New ticket
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="font-medium">No tickets yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            If something on your site needs attention, open a ticket and we will
            pick it up.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/portal/tickets/${ticket.id}`}
                className="block rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-[0_1px_3px_rgba(28,25,23,0.06),0_8px_24px_-8px_rgba(28,25,23,0.12)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold tracking-tight">
                        {ticket.subject}
                      </h2>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[ticket.status]}`}
                      >
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {ticket.reference}
                    </p>
                  </div>
                  <span className="text-xs text-muted">
                    {ticket._count.messages} message
                    {ticket._count.messages === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
