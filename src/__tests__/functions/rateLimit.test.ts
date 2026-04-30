import { describe, expect, it, beforeEach } from "vitest";
import { allowRequest, resetLimiter } from "../../../functions/src/rateLimit";

describe("allowRequest", () => {
  beforeEach(() => {
    resetLimiter();
  });

  // ─── basic windowing ────────────────────────────────────────────────────────

  it("allows requests under the configured limit", () => {
    const key = "user-1";
    expect(allowRequest(key, 3, 60_000, 1000)).toBe(true);
    expect(allowRequest(key, 3, 60_000, 2000)).toBe(true);
    expect(allowRequest(key, 3, 60_000, 3000)).toBe(true);
  });

  it("blocks requests at and over the limit", () => {
    const key = "user-2";
    expect(allowRequest(key, 2, 60_000, 1000)).toBe(true);
    expect(allowRequest(key, 2, 60_000, 2000)).toBe(true);
    expect(allowRequest(key, 2, 60_000, 3000)).toBe(false);
  });

  it("expires old entries after the window", () => {
    const key = "user-3";
    expect(allowRequest(key, 2, 1000, 1000)).toBe(true);
    expect(allowRequest(key, 2, 1000, 1500)).toBe(true);
    // Oldest request has expired, so this one should pass.
    expect(allowRequest(key, 2, 1000, 2501)).toBe(true);
  });

  // ─── isolation between keys ─────────────────────────────────────────────────

  it("tracks each key independently", () => {
    expect(allowRequest("alice", 1, 60_000, 1000)).toBe(true);
    expect(allowRequest("alice", 1, 60_000, 2000)).toBe(false);
    // Bob is unaffected by Alice burning her quota.
    expect(allowRequest("bob", 1, 60_000, 2000)).toBe(true);
  });

  // ─── boundaries ─────────────────────────────────────────────────────────────

  it("treats a timestamp exactly at the cutoff as expired", () => {
    // The filter is `ts > cutoff`, so a request at ts == cutoff falls out.
    const key = "user-boundary";
    expect(allowRequest(key, 1, 1000, 1000)).toBe(true);
    // nowMs - windowMs = 2000, so the request at 1000 is exactly at cutoff and drops.
    expect(allowRequest(key, 1, 1000, 2000)).toBe(true);
  });

  it("returns false immediately when limit is 0 (no quota)", () => {
    expect(allowRequest("anyone", 0, 60_000, 1000)).toBe(false);
    expect(allowRequest("anyone", 0, 60_000, 2000)).toBe(false);
  });

  it("allows exactly one call when limit is 1", () => {
    expect(allowRequest("solo", 1, 60_000, 1000)).toBe(true);
    expect(allowRequest("solo", 1, 60_000, 1500)).toBe(false);
  });

  // ─── blocked requests don't poison the bucket ───────────────────────────────

  it("does not append blocked attempts to the history", () => {
    const key = "spammer";
    expect(allowRequest(key, 1, 1000, 1000)).toBe(true);
    // Many blocked attempts inside the window — none should extend the bucket.
    expect(allowRequest(key, 1, 1000, 1100)).toBe(false);
    expect(allowRequest(key, 1, 1000, 1200)).toBe(false);
    expect(allowRequest(key, 1, 1000, 1300)).toBe(false);
    // Once the original allowed entry expires, the next call must succeed.
    expect(allowRequest(key, 1, 1000, 2001)).toBe(true);
  });

  // ─── reset ──────────────────────────────────────────────────────────────────

  it("resetLimiter clears state for all keys", () => {
    expect(allowRequest("k1", 1, 60_000, 1000)).toBe(true);
    expect(allowRequest("k2", 1, 60_000, 1000)).toBe(true);
    expect(allowRequest("k1", 1, 60_000, 1500)).toBe(false); // blocked
    resetLimiter();
    expect(allowRequest("k1", 1, 60_000, 1500)).toBe(true);
    expect(allowRequest("k2", 1, 60_000, 1500)).toBe(true);
  });

  // ─── sliding window ─────────────────────────────────────────────────────────

  it("slides the window so a steady-rate caller stays within quota", () => {
    const key = "steady";
    // 3 calls at the start — fills the bucket exactly.
    expect(allowRequest(key, 3, 1000, 100)).toBe(true);
    expect(allowRequest(key, 3, 1000, 200)).toBe(true);
    expect(allowRequest(key, 3, 1000, 300)).toBe(true);
    // 4th inside the same window is blocked.
    expect(allowRequest(key, 3, 1000, 400)).toBe(false);
    // After the first call expires, a new request must be admitted.
    expect(allowRequest(key, 3, 1000, 1101)).toBe(true);
  });

  it("uses Date.now() as the default time source", () => {
    // Two calls with no explicit timestamp should land in the same window
    // (Date.now() is monotonic enough on the same tick) and the second should
    // be blocked when limit=1.
    expect(allowRequest("default-now", 1, 60_000)).toBe(true);
    expect(allowRequest("default-now", 1, 60_000)).toBe(false);
  });
});
