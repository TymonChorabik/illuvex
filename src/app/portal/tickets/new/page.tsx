"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ALL_PRIORITIES, PRIORITY_LABELS } from "@/lib/ticket-display";

const field =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent";
const label = "mb-1.5 block text-xs font-medium text-muted";

export default function NewTicketPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/portal/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.get("subject"),
          body: form.get("body"),
          priority: form.get("priority"),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not open the ticket.");
        return;
      }
      router.push(`/portal/tickets/${data.ticket.id}`);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <Link
        href="/portal"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← All tickets
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">New ticket</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Tell us what is wrong and we will pick it up. The more specific you are
        — the page, what you clicked, what you expected — the faster this goes.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <div>
          <label className={label} htmlFor="subject">
            Subject *
          </label>
          <input
            id="subject"
            name="subject"
            required
            minLength={3}
            maxLength={200}
            className={field}
            placeholder="Contact form is not sending"
          />
        </div>

        <div>
          <label className={label} htmlFor="priority">
            How urgent is it?
          </label>
          <select id="priority" name="priority" defaultValue="NORMAL" className={field}>
            {ALL_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="body">
            What is happening? *
          </label>
          <textarea
            id="body"
            name="body"
            required
            minLength={5}
            maxLength={10000}
            rows={6}
            className={`${field} resize-none`}
            placeholder="Since yesterday the contact form shows an error after clicking Send. It happens on my phone and on my laptop."
          />
        </div>

        {error && (
          <p className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-55"
        >
          {pending ? "Opening..." : "Open ticket"}
        </button>
      </form>
    </div>
  );
}
