import crypto from "node:crypto";
import { promisify } from "node:util";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export { MIN_PASSWORD_LENGTH };

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

/**
 * Password hashing with scrypt.
 *
 * scrypt is OWASP-approved, memory-hard, and built into Node — no native
 * module to compile and nothing to keep patched, which matters on Windows.
 * Parameters follow the OWASP cheat sheet (N=2^16, r=8, p=1 ≈ 64 MB per hash).
 *
 * Stored format: scrypt$N$r$p$<salt-b64>$<hash-b64>
 * The parameters travel with the hash, so they can be raised later without
 * invalidating existing passwords.
 */
const N = 65536;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;
// scrypt needs maxmem above 128*N*r or it throws.
const MAXMEM = 128 * N * R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64");
    expected = Buffer.from(parts[5]!, "base64");
  } catch {
    return false;
  }

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 128 * n * r * 2,
    });
  } catch {
    return false;
  }

  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/** True when a stored hash used weaker parameters and should be re-hashed. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < N || Number(parts[2]) < R;
}

export type PasswordProblem = string | null;

/** Server-side password policy. Length beats composition rules (NIST 800-63B). */
export function checkPasswordStrength(password: string): PasswordProblem {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Wachtwoord moet minstens ${MIN_PASSWORD_LENGTH} tekens lang zijn.`;
  }
  if (password.length > 200) {
    return "Wachtwoord moet korter zijn dan 200 tekens.";
  }
  const lowered = password.toLowerCase();
  const banned = ["password", "illudesk", "12345678", "qwerty", "letmein"];
  if (banned.some((word) => lowered.includes(word))) {
    return "Dat wachtwoord is te makkelijk te raden. Kies iets minder voorspelbaars.";
  }
  return null;
}
