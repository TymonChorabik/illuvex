import type { InvoiceLineInput } from "@/lib/invoices";

/**
 * Validation for invoice lines. Mirrors the quote rules deliberately — the two
 * documents share a shape, and money validation that differs between them is
 * how a price gets through one path and not the other.
 */
const MAX_LINES = 200;
const MAX_QUANTITY = 100_000;
const MAX_UNIT_PRICE_CENTS = 1_000_000_000;
const ALLOWED_VAT_BPS = [0, 900, 2100];

export type ParsedLines =
  | { ok: true; lines: InvoiceLineInput[] }
  | { ok: false; error: string };

export function parseInvoiceLines(raw: unknown): ParsedLines {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "An invoice needs at least one line." };
  }
  if (raw.length > MAX_LINES) {
    return { ok: false, error: `An invoice can have at most ${MAX_LINES} lines.` };
  }

  const lines: InvoiceLineInput[] = [];
  for (const [index, item] of raw.entries()) {
    const line = item as Record<string, unknown>;
    const position = index + 1;

    const description =
      typeof line.description === "string" ? line.description.trim() : "";
    if (!description || description.length > 500) {
      return { ok: false, error: `Line ${position} needs a description.` };
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
        error: `Line ${position}: quantity must be a whole number of at least 1.`,
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
        error: `Line ${position}: price must be a whole number of cents.`,
      };
    }

    const vatRateBps = line.vatRateBps ?? 2100;
    if (typeof vatRateBps !== "number" || !ALLOWED_VAT_BPS.includes(vatRateBps)) {
      return {
        ok: false,
        error: `Line ${position}: VAT rate must be one of ${ALLOWED_VAT_BPS.map((b) => `${b / 100}%`).join(", ")}.`,
      };
    }

    lines.push({ description, quantity, unitPriceCents, vatRateBps });
  }

  return { ok: true, lines };
}
