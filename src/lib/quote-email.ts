import { Resend } from "resend";
import { SITE } from "@/lib/site";
import { formatMoney, formatVatRate, lineTotals } from "@/lib/money";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type QuoteForEmail = {
  reference: string;
  title: string;
  notes: string | null;
  currency: string;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  validUntil: Date | null;
  client: { name: string; contactName: string | null; email: string };
  lines: {
    description: string;
    quantity: number;
    unitPriceCents: number;
    vatRateBps: number;
  }[];
};

export type EmailResult = { sent: boolean; reason?: string };

export async function sendQuoteEmail(
  quote: QuoteForEmail,
  link: string,
): Promise<EmailResult> {
  const currency = quote.currency;
  const greeting = quote.client.contactName ?? quote.client.name;

  const rows = quote.lines
    .map((line) => {
      const totals = lineTotals(line);
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;font-size:14px;color:#1c1917">
          ${escapeHtml(line.description)}
          <span style="color:#a8a29e"> · ${line.quantity} × ${escapeHtml(formatMoney(line.unitPriceCents, currency))} · ${escapeHtml(formatVatRate(line.vatRateBps))} BTW</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;font-size:14px;white-space:nowrap;color:#1c1917">
          ${escapeHtml(formatMoney(totals.netCents, currency))}
        </td>
      </tr>`;
    })
    .join("");

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f4;padding:32px 16px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:14px;overflow:hidden">
      <div style="background:#1c1917;color:#fff;padding:24px 28px">
        <div style="font-size:19px;font-weight:700;letter-spacing:-0.02em">${escapeHtml(SITE.name)}</div>
        <div style="font-size:13px;color:#a8a29e;margin-top:2px">Offerte ${escapeHtml(quote.reference)}</div>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 8px;font-size:20px;color:#1c1917">${escapeHtml(quote.title)}</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#57534e">
          Hi ${escapeHtml(greeting)}, here is the quote we discussed. You can
          accept or decline it with the button below — no account needed.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:6px">${rows}</table>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
          <tr><td style="padding:6px 0;color:#78716c">Subtotal</td>
              <td style="padding:6px 0;text-align:right;color:#1c1917">${escapeHtml(formatMoney(quote.subtotalCents, currency))}</td></tr>
          <tr><td style="padding:6px 0;color:#78716c">BTW</td>
              <td style="padding:6px 0;text-align:right;color:#1c1917">${escapeHtml(formatMoney(quote.vatCents, currency))}</td></tr>
          <tr><td style="padding:10px 0 0;font-weight:700;color:#1c1917;border-top:2px solid #1c1917">Total</td>
              <td style="padding:10px 0 0;text-align:right;font-weight:700;color:#1c1917;border-top:2px solid #1c1917">${escapeHtml(formatMoney(quote.totalCents, currency))}</td></tr>
        </table>

        ${
          quote.notes
            ? `<div style="background:#fafaf9;border:1px solid #f5f5f4;border-radius:10px;padding:14px 16px;margin-bottom:24px">
                 <p style="margin:0;font-size:14px;line-height:1.6;color:#44403c;white-space:pre-wrap">${escapeHtml(quote.notes)}</p>
               </div>`
            : ""
        }

        <a href="${escapeHtml(link)}"
           style="display:inline-block;background:#d94f0b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600">
          View and respond
        </a>

        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#78716c">
          ${
            quote.validUntil
              ? `This quote is valid until ${escapeHtml(quote.validUntil.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}. `
              : ""
          }Questions? Just reply to this email.
        </p>
      </div>
    </div>
  </div>`;

  const text = [
    `${SITE.name} — Offerte ${quote.reference}`,
    ``,
    quote.title,
    ``,
    ...quote.lines.map(
      (l) =>
        `  ${l.quantity} x ${l.description} — ${formatMoney(lineTotals(l).netCents, currency)}`,
    ),
    ``,
    `Subtotal: ${formatMoney(quote.subtotalCents, currency)}`,
    `BTW:      ${formatMoney(quote.vatCents, currency)}`,
    `Total:    ${formatMoney(quote.totalCents, currency)}`,
    ``,
    `View and respond: ${link}`,
  ].join("\n");

  if (!resend) {
    console.warn(
      `[quote-email] RESEND_API_KEY not set — quote ${quote.reference} was not emailed.`,
    );
    console.info(`[quote-email] link for ${quote.client.email}: ${link}`);
    return { sent: false, reason: "RESEND_API_KEY is not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: SITE.fromEmail,
      to: quote.client.email,
      replyTo: SITE.businessEmail,
      subject: `${SITE.name}: offerte ${quote.reference} — ${quote.title}`,
      html,
      text,
    });
    if (error) {
      console.error("[quote-email] send failed:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[quote-email] unexpected failure:", error);
    return { sent: false, reason: (error as Error).message };
  }
}
