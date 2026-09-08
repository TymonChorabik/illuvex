"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ALL_STATUSES,
  PRIORITY_LABELS,
  STAFF_STATUS_LABELS,
  STATUS_STYLES,
  type TicketPriorityName,
  type TicketStatusName,
} from "@/lib/ticket-display";

type TicketRow = {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatusName;
  priority: TicketPriorityName;
  updatedAt: string;
  client: { name: string; email: string };
  _count: { messages: number };
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [filter, setFilter] = useState<"ALL" | TicketStatusName>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: "ALL" | TicketStatusName) => {
    setLoading(true);
    setError(null);
    try {
      const query = status === "ALL" ? "" : `?status=${status}`;
      const response = await fetch(`/api/admin/tickets${query}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load tickets.");
        setTickets(null);
        return;
      }
      setTickets(data.tickets as TicketRow[]);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load(filter));
  }, [filter, load]);

  const waiting = tickets?.filter((t) => t.status === "WAITING_ON_US").length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tickets</h1>
          <p className="mt-1.5 text-sm text-muted">
            {tickets?.length ?? 0} total
            {waiting > 0 && ` · ${waiting} need a reply`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Requests
          </Link>
          <Link
            href="/admin/quotes"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Offertes
          </Link>
          <Link
            href="/admin/invoices"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Facturen
          </Link>
          <Link
            href="/admin/clients"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Clients
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {(["ALL", ...ALL_STATUSES] as const).map((option) => (
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
            {option === "ALL" ? "All" : STAFF_STATUS_LABELS[option]}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {error}
        </p>
      )}

      {loading && !tickets && <p className="mt-8 text-sm text-muted">Loading...</p>}

      {tickets && tickets.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="font-medium">Nothing here.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Tickets appear when a client raises one from their portal.
          </p>
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <ul className="mt-6 space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/admin/tickets/${ticket.id}`}
                className="block rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-[0_1px_3px_rgba(28,25,23,0.06),0_8px_24px_-8px_rgba(28,25,23,0.12)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold tracking-tight">
                        {ticket.subject}
                      </h2>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[ticket.status]}`}
                      >
                        {STAFF_STATUS_LABELS[ticket.status]}
                      </span>
                      {(ticket.priority === "HIGH" ||
                        ticket.priority === "URGENT") && (
                        <span className="rounded-md border border-accent px-2 py-0.5 text-[11px] font-medium text-accent">
                          {PRIORITY_LABELS[ticket.priority]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {ticket.reference}
                    </p>
                    <p className="mt-2 text-sm">
                      {ticket.client.name}
                      <span className="text-muted"> · {ticket.client.email}</span>
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>
                      {ticket._count.messages} message
                      {ticket._count.messages === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1">
                      {new Date(ticket.updatedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
