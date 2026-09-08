"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TicketThread, type ThreadMessage } from "@/components/ticket-thread";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  type TicketStatusName,
} from "@/lib/ticket-display";

type Ticket = {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatusName;
  createdAt: string;
  messages: ThreadMessage[];
  order: { reference: string; packageName: string } | null;
};

export default function PortalTicketPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/portal/tickets/${id}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load this ticket.");
        return;
      }
      setTicket(data.ticket as Ticket);
      setError(null);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function send(body: string) {
    const response = await fetch(`/api/portal/tickets/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return data?.error ?? "Could not send that.";
    }
    await load();
    return null;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center text-sm text-muted">
        Loading...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="font-medium">{error ?? "Ticket not found."}</p>
        <Link
          href="/portal"
          className="mt-5 inline-block rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Back to portal
        </Link>
      </div>
    );
  }

  const closed = ticket.status === "CLOSED";

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link
        href="/portal"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← All tickets
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ticket.subject}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">{ticket.reference}</p>
          {ticket.order && (
            <p className="mt-1 text-sm text-muted">
              About {ticket.order.packageName} ({ticket.order.reference})
            </p>
          )}
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}
        >
          {STATUS_LABELS[ticket.status]}
        </span>
      </div>

      <div className="mt-8">
        <TicketThread
          messages={ticket.messages}
          mode="customer"
          onSend={(body) => send(body)}
          disabled={closed}
          disabledReason="This ticket is closed. Open a new one if you need us again."
        />
      </div>
    </div>
  );
}
