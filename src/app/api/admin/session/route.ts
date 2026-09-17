import { NextResponse } from "next/server";
import { getSessionUser, isStaff, signIn, signOut } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? null;
}

/** Sign in with a real account. 5 attempts per IP per 15 minutes. */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "admin-login"), 5, 15 * 60_000);
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfter,
      "Te veel inlogpogingen. Probeer het later opnieuw.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const { email, password } = body as { email?: unknown; password?: unknown };
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 200 ||
    password.length > 200
  ) {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const tenantId = await getTenantId();
  const result = await signIn(tenantId, email, password, {
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // A signed-in customer is not an admin. Drop the session again rather than
  // leaving them holding one that this page will keep refusing.
  if (!isStaff(result.user)) {
    await signOut();
    return NextResponse.json(
      { error: "Dit account heeft geen beheerderstoegang." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: { name: result.user.name, email: result.user.email, role: result.user.role },
  });
}

export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}

/** Lets the page restore its signed-in state on reload. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !isStaff(user)) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    user: { name: user.name, email: user.email, role: user.role },
  });
}
