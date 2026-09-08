"use client";

import { useState } from "react";

export type ThreadMessage = {
  id: string;
  body: string;
  internal: boolean;
  createdAt: string;
  author: { id: string; name: string; role: string } | null;
};

/**
 * Shared message thread. `mode` decides whose messages sit on the right and
 * whether the internal-note control is offered — the API is the real
 * boundary, this only reflects it.
 */
export function TicketThread({
  messages,
  mode,
  onSend,
  disabled,
  disabledReason,
}: {
  messages: ThreadMessage[];
  mode: "staff" | "customer";
  onSend: (body: string, internal: boolean) => Promise<string | null>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const failure = await onSend(body.trim(), internal);
    if (failure) {
      setError(failure);
    } else {
      setBody("");
      setInternal(false);
    }
    setPending(false);
  }

  const isOurs = (message: ThreadMessage) => {
    const role = message.author?.role;
    const fromStaff = role === "ADMIN" || role === "STAFF";
    return mode === "staff" ? fromStaff : !fromStaff;
  };

  return (
    <div>
      <ul className="space-y-3">
        {messages.map((message) => {
          const ours = isOurs(message);
          return (
            <li
              key={message.id}
              className={ours ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.internal
                    ? "border border-dashed border-accent/50 bg-accent-soft"
                    : ours
                      ? "rounded-br-md bg-ink text-white"
                      : "rounded-bl-md bg-subtle text-ink"
                }`}
              >
                <div
                  className={`mb-1 flex items-center gap-2 text-[11px] ${
                    ours && !message.internal ? "text-white/60" : "text-muted"
                  }`}
                >
                  <span className="font-medium">
                    {message.author?.name ?? "Removed user"}
                  </span>
                  <span>
                    {new Date(message.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {message.internal && (
                    <span className="rounded bg-accent px-1.5 py-0.5 font-semibold uppercase tracking-wide text-white">
                      Internal
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {disabled ? (
        <p className="mt-6 rounded-lg bg-subtle px-4 py-3 text-sm text-muted">
          {disabledReason ?? "This ticket is closed."}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={10000}
            placeholder={
              mode === "staff" ? "Reply to the client..." : "Add a reply..."
            }
            className="w-full resize-none rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || !body.trim()}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-45 ${
                internal ? "bg-accent" : "bg-ink"
              }`}
            >
              {pending ? "Sending..." : internal ? "Save internal note" : "Send reply"}
            </button>

            {mode === "staff" && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-[#d94f0b]"
                />
                Internal note — the client never sees this
              </label>
            )}
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
