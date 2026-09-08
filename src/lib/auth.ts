import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, needsRehash } from "@/lib/password";
import type { UserRole } from "@/generated/prisma/client";

/**
 * Database-backed sessions.
 *
 * The cookie holds a random token; the database stores only its SHA-256. A
 * stolen database dump therefore yields no usable sessions, and sign-out /
 * "revoke everywhere" genuinely invalidate access rather than waiting for a
 * JWT to expire.
 */
const COOKIE = "illuvex_session";
const SESSION_DAYS = 7;
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** IPs are hashed before storage — an audit trail shouldn't be a PII archive. */
function hashIp(ip: string | null) {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? "";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export type SessionUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  clientId: string | null;
};

export type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

/**
 * Verifies credentials and opens a session.
 *
 * Always returns the same message for "no such user" and "wrong password", so
 * the endpoint cannot be used to discover which addresses are registered.
 */
export async function signIn(
  tenantId: string,
  email: string,
  password: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<SignInResult> {
  const generic = "Email or password is incorrect.";
  const normalised = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: normalised } },
  });

  if (!user) {
    // Spend comparable time to a real verification so timing doesn't leak
    // whether the account exists.
    await hashPassword(password);
    return { ok: false, error: generic };
  }

  if (user.disabledAt) {
    return { ok: false, error: "This account has been disabled." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60_000,
    );
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failed = user.failedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: failed,
        lockedUntil:
          failed >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
      },
    });
    return { ok: false, error: generic };
  }

  // Transparently upgrade hashes if the cost parameters have since increased.
  const data: Record<string, unknown> = {
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
  };
  if (needsRehash(user.passwordHash)) {
    data.passwordHash = await hashPassword(password);
  }
  await prisma.user.update({ where: { id: user.id }, data });

  await createSession(user.id, meta);

  return {
    ok: true,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      clientId: user.clientId,
    },
  };
}

export async function createSession(
  userId: string,
  meta: { ip: string | null; userAgent: string | null },
) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      ipHash: hashIp(meta.ip),
    },
  });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax", // 'lax' so links from confirmation emails still work.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolves the signed-in user, or null. Safe to call in any server context. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) return null;
  if (session.user.disabledAt) return null;

  return {
    id: session.user.id,
    tenantId: session.user.tenantId,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    clientId: session.user.clientId,
  };
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    // deleteMany, not delete: an unknown token must not throw.
    await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.delete(COOKIE);
}

/** Invalidates every session for a user — use after a password change. */
export async function signOutEverywhere(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Housekeeping: drop expired rows. Call from a cron or on sign-in. */
export async function pruneExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}

export function isStaff(user: SessionUser | null): boolean {
  return user?.role === "ADMIN" || user?.role === "STAFF";
}

/** Guard for staff-only server code. */
export async function requireStaff(): Promise<
  { ok: true; user: SessionUser } | { ok: false; status: number; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401, error: "Not signed in." };
  if (!isStaff(user)) {
    return { ok: false, status: 403, error: "You don't have access to this." };
  }
  return { ok: true, user };
}

/**
 * Guard for the customer portal.
 *
 * Requires a CUSTOMER account that is actually linked to a client record —
 * without `clientId` there is nothing to scope their data to, and an
 * unscoped query is exactly the bug that leaks one customer's tickets to
 * another. Staff are refused here rather than silently granted access, so
 * portal handlers never have to reason about two kinds of caller.
 */
export async function requireCustomer(): Promise<
  | { ok: true; user: SessionUser & { clientId: string } }
  | { ok: false; status: number; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401, error: "Not signed in." };
  if (user.role !== "CUSTOMER") {
    return { ok: false, status: 403, error: "This area is for clients." };
  }
  if (!user.clientId) {
    return {
      ok: false,
      status: 403,
      error: "This account is not linked to a client record yet.",
    };
  }
  return { ok: true, user: { ...user, clientId: user.clientId } };
}
