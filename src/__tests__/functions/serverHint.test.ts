import { describe, expect, it } from "vitest";
import {
  isRetryableError,
  validateServerHint,
} from "../../../functions/src/serverHint";

const playableBoard = [
  { index: 1, iconName: "Heart" },
  { index: 2, iconName: "Star" },
  { index: 3, iconName: "Star" },
];

// ─── validateServerHint ──────────────────────────────────────────────────────

describe("validateServerHint", () => {
  it("accepts a well-formed hint pointing at a playable card", () => {
    expect(
      validateServerHint(
        { index: 2, message: "Try Star!" },
        playableBoard,
        [],
        4
      )
    ).toEqual({ index: 2, message: "Try Star!" });
  });

  it("rejects non-object input", () => {
    expect(validateServerHint(null, playableBoard, [], 4)).toBeNull();
    expect(validateServerHint(undefined, playableBoard, [], 4)).toBeNull();
    expect(validateServerHint("string", playableBoard, [], 4)).toBeNull();
    expect(validateServerHint(42, playableBoard, [], 4)).toBeNull();
  });

  it("rejects index outside the board (negative or >= cardCount)", () => {
    expect(validateServerHint({ index: -1, message: "x" }, playableBoard, [], 4)).toBeNull();
    expect(validateServerHint({ index: 4, message: "x" }, playableBoard, [], 4)).toBeNull();
    expect(validateServerHint({ index: 99, message: "x" }, playableBoard, [], 4)).toBeNull();
  });

  it("rejects non-integer index (fractional or non-numeric)", () => {
    expect(validateServerHint({ index: 1.5, message: "x" }, playableBoard, [], 4)).toBeNull();
    expect(validateServerHint({ index: "two", message: "x" }, playableBoard, [], 4)).toBeNull();
    expect(validateServerHint({ index: NaN, message: "x" }, playableBoard, [], 4)).toBeNull();
  });

  it("rejects an index that is in-range but not in the playable snapshot", () => {
    // index 0 is missing from playableBoard (means: matched, removed by client)
    expect(validateServerHint({ index: 0, message: "go" }, playableBoard, [], 4)).toBeNull();
  });

  it("rejects an index that is currently flipped this turn", () => {
    expect(validateServerHint({ index: 1, message: "go" }, playableBoard, [1], 4)).toBeNull();
  });

  it("substitutes the default message for empty/whitespace input", () => {
    expect(validateServerHint({ index: 1, message: "   " }, playableBoard, [], 4)).toEqual({
      index: 1,
      message: "Give this one a try!",
    });
    expect(validateServerHint({ index: 1 }, playableBoard, [], 4)).toEqual({
      index: 1,
      message: "Give this one a try!",
    });
    expect(validateServerHint({ index: 1, message: 123 }, playableBoard, [], 4)).toEqual({
      index: 1,
      message: "Give this one a try!",
    });
  });

  it("truncates messages longer than 200 chars to exactly 200", () => {
    const long = "x".repeat(500);
    const result = validateServerHint(
      { index: 1, message: long },
      playableBoard,
      [],
      4
    );
    expect(result?.message.length).toBe(200);
  });

  it("coerces a numeric-string index that round-trips to an integer", () => {
    expect(
      validateServerHint({ index: "2", message: "ok" }, playableBoard, [], 4)
    ).toEqual({ index: 2, message: "ok" });
  });

  it("returns null when the playable snapshot is empty (game effectively over)", () => {
    expect(validateServerHint({ index: 1, message: "x" }, [], [], 4)).toBeNull();
  });

  it("trims surrounding whitespace before truncation/length check", () => {
    expect(
      validateServerHint({ index: 1, message: "   hi   " }, playableBoard, [], 4)
    ).toEqual({ index: 1, message: "hi" });
  });
});

// ─── isRetryableError ────────────────────────────────────────────────────────

describe("isRetryableError", () => {
  it("retries on AbortError / TimeoutError instances", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(isRetryableError(abort)).toBe(true);

    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    expect(isRetryableError(timeout)).toBe(true);
  });

  it("retries on network TypeErrors (e.g. fetch failed)", () => {
    expect(isRetryableError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("retries on 5xx HTTP status codes", () => {
    expect(isRetryableError({ status: 500, message: "boom" })).toBe(true);
    expect(isRetryableError({ status: 503, message: "service unavailable" })).toBe(true);
    expect(isRetryableError({ status: 504, message: "gateway timeout" })).toBe(true);
  });

  it("retries on 429 (try the next model) and 404 (model retired)", () => {
    expect(isRetryableError({ status: 429, message: "rate limit" })).toBe(true);
    expect(isRetryableError({ status: 404, message: "not found" })).toBe(true);
  });

  it("retries when message matches transient keyword pattern", () => {
    expect(isRetryableError(new Error("model overloaded"))).toBe(true);
    expect(isRetryableError(new Error("quota exceeded"))).toBe(true);
    expect(isRetryableError(new Error("rate-limit hit"))).toBe(true);
    expect(isRetryableError(new Error("model is unavailable"))).toBe(true);
    expect(isRetryableError(new Error("model not.found"))).toBe(true);
    expect(isRetryableError(new Error("network blip"))).toBe(true);
    expect(isRetryableError(new Error("timeout while generating"))).toBe(true);
  });

  it("does NOT retry on 4xx other than 429/404", () => {
    expect(isRetryableError({ status: 400, message: "bad request" })).toBe(false);
    expect(isRetryableError({ status: 401, message: "unauthorized" })).toBe(false);
    expect(isRetryableError({ status: 403, message: "forbidden" })).toBe(false);
  });

  it("does NOT retry on a plain non-transient error", () => {
    expect(isRetryableError(new Error("invalid argument"))).toBe(false);
    expect(isRetryableError(new Error("schema mismatch"))).toBe(false);
  });

  it("does NOT retry on null / non-error primitives", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError("just a string")).toBe(false);
    expect(isRetryableError(42)).toBe(false);
  });
});
