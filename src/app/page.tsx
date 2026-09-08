"use client";

import { useMemo, useState } from "react";
import { FilterPanel } from "@/components/filter-panel";
import { OfferCard } from "@/components/offer-card";
import { RequestModal } from "@/components/request-modal";
import {
  countActiveFilters,
  EMPTY_FILTERS,
  filterOffers,
  OFFERS,
  type FilterState,
  type Offer,
} from "@/lib/offers";
import { SITE } from "@/lib/site";

export default function Page() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Offer | null>(null);

  const results = useMemo(() => filterOffers(OFFERS, filters), [filters]);
  const activeCount = countActiveFilters(filters);

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            {SITE.tagline}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            {SITE.blurb}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[248px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(EMPTY_FILTERS)}
              activeCount={activeCount}
              resultCount={results.length}
            />
          </div>

          <div>
            {results.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
                <p className="font-medium">Nothing matches all of those.</p>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                  Loosen a filter, or ask the assistant in the corner — we build
                  custom quotes too.
                </p>
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="mt-5 rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    onRequest={setSelected}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <RequestModal offer={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
