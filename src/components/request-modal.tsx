"use client";

import { useEffect, useRef, useState } from "react";
import type { Offer } from "@/lib/offers";
import { formatPrice, SITE, STORAGE_KEY } from "@/lib/site";

type Submitted = {
  reference: string;
  email: string;
  emailSent: boolean;
  emailError?: string;
};

export function RequestModal({
  offer,
  prefillNotes,
  onClose,
}: {
  /** null means a custom quote request — no fixed package attached. */
  offer: Offer | null;
  /** Pre-fills the notes field, e.g. with a summary of picked filters. */
  prefillNotes?: string;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Submitted | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer?.id ?? "",
          name: form.get("name"),
          email: form.get("email"),
          company: form.get("company"),
          phone: form.get("phone"),
          notes: form.get("notes"),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Remember the email so the Transactions page can look them up.
      try {
        localStorage.setItem(STORAGE_KEY, data.order.email);
      } catch {
        // Private browsing — not worth failing the order over.
      }

      setDone({
        reference: data.order.reference,
        email: data.order.email,
        emailSent: data.emailSent,
        emailError: data.emailError,
      });
    } catch {
      setError("Couldn't reach the server. Check your connection and retry.");
    } finally {
      setPending(false);
    }
  }

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent";
  const labelClass = "mb-1.5 block text-xs font-medium text-muted";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl"
      >
        {done ? (
          <div className="p-7 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-accent-soft">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-accent"
                aria-hidden="true"
              >
                <path
                  d="M5 12.5 10 17.5 19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2
              id="request-title"
              className="text-lg font-semibold tracking-tight"
            >
              Request received
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
              {done.emailSent ? (
                <>
                  A confirmation is on its way to{" "}
                  <span className="font-medium text-ink">{done.email}</span>. We
                  will reply within one working day.
                </>
              ) : (
                <>
                  Your request is saved and we can see it, but the confirmation
                  email did not go out
                  {done.emailError ? ` (${done.emailError})` : ""}. We will
                  follow up at{" "}
                  <span className="font-medium text-ink">{done.email}</span>{" "}
                  directly.
                </>
              )}
            </p>
            <p className="mt-4 inline-block rounded-lg bg-subtle px-3 py-2 font-mono text-sm">
              {done.reference}
            </p>
            <p className="mt-4 text-xs text-muted">
              Nothing has been charged. Track it under Transactions.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  {offer ? "Requesting" : "Custom quote"}
                </p>
                <h2
                  id="request-title"
                  className="mt-1 text-lg font-semibold tracking-tight"
                >
                  {offer ? offer.name : "Tell us what you need"}
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  {offer
                    ? `${formatPrice(offer.price, offer.priceUnit)} · ${offer.timelineLabel}`
                    : "We'll reply with a price once we know a bit more."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1.5 -mt-1 rounded-lg p-2 text-muted transition-colors hover:bg-subtle hover:text-ink"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="m4 4 8 8M12 4l-8 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="name">
                    Your name *
                  </label>
                  <input
                    ref={firstFieldRef}
                    id="name"
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    className={field}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="email">
                    Email *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className={field}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="company">
                    Business name
                  </label>
                  <input
                    id="company"
                    name="company"
                    maxLength={120}
                    autoComplete="organization"
                    className={field}
                    placeholder="Your business"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    maxLength={40}
                    autoComplete="tel"
                    className={field}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="notes">
                  {offer ? "Anything we should know?" : "What do you need? *"}
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={offer ? 3 : 4}
                  required={!offer}
                  minLength={offer ? undefined : 5}
                  maxLength={2000}
                  defaultValue={prefillNotes}
                  className={`${field} resize-none`}
                  placeholder={
                    offer
                      ? "Deadlines, pages you need, a site you like the look of..."
                      : "What are you trying to build, and what's your rough budget or timeline?"
                  }
                />
              </div>

              {error && (
                <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-line px-6 py-4">
              <p className="flex-1 text-xs leading-snug text-muted">
                We will email a confirmation to you and a copy to {SITE.name}. No
                payment is taken now.
              </p>
              <button
                type="submit"
                disabled={pending}
                className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-55"
              >
                {pending ? "Sending..." : "Send request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
