"use client";

import { useMemo, useState } from "react";
import { FilterPanel } from "@/components/filter-panel";
import { RequestModal } from "@/components/request-modal";
import {
  countActiveFilters,
  describeFilters,
  EMPTY_FILTERS,
  type FilterState,
} from "@/lib/offers";
import { SITE } from "@/lib/site";

export default function Page() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [requesting, setRequesting] = useState(false);

  const activeCount = countActiveFilters(filters);
  const summary = useMemo(() => describeFilters(filters), [filters]);

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
            />
          </div>

          <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <p className="font-medium">
              {activeCount > 0
                ? "Mooi — dat maakt het duidelijker."
                : "Elk project krijgt een offerte op maat."}
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
              {activeCount > 0
                ? "Stuur ons wat je hebt aangevinkt en we reageren met een echte prijs, geen slag in de lucht."
                : "Vink links aan wat van toepassing is, of vertel gewoon wat je zoekt."}
            </p>
            <button
              type="button"
              onClick={() => setRequesting(true)}
              className="btn-gradient mt-5 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Offerte op maat aanvragen
            </button>
          </div>
        </div>
      </div>

      {requesting && (
        <RequestModal
          offer={null}
          prefillNotes={summary}
          onClose={() => setRequesting(false)}
        />
      )}
    </>
  );
}
