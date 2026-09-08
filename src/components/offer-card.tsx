"use client";

import { CATEGORY_LABELS, type Offer } from "@/lib/offers";
import { formatPrice } from "@/lib/site";

export function OfferCard({
  offer,
  onRequest,
}: {
  offer: Offer;
  onRequest: (offer: Offer) => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface transition-shadow hover:shadow-[0_1px_3px_rgba(28,25,23,0.06),0_8px_24px_-8px_rgba(28,25,23,0.12)]">
      <div className="border-b border-line px-5 pb-4 pt-5">
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <span className="rounded-md bg-subtle px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            {CATEGORY_LABELS[offer.category]}
          </span>
          {offer.popular && (
            <span className="rounded-md bg-accent-soft px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
              Most picked
            </span>
          )}
        </div>

        <h3 className="text-lg font-semibold tracking-tight">{offer.name}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{offer.summary}</p>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight">
            {formatPrice(offer.price)}
          </span>
          {offer.priceUnit && (
            <span className="text-sm font-medium text-muted">
              {offer.priceUnit}
            </span>
          )}
          <span className="ml-auto text-xs text-muted">
            {offer.timelineLabel}
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-2 px-5 py-4">
        {offer.includes.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-snug">
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
            >
              <path
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-muted">{item}</span>
          </li>
        ))}
      </ul>

      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={() => onRequest(offer)}
          className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Request this package
        </button>
      </div>
    </article>
  );
}
