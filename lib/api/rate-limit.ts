/**
 * In-memory sliding-window rate limiter.
 *
 * State lives in module scope, so on serverless hosts it is per-instance and
 * resets on cold start — it is a speed-bump against scripted abuse of the
 * expensive endpoints (clone/scan/fix/test), not a distributed quota system.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/**
 * Records one hit for `key` and reports whether it is within `limit` hits per
 * `windowMs`. Keys should combine the bucket name with the client IP.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.timestamps[0] + windowMs - now) / 1000),
    );
    buckets.set(key, bucket);
    return { ok: false, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP: first `x-forwarded-for` entry, else "local". */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "local";
}

/** HTTP 429 JSON error with a Retry-After header. */
export function rateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: `Too many requests. Retry in ${result.retryAfterSeconds}s.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}
