"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TicketThread, type ThreadMessage } from "@/components/ticket-thread";
import {
  ALL_PRIORITIES,
  ALL_STATUSES,
  PRIORITY_LABELS,
  STAFF_STATUS_LABELS,
  STATUS_STYLES,
  type TicketPriorityName,
  type TicketStatusName,
} from "@/lib/ticket-display";

type Ticket = {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatusName;
  priority: TicketPriorityName;
  createdAt: string;
  messages: ThreadMessage[];
  client: { id: string; name: string; email: string };
  order: { reference: string; packageName: string } | null;
};

export default function AdminTicketPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/tickets/${id}`);
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

  async function send(body: string, internal: boolean) {
    const response = await fetch(`/api/admin/tickets/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, internal }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return data?.error ?? "Could not send that.";
    }
    await load();
    return null;
  }

  async function patch(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Could not save that.");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
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
          href="/admin/tickets"
          className="mt-5 inline-block rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Back to tickets
        </Link>
      </div>
    );
  }

  const select =
    "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-55";

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href="/admin/tickets"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← All tickets
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {ticket.subject}
            </h1>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[ticket.status]}`}
            >
              {STAFF_STATUS_LABELS[ticket.status]}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted">{ticket.reference}</p>
          <p className="mt-2 text-sm">
            {ticket.client.name}
            <span className="text-muted"> · </span>
            <a
              href={`mailto:${ticket.client.email}?subject=Re: ${ticket.subject} (${ticket.reference})`}
              className="text-accent hover:underline"
            >
              {ticket.client.email}
            </a>
          </p>
          {ticket.order && (
            <p className="mt-1 text-sm text-muted">
              About {ticket.order.packageName} ({ticket.order.reference})
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <select
            value={ticket.status}
            disabled={saving}
            onChange={(e) => void patch({ status: e.target.value })}
            className={select}
          >
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STAFF_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            value={ticket.priority}
            disabled={saving}
            onChange={(e) => void patch({ priority: e.target.value })}
            className={select}
          >
            {ALL_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]} priority
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-8">
        <TicketThread
          messages={ticket.messages}
          mode="staff"
          onSend={send}
          disabled={ticket.status === "CLOSED"}
          disabledReason="This ticket is closed. Reopen it above to reply."
        />
      </div>
    </div>
  );
}
