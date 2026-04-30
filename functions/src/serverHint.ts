/**
 * Pure server-side hint helpers used by the `getHint` callable. Lives in its
 * own file (no firebase-functions dependency) so it can be unit-tested without
 * spinning up the v2 functions runtime.
 */

export interface ServerHint {
  index: number;
  message: string;
}

export interface BoardEntry {
  index: number;
  iconName: string;
}

const MAX_HINT_MESSAGE_LENGTH = 200;
const DEFAULT_HINT_MESSAGE = "Give this one a try!";

/**
 * Tighten the model's free-form output into a guaranteed-legal hint:
 * - index must be an integer inside the board
 * - the card must still be playable (present in `boardSnapshot`)
 * - the card must not already be in the flipped set this turn
 * - the message is trimmed and clamped, with a default if empty
 *
 * Returning null means "no legal hint" — the caller should fall through to the
 * next model or the deterministic fallback.
 */
export function validateServerHint(
  raw: unknown,
  boardSnapshot: BoardEntry[],
  flippedIndices: number[],
  cardCount: number
): ServerHint | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const index = Number(obj.index);
  if (!Number.isInteger(index) || index < 0 || index >= cardCount) return null;

  const playable = new Set(boardSnapshot.map((c) => c.index));
  if (!playable.has(index)) return null;
  if (flippedIndices.includes(index)) return null;

  const rawMessage = typeof obj.message === "string" ? obj.message.trim() : "";
  return {
    index,
    message: rawMessage
      ? rawMessage.slice(0, MAX_HINT_MESSAGE_LENGTH)
      : DEFAULT_HINT_MESSAGE,
  };
}

/**
 * Errors that warrant trying the next model in the fallback chain rather than
 * giving up. Covers timeouts, network blips, 5xx, 429 (rate limit on a single
 * model — try a different one), and 404 (a model name that's been retired).
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") return true;
    if (error instanceof TypeError) return true;
  }
  if (typeof error === "object" && error !== null) {
    const msg = (error as { message?: string }).message ?? "";
    const status = (error as { status?: number }).status;
    if (status === 500 || status === 503 || status === 504) return true;
    if (status === 429 || status === 404) return true;
    return /overloaded|quota|rate.?limit|unavailable|not.found|timeout|network/i.test(msg);
  }
  return false;
}

export const _internal = {
  MAX_HINT_MESSAGE_LENGTH,
  DEFAULT_HINT_MESSAGE,
};
