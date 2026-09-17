/**
 * Business-wide settings. Change these and the whole app follows.
 *
 * PLACEHOLDERS: every contact detail below is deliberately fake. The
 * `.example` domain is reserved by the IETF and can never be registered, so
 * nothing here can accidentally reach a real inbox or phone. Replace them all
 * before going live.
 */
export const SITE = {
  name: "Illudesk",
  // Short prefix used on order references, e.g. ILD-260822-4F2A.
  referencePrefix: "ILD",
  tagline: "Websites die hun geld waard zijn",
  blurb:
    "Wij ontwerpen en bouwen websites voor kleine bedrijven — snel, mobielvriendelijk en gericht op conversie. Vertel ons wat je nodig hebt en we reageren met een echte offerte.",
  // Shown next to every price.
  currency: "€",

  // --- PLACEHOLDER CONTACT DETAILS — replace before launch -----------------
  /** Where customer enquiries land, and the reply-to on confirmations. */
  businessEmail: "hello@illudesk.example",
  /** Shown in the footer. Set to null to hide it entirely. */
  phone: "+00 0000 000000",
  /** Shown in the footer. Set to null to hide it entirely. Keep in sync with
   *  addressLine1/city/country below — this is just their short form. */
  location: "Plaats, Land",
  /**
   * The "from" address on outgoing mail. Must be a domain verified in Resend.
   * Resend's own "onboarding@resend.dev" works without a domain, but can only
   * deliver to the address that owns your Resend account.
   */
  fromEmail: process.env.FROM_EMAIL ?? "Illudesk <onboarding@resend.dev>",

  // --- PLACEHOLDER LEGAL / INVOICE DETAILS — replace before launch ---------
  // Shown on every quote and invoice document, next to the client's own.
  addressLine1: "Straatnaam 1",
  city: "Plaats",
  country: "Nederland",
  /** Chamber of commerce registration number (KVK in NL). */
  kvkNumber: "00000000",
  /** The business's own VAT/BTW number, distinct from a client's. */
  vatNumber: "NL000000000B00",
  /** IBAN payments are sent to. */
  bankAccount: "NL00 BANK 0000 0000 00",
  bic: "BANKNL00",
  // -------------------------------------------------------------------------
} as const;

/** Namespaces anything we keep in the visitor's browser. */
export const STORAGE_KEY = "illudesk:email";

export function formatPrice(amount: number, unit?: string) {
  // A zero price marks a custom quote request with no catalogue price yet —
  // "€0" would read as free, so say what it actually is instead.
  if (amount === 0) return "Offerte op maat";
  const value = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return unit ? `${value}${unit}` : value;
}
