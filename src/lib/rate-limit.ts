/**
 * Fixed-window rate limiter, in process memory.
 *
 * LIMITATION, stated plainly: this counts per Node process. It is real
 * protection for a single server (which is what this app is today), but it
 * does NOT hold across multiple instances or serverless functions. If you
 * deploy to Vercel or scale past one container, move this to Redis
 * (@upstash/ratelimit is a drop-in) — the call sites below won't change.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Drop expired buckets occasionally so the map can't grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Best-effort client identity.
 *
 * SECURITY NOTE: x-forwarded-for is trivially spoofable unless a trusted proxy
 * sets it. Behind Vercel/Cloudflare/nginx the left-most entry is the real
 * client and this is sound; exposed directly to the internet it is not. Set
 * TRUSTED_PROXY=false if this server is directly reachable.
 */
export function clientKey(request: Request, scope: string): string {
  const trustProxy = process.env.TRUSTED_PROXY !== "false";
  let ip = "unknown";

  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) ip = forwarded.split(",")[0]!.trim();
    else ip = request.headers.get("x-real-ip")?.trim() ?? "unknown";
  }

  return `${scope}:${ip}`;
}

export function tooManyRequests(retryAfter: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "Cache-Control": "no-store",
    },
  });
}
