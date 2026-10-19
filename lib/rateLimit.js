/**
 * Minimal in-memory fixed-window rate limiter — best-effort abuse protection for
 * the invite endpoints.
 *
 * LIMITATION: state lives in the process memory of a single server instance, so
 * it does NOT coordinate across multiple instances / serverless cold starts.
 * Treat it as a courtesy throttle. Production abuse protection must be enforced
 * at the edge/gateway (and Supabase Auth has its own built-in rate limits). This
 * is documented in docs/auth-implementation-plan.md.
 */

const buckets = new Map();

/**
 * @returns {boolean} true if allowed, false if the limit is exceeded.
 */
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

/** Best-effort client IP from standard proxy headers. */
export function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
