import { NextResponse } from "next/server";
import { decideQuote } from "@/lib/quotes";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * The client's accept/reject endpoint. Authenticated by the emailed token
 * alone — there is no account — so it is rate limited and the token is never
 * echoed back in a response.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/quotes/[token]">,
) {
  const limit = rateLimit(clientKey(request, "quote-decision"), 20, 10 * 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "Too many attempts. Try again shortly.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const decision = (body as { decision?: unknown }).decision;
  if (decision !== "accept" && decision !== "reject") {
    return NextResponse.json({ error: "Unknown decision." }, { status: 400 });
  }

  const { token } = await ctx.params;
  const result = await decideQuote(token, decision);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    status: result.quote.status,
    alreadyDecided: result.alreadyDecided,
  });
}
