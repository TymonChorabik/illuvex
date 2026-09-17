import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { sendQuote } from "@/lib/quotes";
import { sendQuoteEmail } from "@/lib/quote-email";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/quotes/[id]/send">,
) {
  const auth = await requireStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const result = await sendQuote(await getTenantId(), id);
  if (!result.ok) {
    const status = result.error.includes("niet gevonden") ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  // The link is built from the request origin so it works on localhost and in
  // production without another environment variable to forget.
  const origin = process.env.PUBLIC_URL ?? new URL(request.url).origin;
  const link = `${origin}/quote/${result.token}`;

  const email = await sendQuoteEmail(result.quote, link);

  return NextResponse.json({
    quote: result.quote,
    emailSent: email.sent,
    emailError: email.reason,
    // Returned so staff can copy the link when email is not configured yet.
    link,
  });
}
