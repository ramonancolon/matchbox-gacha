/**
 * In-memory sliding-window rate limiter for callable abuse protection.
 *
 * Note: this is per-function-instance memory, not a global distributed limiter.
 * It still blocks burst abuse on a warm instance and is a practical baseline.
 */
const buckets = new Map<string, number[]>();

export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number = Date.now()
): boolean {
  const history = buckets.get(key) ?? [];
  const cutoff = nowMs - windowMs;
  const recent = history.filter((ts) => ts > cutoff);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }

  recent.push(nowMs);
  buckets.set(key, recent);
  return true;
}

/** Test hook: clear limiter state between unit tests. */
export function resetLimiter() {
  buckets.clear();
}
