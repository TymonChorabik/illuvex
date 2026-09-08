/**
 * Business-wide settings. Change these and the whole app follows.
 *
 * PLACEHOLDERS: every contact detail below is deliberately fake. The
 * `.example` domain is reserved by the IETF and can never be registered, so
 * nothing here can accidentally reach a real inbox or phone. Replace them all
 * before going live.
 */
export const SITE = {
  name: "Illuvex",
  // Short prefix used on order references, e.g. ILV-260822-4F2A.
  referencePrefix: "ILV",
  tagline: "Websites that earn their keep",
  blurb:
    "We design and build websites for small businesses — fast, mobile-first, and built to convert. Pick a package below and we'll email you a confirmation straight away.",
  // Shown next to every price. Change to "£", "€", "zł", etc.
  currency: "$",

  // --- PLACEHOLDER CONTACT DETAILS — replace before launch -----------------
  /** Where customer enquiries land, and the reply-to on confirmations. */
  businessEmail: "hello@illuvex.example",
  /** Shown in the footer. Set to null to hide it entirely. */
  phone: "+00 0000 000000",
  /** Shown in the footer. Set to null to hide it entirely. */
  location: "City, Country",
  /**
   * The "from" address on outgoing mail. Must be a domain verified in Resend.
   * Resend's own "onboarding@resend.dev" works without a domain, but can only
   * deliver to the address that owns your Resend account.
   */
  fromEmail: process.env.FROM_EMAIL ?? "Illuvex <onboarding@resend.dev>",
  // -------------------------------------------------------------------------
} as const;

/** Namespaces anything we keep in the visitor's browser. */
export const STORAGE_KEY = "illuvex:email";

export function formatPrice(amount: number, unit?: string) {
  const value = `${SITE.currency}${amount.toLocaleString("en-US")}`;
  return unit ? `${value}${unit}` : value;
}
