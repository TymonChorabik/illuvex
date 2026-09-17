"use client";

import {
  BUDGET_LABELS,
  CATEGORY_LABELS,
  FEATURE_LABELS,
  TIMELINE_LABELS,
  type FilterState,
} from "@/lib/offers";
import { SITE } from "@/lib/site";

type Props = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  activeCount: number;
};

function Checkbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
      <span className="relative grid h-4 w-4 shrink-0 place-items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-line bg-surface transition-colors checked:border-accent checked:bg-accent"
        />
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
        >
          <path
            d="M2 6.2 4.6 8.8 10 3.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={
          checked ? "text-ink" : "text-muted transition-colors group-hover:text-ink"
        }
      >
        {label}
      </span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function FilterPanel({
  filters,
  onChange,
  onReset,
  activeCount,
}: Props) {
  function toggle<K extends keyof FilterState>(
    key: K,
    value: FilterState[K][number],
  ) {
    const current = filters[key] as FilterState[K][number][];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next } as FilterState);
  }

  return (
    <aside className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">Filter</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-accent hover:underline"
          >
            Wis {activeCount}
          </button>
        )}
      </div>

      <Group title="Wat je nodig hebt">
        {(
          Object.entries(CATEGORY_LABELS) as [
            keyof typeof CATEGORY_LABELS,
            string,
          ][]
        ).map(([value, label]) => (
          <Checkbox
            key={value}
            label={label}
            checked={filters.categories.includes(value)}
            onToggle={() => toggle("categories", value)}
          />
        ))}
      </Group>

      <Group title={`Budget (${SITE.currency})`}>
        {(
          Object.entries(BUDGET_LABELS) as [keyof typeof BUDGET_LABELS, string][]
        ).map(([value, label]) => (
          <Checkbox
            key={value}
            label={label}
            checked={filters.budgets.includes(value)}
            onToggle={() => toggle("budgets", value)}
          />
        ))}
      </Group>

      <Group title="Doorlooptijd">
        {(
          Object.entries(TIMELINE_LABELS) as [
            keyof typeof TIMELINE_LABELS,
            string,
          ][]
        ).map(([value, label]) => (
          <Checkbox
            key={value}
            label={label}
            checked={filters.timelines.includes(value)}
            onToggle={() => toggle("timelines", value)}
          />
        ))}
      </Group>

      <Group title="Moet inbegrepen zijn">
        {(
          Object.entries(FEATURE_LABELS) as [keyof typeof FEATURE_LABELS, string][]
        ).map(([value, label]) => (
          <Checkbox
            key={value}
            label={label}
            checked={filters.features.includes(value)}
            onToggle={() => toggle("features", value)}
          />
        ))}
      </Group>
    </aside>
  );
}
