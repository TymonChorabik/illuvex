import { Resend } from "resend";
import { SITE } from "@/lib/site";
import { formatMoney } from "@/lib/money";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type InvoiceForEmail = {
  number: string;
  currency: string;
  totalCents: number;
  dueAt: Date | null;
  client: { name: string; contactName: string | null; email: string };
};

export type EmailResult = { sent: boolean; reason?: string };

/**
 * Emails the invoice PDF to the client. Unlike a quote, this is not a
 * one-shot action gated by status — an invoice has no decision to make, so
 * re-sending the same PDF is normal ("I lost it, can you resend") and the
 * caller doesn't need to guard against a second call.
 */
export async function sendInvoiceEmail(
  invoice: InvoiceForEmail,
  pdf: Buffer,
): Promise<EmailResult> {
  const currency = invoice.currency;
  const greeting = invoice.client.contactName ?? invoice.client.name;
  const due = invoice.dueAt
    ? invoice.dueAt.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const total = formatMoney(invoice.totalCents, currency);

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f4;padding:32px 16px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:14px;overflow:hidden">
      <div style="background:#0b1440;color:#fff;padding:24px 28px">
        <div style="font-size:19px;font-weight:700;letter-spacing:-0.02em">${escapeHtml(SITE.name)}</div>
        <div style="font-size:13px;color:#a8a29e;margin-top:2px">Factuur ${escapeHtml(invoice.number)}</div>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 8px;font-size:20px;color:#1c1917">Factuur ${escapeHtml(invoice.number)}</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#57534e">
          Hoi ${escapeHtml(greeting)}, hierbij factuur
          <strong>${escapeHtml(invoice.number)}</strong> ter waarde van
          <strong>${escapeHtml(total)}</strong>${due ? `, te betalen vóór ${escapeHtml(due)}` : ""}.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;font-size:14px">
          <tr><td style="padding:6px 0;color:#78716c">Factuur</td>
              <td style="padding:6px 0;text-align:right;color:#1c1917">${escapeHtml(invoice.number)}</td></tr>
          ${
            due
              ? `<tr><td style="padding:6px 0;color:#78716c">Vervaldatum</td>
                     <td style="padding:6px 0;text-align:right;color:#1c1917">${escapeHtml(due)}</td></tr>`
              : ""
          }
          <tr><td style="padding:10px 0 0;font-weight:700;color:#1c1917;border-top:2px solid #0b1440">Totaal</td>
              <td style="padding:10px 0 0;text-align:right;font-weight:700;color:#1c1917;border-top:2px solid #0b1440">${escapeHtml(total)}</td></tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#78716c">
          Volledige details staan in de bijgevoegde PDF. Vragen? Antwoord gewoon op deze e-mail.
        </p>
      </div>
    </div>
  </div>`;

  const text = [
    `${SITE.name} — Factuur ${invoice.number}`,
    ``,
    `Totaal: ${total}`,
    due ? `Vervaldatum: ${due}` : ``,
    ``,
    `Volledige details staan in de bijgevoegde PDF. Vragen? Antwoord gewoon op deze e-mail.`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!resend) {
    console.warn(
      `[invoice-email] RESEND_API_KEY niet ingesteld — factuur ${invoice.number} is niet gemaild.`,
    );
    return { sent: false, reason: "RESEND_API_KEY is not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: SITE.fromEmail,
      to: invoice.client.email,
      replyTo: SITE.businessEmail,
      subject: `${SITE.name}: factuur ${invoice.number} — ${total}`,
      html,
      text,
      attachments: [
        { filename: `${invoice.number}.pdf`, content: pdf },
      ],
    });
    if (error) {
      console.error("[invoice-email] send failed:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[invoice-email] unexpected failure:", error);
    return { sent: false, reason: (error as Error).message };
  }
}
