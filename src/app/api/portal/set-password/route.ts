import { NextResponse } from "next/server";
import { checkInviteToken, setPasswordWithToken } from "@/lib/invite";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Checks a link without consuming it, so the page can show a sane message. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const check = await checkInviteToken(token);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  return NextResponse.json({ email: check.email, name: check.name });
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "set-password"), 10, 15 * 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "Te veel pogingen. Probeer het later opnieuw.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const { token, password } = body as { token?: unknown; password?: unknown };
  if (typeof token !== "string" || typeof password !== "string" || password.length > 200) {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const result = await setPasswordWithToken(token, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
