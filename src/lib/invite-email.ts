import { Resend } from "resend";
import { SITE } from "@/lib/site";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailResult = { sent: boolean; reason?: string };

/**
 * Sends the portal invitation. The link lets the recipient choose their own
 * password — we never email a password, because an emailed password sits in
 * an inbox indefinitely.
 */
export async function sendInviteEmail(
  to: string,
  link: string,
): Promise<EmailResult> {
  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f4;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:14px;overflow:hidden">
      <div style="background:#1c1917;color:#fff;padding:24px 28px">
        <div style="font-size:19px;font-weight:700;letter-spacing:-0.02em">${escapeHtml(SITE.name)}</div>
        <div style="font-size:13px;color:#a8a29e;margin-top:2px">Client portal</div>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 8px;font-size:20px;color:#1c1917">Set up your account</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#57534e">
          We have set up portal access for you. From there you can see your
          quotes and projects, and raise a support ticket whenever something
          needs attention.
        </p>
        <a href="${escapeHtml(link)}"
           style="display:inline-block;background:#d94f0b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600">
          Choose your password
        </a>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#78716c">
          This link works once and expires in 14 days. If you did not expect
          it, you can ignore this email — nothing has been created that you
          can be charged for.
        </p>
      </div>
    </div>
  </div>`;

  const text = [
    `${SITE.name} — client portal`,
    ``,
    `We have set up portal access for you. Choose your password here:`,
    link,
    ``,
    `This link works once and expires in 14 days.`,
  ].join("\n");

  if (!resend) {
    console.warn(`[invite-email] RESEND_API_KEY not set — invite for ${to} was not emailed.`);
    console.info(`[invite-email] link: ${link}`);
    return { sent: false, reason: "RESEND_API_KEY is not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: SITE.fromEmail,
      to,
      replyTo: SITE.businessEmail,
      subject: `${SITE.name}: set up your client portal account`,
      html,
      text,
    });
    if (error) {
      console.error("[invite-email] send failed:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[invite-email] unexpected failure:", error);
    return { sent: false, reason: (error as Error).message };
  }
}
