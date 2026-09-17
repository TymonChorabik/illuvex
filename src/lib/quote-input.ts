import type { ClientInput, QuoteLineInput } from "@/lib/quotes";

/**
 * Validation for quote payloads.
 *
 * Kept in one place so create and update cannot drift apart, and written to
 * reject rather than coerce: a malformed price must not silently become 0.
 */
const MAX_LINES = 100;
const MAX_QUANTITY = 100_000;
// A single line above 10 million euro is far more likely a typo than a sale.
const MAX_UNIT_PRICE_CENTS = 1_000_000_000;
const ALLOWED_VAT_BPS = [0, 2100];

export type ParsedQuote =
  | {
      ok: true;
      client?: ClientInput;
      title?: string;
      notes?: string;
      validUntil?: Date | null;
      lines?: QuoteLineInput[];
    }
  | { ok: false; error: string };

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function optionalStr(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = str(value, max);
  return parsed ?? undefined;
}

export function parseQuoteBody(
  body: unknown,
  opts: { requireClient: boolean },
): ParsedQuote {
  const b = body as Record<string, unknown>;

  // --- client ---
  let client: ClientInput | undefined;
  if (opts.requireClient) {
    const c = b.client as Record<string, unknown> | undefined;
    if (!c || typeof c !== "object") {
      return { ok: false, error: "Klantgegevens zijn verplicht." };
    }
    const name = str(c.name, 200);
    const email = str(c.email, 200);
    if (!name) return { ok: false, error: "Naam van de klant is verplicht." };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Een geldig e-mailadres van de klant is verplicht." };
    }
    client = {
      name,
      email,
      contactName: optionalStr(c.contactName, 200),
      phone: optionalStr(c.phone, 40),
      vatNumber: optionalStr(c.vatNumber, 40),
      addressLine1: optionalStr(c.addressLine1, 200),
      postcode: optionalStr(c.postcode, 20),
      city: optionalStr(c.city, 100),
      country: optionalStr(c.country, 100),
    };
  }

  // --- title ---
  let title: string | undefined;
  if (opts.requireClient || b.title !== undefined) {
    const parsed = str(b.title, 200);
    if (!parsed) return { ok: false, error: "Een titel voor de offerte is verplicht." };
    title = parsed;
  }

  // --- notes / validUntil ---
  const notes = optionalStr(b.notes, 5000);

  let validUntil: Date | null | undefined;
  if (b.validUntil !== undefined) {
    if (b.validUntil === null || b.validUntil === "") {
      validUntil = null;
    } else {
      const date = new Date(String(b.validUntil));
      if (Number.isNaN(date.getTime())) {
        return { ok: false, error: "Geldig-tot is geen geldige datum." };
      }
      validUntil = date;
    }
  }

  // --- lines ---
  let lines: QuoteLineInput[] | undefined;
  if (opts.requireClient || b.lines !== undefined) {
    const raw = b.lines;
    if (!Array.isArray(raw) || raw.length === 0) {
      return { ok: false, error: "Een offerte heeft minstens één regel nodig." };
    }
    if (raw.length > MAX_LINES) {
      return { ok: false, error: `Een offerte kan maximaal ${MAX_LINES} regels hebben.` };
    }

    lines = [];
    for (const [index, item] of raw.entries()) {
      const line = item as Record<string, unknown>;
      const position = index + 1;

      const description = str(line.description, 500);
      if (!description) {
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
      if (
        typeof vatRateBps !== "number" ||
        !ALLOWED_VAT_BPS.includes(vatRateBps)
      ) {
        return {
          ok: false,
          error: `Regel ${position}: BTW-tarief moet een van ${ALLOWED_VAT_BPS.map((b) => `${b / 100}%`).join(", ")} zijn.`,
        };
      }

      lines.push({ description, quantity, unitPriceCents, vatRateBps });
    }
  }

  return { ok: true, client, title, notes, validUntil, lines };
}
