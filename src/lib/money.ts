/**
 * Money and VAT arithmetic.
 *
 * RULES, because this is where quiet bugs live:
 *  - Amounts are integer minor units (cents). Never a float, never a Number
 *    with a decimal point. 0.1 + 0.2 !== 0.3, and an accountant will find it.
 *  - VAT rates are basis points: 21% is 2100. Avoids 0.21 entirely.
 *  - VAT is rounded per line, then summed. This is the convention Dutch
 *    invoices follow, and it means the printed line VAT amounts add up to the
 *    printed total — rounding once at the end would leave a visible 1-cent
 *    discrepancy on the page.
 *  - Rounding is half-up on positive amounts (Math.round is half-up for
 *    positives; negatives are handled explicitly below because Math.round(-0.5)
 *    is -0, not -1).
 */

export type LineInput = {
  quantity: number;
  unitPriceCents: number;
  vatRateBps: number;
};

export type LineTotals = {
  netCents: number;
  vatCents: number;
  grossCents: number;
};

export type DocumentTotals = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  /** VAT broken down by rate, for the summary block on an invoice. */
  vatByRate: { rateBps: number; netCents: number; vatCents: number }[];
};

/** Half-up rounding that behaves symmetrically around zero. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function lineTotals(line: LineInput): LineTotals {
  assertInteger(line.quantity, "quantity");
  assertInteger(line.unitPriceCents, "unitPriceCents");
  assertInteger(line.vatRateBps, "vatRateBps");

  const netCents = line.quantity * line.unitPriceCents;
  const vatCents = roundHalfUp((netCents * line.vatRateBps) / 10_000);
  return { netCents, vatCents, grossCents: netCents + vatCents };
}

export function documentTotals(lines: LineInput[]): DocumentTotals {
  let subtotalCents = 0;
  let vatCents = 0;
  const byRate = new Map<number, { netCents: number; vatCents: number }>();

  for (const line of lines) {
    const totals = lineTotals(line);
    subtotalCents += totals.netCents;
    vatCents += totals.vatCents;

    const bucket = byRate.get(line.vatRateBps) ?? { netCents: 0, vatCents: 0 };
    bucket.netCents += totals.netCents;
    bucket.vatCents += totals.vatCents;
    byRate.set(line.vatRateBps, bucket);
  }

  return {
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
    vatByRate: [...byRate.entries()]
      .map(([rateBps, v]) => ({ rateBps, ...v }))
      .sort((a, b) => a.rateBps - b.rateBps),
  };
}

function assertInteger(value: number, field: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be an integer, got ${value}`);
  }
}

/** "21%" from 2100. Trims pointless decimals: 2150 -> "21.5%". */
export function formatVatRate(bps: number): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0$/, "")}%`;
}

/**
 * Formats cents for display. Uses the browser/server locale's currency rules,
 * so EUR renders as €1.234,56 in nl-NL and €1,234.56 in en-GB.
 */
export function formatMoney(
  cents: number,
  currency = "EUR",
  locale = "nl-NL",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Parses user input ("1234,56", "1.234,56", "€1234.56") into cents.
 * Returns null when it cannot be read as a number — callers must reject rather
 * than silently treat a typo as zero.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalised: string;

  if (lastComma === -1 && lastDot === -1) {
    normalised = cleaned;
  } else if (lastComma > lastDot) {
    // Comma is the decimal separator: strip dots as thousands separators.
    normalised = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // Dot is the decimal separator: strip commas.
    normalised = cleaned.replace(/,/g, "");
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;
  return roundHalfUp(value * 100);
}
