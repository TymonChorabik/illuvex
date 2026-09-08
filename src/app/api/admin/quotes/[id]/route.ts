import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { getQuote, updateQuote } from "@/lib/quotes";
import { parseQuoteBody } from "@/lib/quote-input";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/quotes/[id]">,
) {
  const auth = await requireStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const quote = await getQuote(await getTenantId(), id);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }
  return NextResponse.json({ quote });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/quotes/[id]">,
) {
  const auth = await requireStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseQuoteBody(body, { requireClient: false });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await updateQuote(await getTenantId(), id, {
    title: parsed.title,
    notes: parsed.notes,
    validUntil: parsed.validUntil,
    lines: parsed.lines,
  });

  if (!result.ok) {
    // "Not found" is a 404; "already sent" is a conflict, not a bad request.
    const status = result.error.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ quote: result.quote });
}
