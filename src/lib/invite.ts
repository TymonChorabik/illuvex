import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, checkPasswordStrength } from "@/lib/password";
import { signOutEverywhere } from "@/lib/auth";

/**
 * Customer account invitations.
 *
 * Staff invite a client; the client sets their own password from an emailed
 * link. We never generate a password on their behalf and email it — an emailed
 * password lives in an inbox forever.
 */
const INVITE_VALID_DAYS = 14;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * A placeholder hash for an invited account that has not chosen a password.
 * It is a real scrypt hash of random bytes, so it can never be matched — this
 * is deliberately not an empty string, which some comparison could treat
 * as valid.
 */
async function unusablePassword() {
  return hashPassword(crypto.randomBytes(32).toString("base64url"));
}

export type InviteResult =
  | { ok: true; token: string; userId: string; email: string; isNew: boolean }
  | { ok: false; error: string };

export async function inviteClientUser(
  tenantId: string,
  clientId: string,
  name?: string,
): Promise<InviteResult> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: { id: true, email: true, contactName: true, name: true },
  });
  if (!client) return { ok: false, error: "Klant niet gevonden." };

  const email = client.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
    select: { id: true, role: true, clientId: true },
  });

  let userId: string;
  let isNew = false;

  if (existing) {
    // Never silently turn a staff account into a customer one.
    if (existing.role !== "CUSTOMER") {
      return {
        ok: false,
        error: "Dit e-mailadres hoort al bij een medewerkersaccount.",
      };
    }
    if (existing.clientId && existing.clientId !== clientId) {
      return {
        ok: false,
        error: "Dit e-mailadres is al gekoppeld aan een andere klant.",
      };
    }
    userId = existing.id;
    if (!existing.clientId) {
      await prisma.user.update({ where: { id: userId }, data: { clientId } });
    }
  } else {
    const created = await prisma.user.create({
      data: {
        tenantId,
        clientId,
        email,
        name: (name ?? client.contactName ?? client.name).trim(),
        passwordHash: await unusablePassword(),
        role: "CUSTOMER",
      },
      select: { id: true },
    });
    userId = created.id;
    isNew = true;
  }

  const token = crypto.randomBytes(32).toString("base64url");

  // Only one live invite per user: replace any earlier unused one so an old
  // email cannot be used after a re-invite.
  await prisma.verificationToken.deleteMany({
    where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
  });

  await prisma.verificationToken.create({
    data: {
      userId,
      purpose: "PASSWORD_RESET",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return { ok: true, token, userId, email, isNew };
}

export type TokenCheck =
  | { ok: true; userId: string; email: string; name: string }
  | { ok: false; error: string };

export async function checkInviteToken(token: string): Promise<TokenCheck> {
  if (!token || token.length > 200) {
    return { ok: false, error: "Deze link is niet geldig." };
  }

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, disabledAt: true } } },
  });

  if (!record || record.purpose !== "PASSWORD_RESET") {
    return { ok: false, error: "Deze link is niet geldig." };
  }
  if (record.usedAt) {
    return { ok: false, error: "Deze link is al gebruikt." };
  }
  if (record.expiresAt <= new Date()) {
    return { ok: false, error: "Deze link is verlopen. Vraag ons om een nieuwe." };
  }
  if (record.user.disabledAt) {
    return { ok: false, error: "Dit account is uitgeschakeld." };
  }

  return {
    ok: true,
    userId: record.user.id,
    email: record.user.email,
    name: record.user.name,
  };
}

export async function setPasswordWithToken(token: string, password: string) {
  const check = await checkInviteToken(token);
  if (!check.ok) return check;

  const weak = checkPasswordStrength(password);
  if (weak) return { ok: false as const, error: weak };

  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(password);

  // Mark the token used inside the same transaction that sets the password,
  // and only if it is still unused — two submissions cannot both succeed.
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.verificationToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) return { ok: false as const, error: "Deze link is al gebruikt." };

    await tx.user.update({
      where: { id: check.userId },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    return { ok: true as const, userId: check.userId };
  });

  // Setting a password invalidates any session opened before it.
  if (result.ok) await signOutEverywhere(check.userId);
  return result;
}
