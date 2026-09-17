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
        setError(data.error ?? "Er ging iets mis.");
        return;
      }
      setDone(data.status);
    } catch {
      setError("Kon de server niet bereiken. Probeer het opnieuw.");
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
          ? "Bedankt — je acceptatie is geregistreerd en we nemen contact op om te starten."
          : "Bedankt voor het laten weten. We hebben geregistreerd dat je hebt afgewezen."}
      </div>
    );
  }

  // Accepting is a commitment, so it takes a confirmation rather than one click.
  if (confirming) {
    return (
      <div className="rounded-lg border border-line px-4 py-3.5">
        <p className="text-sm">
          {confirming === "accept"
            ? "Deze offerte accepteren en akkoord met het totaalbedrag hierboven?"
            : "Deze offerte afwijzen?"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void decide(confirming)}
            className={`rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-55 ${
              confirming === "accept" ? "btn-gradient" : "bg-ink"
            }`}
          >
            {pending
              ? "Bezig met opslaan..."
              : confirming === "accept"
                ? "Ja, accepteren"
                : "Ja, afwijzen"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(null)}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Annuleren
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
          className="btn-gradient rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Offerte accepteren
        </button>
        <button
          type="button"
          onClick={() => setConfirming("reject")}
          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium transition-colors hover:bg-subtle"
        >
          Afwijzen
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
