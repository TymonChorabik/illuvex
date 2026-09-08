"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  documentTotals,
  formatMoney,
  formatVatRate,
  parseMoneyToCents,
} from "@/lib/money";

type DraftLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  vatRateBps: number;
};

const VAT_OPTIONS = [2100, 900, 0];
const BLANK_LINE: DraftLine = {
  description: "",
  quantity: "1",
  unitPrice: "",
  vatRateBps: 2100,
};

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent";
const label = "mb-1.5 block text-xs font-medium text-muted";

export default function NewQuotePage() {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>([{ ...BLANK_LINE }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Totals are computed with the same functions the server uses, so the
   * number on screen is the number that gets stored — no second implementation
   * to drift out of sync.
   */
  const totals = useMemo(() => {
    const parsed = lines
      .map((line) => {
        const cents = parseMoneyToCents(line.unitPrice);
        const qty = Number.parseInt(line.quantity, 10);
        if (cents === null || !Number.isInteger(qty) || qty < 1) return null;
        return { quantity: qty, unitPriceCents: cents, vatRateBps: line.vatRateBps };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    return documentTotals(parsed);
  }, [lines]);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const payloadLines = [];
    for (const [index, line] of lines.entries()) {
      if (!line.description.trim()) {
        setError(`Line ${index + 1} needs a description.`);
        return;
      }
      const cents = parseMoneyToCents(line.unitPrice);
      if (cents === null) {
        setError(`Line ${index + 1}: that price is not a number.`);
        return;
      }
      const qty = Number.parseInt(line.quantity, 10);
      if (!Number.isInteger(qty) || qty < 1) {
        setError(`Line ${index + 1}: quantity must be a whole number.`);
        return;
      }
      payloadLines.push({
        description: line.description.trim(),
        quantity: qty,
        unitPriceCents: cents,
        vatRateBps: line.vatRateBps,
      });
    }

    setPending(true);
    try {
      const response = await fetch("/api/admin/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            name: form.get("clientName"),
            contactName: form.get("contactName"),
            email: form.get("clientEmail"),
            phone: form.get("phone"),
            vatNumber: form.get("vatNumber"),
            city: form.get("city"),
          },
          title: form.get("title"),
          notes: form.get("notes"),
          validUntil: form.get("validUntil") || null,
          lines: payloadLines,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not create the quote.");
        return;
      }
      router.push("/admin/quotes");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">New quote</h1>
        <Link
          href="/admin/quotes"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-subtle"
        >
          Cancel
        </Link>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold">Client</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="clientName">
                Business name *
              </label>
              <input id="clientName" name="clientName" required maxLength={200} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="clientEmail">
                Email *
              </label>
              <input id="clientEmail" name="clientEmail" type="email" required className={field} />
            </div>
            <div>
              <label className={label} htmlFor="contactName">
                Contact person
              </label>
              <input id="contactName" name="contactName" maxLength={200} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="phone">
                Phone
              </label>
              <input id="phone" name="phone" maxLength={40} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="vatNumber">
                BTW number
              </label>
              <input id="vatNumber" name="vatNumber" maxLength={40} className={field} placeholder="NL000000000B00" />
            </div>
            <div>
              <label className={label} htmlFor="city">
                City
              </label>
              <input id="city" name="city" maxLength={100} className={field} />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            An existing client with this email is reused rather than duplicated.
          </p>
        </section>

        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold">Quote</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div>
              <label className={label} htmlFor="title">
                Title *
              </label>
              <input id="title" name="title" required maxLength={200} className={field} placeholder="Webshop + hosting" />
            </div>
            <div>
              <label className={label} htmlFor="validUntil">
                Valid until
              </label>
              <input id="validUntil" name="validUntil" type="date" className={field} />
            </div>
          </div>
          <div className="mt-4">
            <label className={label} htmlFor="notes">
              Notes for the client
            </label>
            <textarea id="notes" name="notes" rows={3} maxLength={5000} className={`${field} resize-none`} />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold">Lines</h2>
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-2 sm:grid-cols-[1fr_70px_120px_100px_36px] sm:items-end"
              >
                <div>
                  {index === 0 && <label className={label}>Description</label>}
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(index, { description: e.target.value })}
                    maxLength={500}
                    className={field}
                    placeholder="What is being delivered"
                  />
                </div>
                <div>
                  {index === 0 && <label className={label}>Qty</label>}
                  <input
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    inputMode="numeric"
                    className={field}
                  />
                </div>
                <div>
                  {index === 0 && <label className={label}>Unit price</label>}
                  <input
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                    inputMode="decimal"
                    className={field}
                    placeholder="899,00"
                  />
                </div>
                <div>
                  {index === 0 && <label className={label}>BTW</label>}
                  <select
                    value={line.vatRateBps}
                    onChange={(e) =>
                      updateLine(index, { vatRateBps: Number(e.target.value) })
                    }
                    className={field}
                  >
                    {VAT_OPTIONS.map((bps) => (
                      <option key={bps} value={bps}>
                        {formatVatRate(bps)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) => current.filter((_, i) => i !== index))
                  }
                  className="h-[38px] rounded-lg border border-line text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLines((current) => [...current, { ...BLANK_LINE }])}
            className="mt-4 rounded-lg border border-line px-3.5 py-2 text-sm font-medium transition-colors hover:bg-subtle"
          >
            Add line
          </button>

          <div className="ml-auto mt-6 max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="tabular-nums">{formatMoney(totals.subtotalCents)}</span>
            </div>
            {totals.vatByRate.map((rate) => (
              <div key={rate.rateBps} className="flex justify-between">
                <span className="text-muted">BTW {formatVatRate(rate.rateBps)}</span>
                <span className="tabular-nums">{formatMoney(rate.vatCents)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totals.totalCents)}</span>
            </div>
          </div>
        </section>

        {error && (
          <p className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-55"
          >
            {pending ? "Saving..." : "Save as draft"}
          </button>
          <p className="text-xs text-muted">
            Nothing is emailed yet — you send it from the list once it looks right.
          </p>
        </div>
      </form>
    </div>
  );
}
