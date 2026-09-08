"use client";

import { useState } from "react";

export function QuoteDecision({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"accept" | "reject" | null>(null);

  async function decide(decision: "accept" | "reject") {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDone(data.status);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPending(false);
      setConfirming(null);
    }
  }

  if (done) {
    return (
      <div
        className={`rounded-lg px-4 py-3 text-sm font-medium ${
          done === "ACCEPTED"
            ? "bg-accent-soft text-accent"
            : "bg-subtle text-muted"
        }`}
      >
        {done === "ACCEPTED"
          ? "Thank you — your acceptance is recorded and we will be in touch to get started."
          : "Thanks for letting us know. We have recorded that you declined."}
      </div>
    );
  }

  // Accepting is a commitment, so it takes a confirmation rather than one click.
  if (confirming) {
    return (
      <div className="rounded-lg border border-line px-4 py-3.5">
        <p className="text-sm">
          {confirming === "accept"
            ? "Accept this quote and agree to the total above?"
            : "Decline this quote?"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void decide(confirming)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-55 ${
              confirming === "accept" ? "bg-accent" : "bg-ink"
            }`}
          >
            {pending
              ? "Saving..."
              : confirming === "accept"
                ? "Yes, accept"
                : "Yes, decline"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(null)}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setConfirming("accept")}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Accept quote
        </button>
        <button
          type="button"
          onClick={() => setConfirming("reject")}
          className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium transition-colors hover:bg-subtle"
        >
          Decline
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
