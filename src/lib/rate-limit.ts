/**
 * In-memory sliding-window rate limiter for LLM and compute-intensive endpoints.
 * Protects against quota exhaustion and abusive polling.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Clean up expired keys every 2 minutes
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 120_000);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 120_000);
  timer.unref?.();
}

export interface RateLimitOptions {
  /** Maximum requests permitted in the window (default: 30) */
  limit?: number;
  /** Sliding window duration in milliseconds (default: 60,000 = 1 minute) */
  windowMs?: number;
  /** Unique key to track (defaults to client IP address) */
  key?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "127.0.0.1"
  );
}

export function checkRateLimit(request: Request, options: RateLimitOptions = {}): RateLimitResult {
  const limit = options.limit ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const key = options.key ?? getClientIp(request);

  const now = Date.now();
  const windowStart = now - windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  record.timestamps = record.timestamps.filter((t) => t > windowStart);
  const reset = Math.ceil((now + windowMs) / 1000);

  if (record.timestamps.length >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset,
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - record.timestamps.length),
    reset,
  };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.max(1, result.reset - Math.ceil(Date.now() / 1000));
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded. Please wait a moment before sending more requests.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}
