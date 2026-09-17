import type { InvoiceLineInput } from "@/lib/invoices";

/**
 * Validation for invoice lines. Mirrors the quote rules deliberately — the two
 * documents share a shape, and money validation that differs between them is
 * how a price gets through one path and not the other.
 */
const MAX_LINES = 200;
const MAX_QUANTITY = 100_000;
const MAX_UNIT_PRICE_CENTS = 1_000_000_000;
const ALLOWED_VAT_BPS = [0, 2100];

export type ParsedLines =
  | { ok: true; lines: InvoiceLineInput[] }
  | { ok: false; error: string };

export function parseInvoiceLines(raw: unknown): ParsedLines {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Een factuur heeft minstens één regel nodig." };
  }
  if (raw.length > MAX_LINES) {
    return { ok: false, error: `Een factuur kan maximaal ${MAX_LINES} regels hebben.` };
  }

  const lines: InvoiceLineInput[] = [];
  for (const [index, item] of raw.entries()) {
    const line = item as Record<string, unknown>;
    const position = index + 1;

    const description =
      typeof line.description === "string" ? line.description.trim() : "";
    if (!description || description.length > 500) {
      return { ok: false, error: `Regel ${position} heeft een omschrijving nodig.` };
    }

    const quantity = line.quantity;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return {
        ok: false,
        error: `Regel ${position}: aantal moet een geheel getal van minstens 1 zijn.`,
      };
    }

    const unitPriceCents = line.unitPriceCents;
    if (
      typeof unitPriceCents !== "number" ||
      !Number.isInteger(unitPriceCents) ||
      unitPriceCents < 0 ||
      unitPriceCents > MAX_UNIT_PRICE_CENTS
    ) {
      return {
        ok: false,
        error: `Regel ${position}: prijs moet een geheel aantal centen zijn.`,
      };
    }

    const vatRateBps = line.vatRateBps ?? 2100;
    if (typeof vatRateBps !== "number" || !ALLOWED_VAT_BPS.includes(vatRateBps)) {
      return {
        ok: false,
        error: `Regel ${position}: BTW-tarief moet een van ${ALLOWED_VAT_BPS.map((b) => `${b / 100}%`).join(", ")} zijn.`,
      };
    }

    lines.push({ description, quantity, unitPriceCents, vatRateBps });
  }

  return { ok: true, lines };
}
