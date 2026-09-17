import { NextResponse } from "next/server";
import { getSessionUser, signIn, signOut } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? null;
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "portal-login"), 5, 15 * 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "Te veel inlogpogingen. Probeer het later opnieuw.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const { email, password } = body as { email?: unknown; password?: unknown };
  if (
    typeof email !== "string" || typeof password !== "string" ||
    email.length > 200 || password.length > 200
  ) {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const result = await signIn(await getTenantId(), email, password, {
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // Staff have their own dashboard; don't hand them a portal session here.
  if (result.user.role !== "CUSTOMER") {
    await signOut();
    return NextResponse.json(
      { error: "Medewerkersaccounts loggen in via /admin." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, user: { name: result.user.name, email: result.user.email } });
}

export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    user: { name: user.name, email: user.email },
  });
}
