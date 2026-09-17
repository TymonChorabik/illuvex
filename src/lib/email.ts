import { Resend } from "resend";
import type { Order } from "./db";
import { SITE, formatPrice } from "./site";
import { getOffer } from "./offers";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function customerEmail(order: Order) {
  // offerId is null when the package was retired after the order was placed.
  const offer = order.offerId ? getOffer(order.offerId) : undefined;
  const price = formatPrice(order.price, order.priceUnit);
  const includes = (offer?.includes ?? [])
    .map((item) => `<li style="margin:0 0 6px">${escapeHtml(item)}</li>`)
    .join("");

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f4;padding:32px 16px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:14px;overflow:hidden">
      <div style="background:#1c1917;color:#ffffff;padding:24px 28px">
        <div style="font-size:19px;font-weight:700;letter-spacing:-0.02em">${escapeHtml(SITE.name)}</div>
        <div style="font-size:13px;color:#a8a29e;margin-top:2px">${escapeHtml(SITE.tagline)}</div>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 8px;font-size:20px;color:#1c1917">Bedankt, ${escapeHtml(order.name)} — we hebben je aanvraag ontvangen.</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#57534e">
          Dit is je bevestiging dat we je aanvraag voor het pakket
          <strong>${escapeHtml(order.offerName)}</strong> hebben ontvangen. We reageren binnen één
          werkdag met de vervolgstappen en een startdatum.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:22px">
          <tr>
            <td style="padding:9px 0;color:#78716c;border-bottom:1px solid #f5f5f4">Referentie</td>
            <td style="padding:9px 0;text-align:right;font-weight:600;color:#1c1917;border-bottom:1px solid #f5f5f4">${escapeHtml(order.reference)}</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#78716c;border-bottom:1px solid #f5f5f4">Pakket</td>
            <td style="padding:9px 0;text-align:right;font-weight:600;color:#1c1917;border-bottom:1px solid #f5f5f4">${escapeHtml(order.offerName)}</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#78716c;border-bottom:1px solid #f5f5f4">Prijs</td>
            <td style="padding:9px 0;text-align:right;font-weight:600;color:#1c1917;border-bottom:1px solid #f5f5f4">${escapeHtml(price)}</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#78716c">Gebruikelijke doorlooptijd</td>
            <td style="padding:9px 0;text-align:right;font-weight:600;color:#1c1917">${escapeHtml(offer?.timelineLabel ?? "We bevestigen dit nog")}</td>
          </tr>
        </table>

        ${
          includes
            ? `<div style="background:#fafaf9;border:1px solid #f5f5f4;border-radius:10px;padding:16px 18px;margin-bottom:22px">
                 <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#78716c;margin-bottom:10px">Inbegrepen</div>
                 <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#44403c">${includes}</ul>
               </div>`
            : ""
        }

        ${
          order.notes
            ? `<div style="margin-bottom:22px">
                 <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#78716c;margin-bottom:6px">Jouw notities</div>
                 <p style="margin:0;font-size:14px;line-height:1.6;color:#44403c;white-space:pre-wrap">${escapeHtml(order.notes)}</p>
               </div>`
            : ""
        }

        <p style="margin:0;font-size:13px;line-height:1.6;color:#78716c">
          Er wordt nog niets in rekening gebracht — dit is een aanvraag, geen factuur.
          Antwoord op deze e-mail als er iets moet worden aangepast.
        </p>
      </div>
    </div>
  </div>`;

  const text = [
    `Bedankt, ${order.name} — we hebben je aanvraag ontvangen.`,
    ``,
    `Referentie: ${order.reference}`,
    `Pakket:     ${order.offerName}`,
    `Prijs:      ${price}`,
    `Doorlooptijd: ${offer?.timelineLabel ?? "we bevestigen dit nog"}`,
    ``,
    order.notes ? `Jouw notities: ${order.notes}\n` : ``,
    `We reageren binnen één werkdag. Er wordt nog niets in rekening gebracht.`,
    ``,
    `— ${SITE.name}`,
  ].join("\n");

  return { html, text };
}

function ownerEmail(order: Order) {
  const price = formatPrice(order.price, order.priceUnit);
  const rows: [string, string][] = [
    ["Referentie", order.reference],
    ["Pakket", order.offerName],
    ["Prijs", price],
    ["Naam", order.name],
    ["E-mail", order.email],
    ["Bedrijf", order.company || "—"],
    ["Telefoon", order.phone || "—"],
    ["Notities", order.notes || "—"],
  ];

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px">
    <h2 style="margin:0 0 4px;font-size:18px">Nieuwe aanvraag: ${escapeHtml(order.offerName)}</h2>
    <p style="margin:0 0 18px;color:#78716c;font-size:13px">${escapeHtml(new Date(order.createdAt).toLocaleString())}</p>
    <table style="border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([label, value]) =>
            `<tr>
               <td style="padding:6px 18px 6px 0;color:#78716c;vertical-align:top">${escapeHtml(label)}</td>
               <td style="padding:6px 0;color:#1c1917;white-space:pre-wrap">${escapeHtml(value)}</td>
             </tr>`,
        )
        .join("")}
    </table>
  </div>`;

  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  return { html, text };
}

export type EmailResult = { sent: boolean; reason?: string };

/**
 * Sends the customer confirmation plus an internal notification.
 * Never throws — a mail failure must not lose the order.
 */
export async function sendOrderEmails(order: Order): Promise<EmailResult> {
  const customer = customerEmail(order);
  const owner = ownerEmail(order);

  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY is niet ingesteld — bevestiging voor ${order.reference} is niet verstuurd.`,
    );
    console.info(`[email] Zou zijn verstuurd naar ${order.email}:\n${customer.text}`);
    return { sent: false, reason: "RESEND_API_KEY is not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: SITE.fromEmail,
      to: order.email,
      replyTo: SITE.businessEmail,
      subject: `${SITE.name}: we hebben je aanvraag voor ${order.offerName} ontvangen (${order.reference})`,
      html: customer.html,
      text: customer.text,
    });

    if (error) {
      console.error("[email] customer confirmation failed:", error);
      return { sent: false, reason: error.message };
    }

    // Internal copy is best-effort; the customer's confirmation is what matters.
    const notification = await resend.emails.send({
      from: SITE.fromEmail,
      to: SITE.businessEmail,
      replyTo: order.email,
      subject: `Nieuwe aanvraag ${order.offerName} — ${order.name} (${order.reference})`,
      html: owner.html,
      text: owner.text,
    });
    if (notification.error) {
      console.error("[email] internal notification failed:", notification.error);
    }

    return { sent: true };
  } catch (error) {
    console.error("[email] unexpected failure:", error);
    return { sent: false, reason: (error as Error).message };
  }
}
