import { vi, describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
import type { CardData } from '../../types';

const mockHintFn = vi.hoisted(() => vi.fn());
const mockGetLocalLlmHint = vi.hoisted(() => vi.fn());
const mockIsInstalledWebApp = vi.hoisted(() => vi.fn(() => false));

vi.mock('../../lib/firebase', () => ({}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockHintFn),
  connectFunctionsEmulator: vi.fn(),
}));

vi.mock('../../services/localLlmService', () => ({
  getLocalLlmHint: mockGetLocalLlmHint,
}));

vi.mock('../../lib/installedWebApp', () => ({
  isInstalledWebApp: mockIsInstalledWebApp,
}));

import { getNextMoveHint, resetCloudHintCircuitBreaker, validateHint } from '../../services/geminiService';

const makeCards = (): CardData[] => [
  { id: 'heart-0', iconName: 'Heart', isFlipped: false, isMatched: false },
  { id: 'star-1', iconName: 'Star', isFlipped: false, isMatched: false },
  { id: 'heart-2', iconName: 'Heart', isFlipped: true, isMatched: false },
  { id: 'star-3', iconName: 'Star', isFlipped: false, isMatched: false },
];

describe('getNextMoveHint', () => {
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetCloudHintCircuitBreaker();
    mockIsInstalledWebApp.mockReturnValue(false);
    mockGetLocalLlmHint.mockResolvedValue(null);
    mockHintFn.mockResolvedValue({
      data: { ok: true, index: 1, message: 'Try flipping card at index 1!' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a parsed hint response on a successful cloud call', async () => {
    const result = await getNextMoveHint(makeCards(), [2], 4);

    expect(result).toEqual({ index: 1, message: 'Try flipping card at index 1!' });
    expect(mockHintFn).toHaveBeenCalledTimes(1);
  });

  it('passes the full board state snapshot to the callable', async () => {
    await getNextMoveHint(makeCards(), [2], 4);

    const payload = mockHintFn.mock.calls[0][0] as {
      boardSnapshot: Array<{ index: number; iconName: string }>;
    };
    const icons = payload.boardSnapshot.map((c) => c.iconName).join(' ');
    expect(icons).toContain('Heart');
    expect(icons).toContain('Star');
  });

  it('passes currently flipped indices to the callable', async () => {
    await getNextMoveHint(makeCards(), [2], 4);

    const payload = mockHintFn.mock.calls[0][0] as { flippedIndices: number[] };
    expect(payload.flippedIndices).toEqual([2]);
  });

  it('passes grid size and card count to the callable', async () => {
    await getNextMoveHint(makeCards(), [], 6);

    const payload = mockHintFn.mock.calls[0][0] as {
      gridSize: number;
      cardCount: number;
    };
    expect(payload.gridSize).toBe(6);
    expect(payload.cardCount).toBe(4);
  });

  it('omits matched cards from the board snapshot sent to the callable', async () => {
    const cardsWithMatch: CardData[] = [
      { id: 'a-0', iconName: 'Heart', isFlipped: true, isMatched: true },
      { id: 'a-1', iconName: 'Heart', isFlipped: true, isMatched: true },
      { id: 'b-2', iconName: 'Star', isFlipped: false, isMatched: false },
      { id: 'b-3', iconName: 'Star', isFlipped: false, isMatched: false },
    ];

    mockHintFn.mockResolvedValue({
      data: { ok: true, index: 2, message: 'Keep going!' },
    });

    await getNextMoveHint(cardsWithMatch, [], 2);

    const payload = mockHintFn.mock.calls[0][0] as {
      boardSnapshot: Array<{ index: number; iconName: string }>;
    };
    const json = JSON.stringify(payload.boardSnapshot);
    expect(json).not.toContain('"Heart"');
    expect(json).toContain('"Star"');
    expect(json).toContain('"index":2');
    expect(json).toContain('"index":3');
  });

  it('does not surface a cloud hint that fails client-side validation', async () => {
    const cardsWithMatch: CardData[] = [
      { id: 'a-0', iconName: 'Heart', isFlipped: true, isMatched: true },
      { id: 'a-1', iconName: 'Heart', isFlipped: true, isMatched: true },
      { id: 'b-2', iconName: 'Star', isFlipped: false, isMatched: false },
      { id: 'b-3', iconName: 'Star', isFlipped: false, isMatched: false },
    ];

    mockHintFn.mockResolvedValue({
      data: { ok: true, index: 0, message: 'Invalid (already matched)' },
    });

    const result = await getNextMoveHint(cardsWithMatch, [], 2);

    expect(result?.message).not.toBe('Invalid (already matched)');
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('uses one callable invocation per hint request', async () => {
    await getNextMoveHint(makeCards(), [], 4);

    expect(mockHintFn).toHaveBeenCalledTimes(1);
  });

  it('does not call local Llama after cloud fails in a browser tab', async () => {
    mockHintFn.mockRejectedValue(Object.assign(new Error('unavailable'), { code: 'functions/unavailable' }));

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(mockGetLocalLlmHint).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('uses local Llama first when installed and skips cloud', async () => {
    mockIsInstalledWebApp.mockReturnValue(true);
    mockGetLocalLlmHint.mockResolvedValue({
      index: 3,
      message: 'Local first',
    });

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(mockGetLocalLlmHint).toHaveBeenCalledTimes(1);
    expect(mockHintFn).not.toHaveBeenCalled();
    expect(result).toEqual({ index: 3, message: 'Local first' });
  });

  it('falls back to cloud when installed but local returns null', async () => {
    mockIsInstalledWebApp.mockReturnValue(true);
    mockGetLocalLlmHint.mockResolvedValue(null);
    mockHintFn.mockResolvedValue({
      data: { ok: true, index: 1, message: 'Cloud hint' },
    });

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(mockGetLocalLlmHint).toHaveBeenCalledTimes(1);
    expect(mockHintFn).toHaveBeenCalled();
    expect(result).toEqual({ index: 1, message: 'Cloud hint' });
  });

  it('uses deterministic hint when installed, local null, and cloud returns ok: false', async () => {
    mockIsInstalledWebApp.mockReturnValue(true);
    mockGetLocalLlmHint.mockResolvedValue(null);
    mockHintFn.mockResolvedValue({ data: { ok: false } });

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(mockGetLocalLlmHint).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('does not invoke the local Llama model when cloud succeeds', async () => {
    mockHintFn.mockResolvedValue({
      data: { ok: true, index: 1, message: 'Cloud hint' },
    });

    await getNextMoveHint(makeCards(), [], 4);

    expect(mockGetLocalLlmHint).not.toHaveBeenCalled();
  });

  it('falls back to a deterministic hint when cloud and local both fail', async () => {
    mockHintFn.mockRejectedValue(new Error('Network error'));
    mockGetLocalLlmHint.mockResolvedValue(null);

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('falls back to deterministic when cloud returns ok: false', async () => {
    mockHintFn.mockResolvedValue({ data: { ok: false } });

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('falls back to deterministic when cloud throws', async () => {
    mockHintFn.mockRejectedValue(new Error('internal'));

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('disables cloud hints for the rest of the session on functions/not-found', async () => {
    mockHintFn.mockRejectedValue(Object.assign(new Error('missing'), { code: 'functions/not-found' }));

    await getNextMoveHint(makeCards(), [], 4);
    await getNextMoveHint(makeCards(), [], 4);
    await getNextMoveHint(makeCards(), [], 4);

    expect(mockHintFn).toHaveBeenCalledTimes(1);
  });

  it('disables cloud hints for the rest of the session on functions/failed-precondition', async () => {
    mockHintFn.mockRejectedValue(
      Object.assign(new Error('missing secret'), { code: 'functions/failed-precondition' })
    );

    await getNextMoveHint(makeCards(), [], 4);
    await getNextMoveHint(makeCards(), [], 4);

    expect(mockHintFn).toHaveBeenCalledTimes(1);
  });

  it('keeps trying cloud hints across retries for transient errors', async () => {
    mockHintFn
      .mockRejectedValueOnce(Object.assign(new Error('overload'), { code: 'functions/unavailable' }))
      .mockResolvedValueOnce({ data: { ok: true, index: 0, message: 'Recovered' } });

    // First request: cloud rejects (transient), client falls through to deterministic.
    await getNextMoveHint(makeCards(), [], 4);
    expect(mockHintFn).toHaveBeenCalledTimes(1);

    // Second request: cloud is still attempted because transient errors do not trip the breaker.
    const second = await getNextMoveHint(makeCards(), [], 4);
    expect(second).toEqual({ index: 0, message: 'Recovered' });
    expect(mockHintFn).toHaveBeenCalledTimes(2);
  });

  it('does not trip the circuit breaker on resource-exhausted (rate limit)', async () => {
    mockHintFn
      .mockRejectedValueOnce(
        Object.assign(new Error('too many requests'), { code: 'functions/resource-exhausted' })
      )
      .mockResolvedValueOnce({ data: { ok: true, index: 3, message: 'Try again now' } });

    await getNextMoveHint(makeCards(), [], 4);
    const second = await getNextMoveHint(makeCards(), [], 4);

    expect(mockHintFn).toHaveBeenCalledTimes(2);
    expect(second).toEqual({ index: 3, message: 'Try again now' });
  });

  it('disables cloud hints for the session on CORS preflight endpoint errors', async () => {
    mockHintFn.mockRejectedValue(
      Object.assign(
        new Error(
          "Access to fetch at 'https://us-central1-example.cloudfunctions.net/getHint' from origin 'http://localhost:3000' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource."
        ),
        { code: 'functions/internal' }
      )
    );

    await getNextMoveHint(makeCards(), [], 4);
    await getNextMoveHint(makeCards(), [], 4);

    expect(mockHintFn).toHaveBeenCalledTimes(1);
  });

  it('disables cloud hints for the rest of the session on functions/permission-denied', async () => {
    mockHintFn.mockRejectedValue(
      Object.assign(new Error('denied'), { code: 'functions/permission-denied' })
    );

    await getNextMoveHint(makeCards(), [], 4);
    await getNextMoveHint(makeCards(), [], 4);

    expect(mockHintFn).toHaveBeenCalledTimes(1);
  });

  it('disables cloud hints for the rest of the session on functions/unauthenticated', async () => {
    mockHintFn.mockRejectedValue(
      Object.assign(new Error('not signed in'), { code: 'functions/unauthenticated' })
    );

    await getNextMoveHint(makeCards(), [], 4);
    await getNextMoveHint(makeCards(), [], 4);

    expect(mockHintFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to deterministic when the callable response has no data field', async () => {
    mockHintFn.mockResolvedValue({});

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('falls back to deterministic when the cloud hint exceeds the per-request timeout', async () => {
    vi.useFakeTimers();
    try {
      mockHintFn.mockReturnValue(new Promise(() => {})); // hang forever

      const promise = getNextMoveHint(makeCards(), [], 4);
      // CLOUD_HINT_TIMEOUT_MS is 30s; advance past it so withTimeout rejects.
      await vi.advanceTimersByTimeAsync(30_001);
      const result = await promise;

      expect(result).not.toBeNull();
      expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
    } finally {
      vi.useRealTimers();
    }
  });

  it('deterministic fallback prefers the known matching pair when one card is flipped', async () => {
    // Cloud and local both unavailable, so the deterministic branch decides the hint.
    mockHintFn.mockRejectedValue(new Error('Network error'));
    mockGetLocalLlmHint.mockResolvedValue(null);

    // Card index 2 is the flipped Heart — the deterministic path should point at index 0
    // (the other unmatched, unflipped Heart) rather than at a random Star.
    const cardsWithKnownPair: CardData[] = [
      { id: 'heart-0', iconName: 'Heart', isFlipped: false, isMatched: false },
      { id: 'star-1', iconName: 'Star', isFlipped: false, isMatched: false },
      { id: 'heart-2', iconName: 'Heart', isFlipped: true, isMatched: false },
      { id: 'star-3', iconName: 'Star', isFlipped: false, isMatched: false },
    ];

    const result = await getNextMoveHint(cardsWithKnownPair, [2], 4);

    expect(result?.index).toBe(0);
    expect(result?.message).toMatch(/right track/i);
  });
});

// ─── validateHint (centralized "must be a legal move" guard) ─────────────────

describe('validateHint', () => {
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const cards: CardData[] = [
    { id: 'a-0', iconName: 'Heart', isFlipped: false, isMatched: false },
    { id: 'b-1', iconName: 'Star',  isFlipped: false, isMatched: false },
    { id: 'c-2', iconName: 'Heart', isFlipped: true,  isMatched: true  }, // matched
    { id: 'd-3', iconName: 'Star',  isFlipped: false, isMatched: false },
  ];

  it('returns null for non-object input', () => {
    expect(validateHint(null, cards, [])).toBeNull();
    expect(validateHint(undefined, cards, [])).toBeNull();
    expect(validateHint('a string', cards, [])).toBeNull();
    expect(validateHint(42, cards, [])).toBeNull();
  });

  it('returns null when index is non-integer or out of range', () => {
    expect(validateHint({ index: -1, message: 'x' }, cards, [])).toBeNull();
    expect(validateHint({ index: 99, message: 'x' }, cards, [])).toBeNull();
    expect(validateHint({ index: 1.5, message: 'x' }, cards, [])).toBeNull();
    expect(validateHint({ index: 'one', message: 'x' }, cards, [])).toBeNull();
  });

  it('returns null when the suggested card is already matched', () => {
    expect(validateHint({ index: 2, message: 'x' }, cards, [])).toBeNull();
  });

  it('returns null when the suggested card is currently flipped', () => {
    expect(validateHint({ index: 0, message: 'x' }, cards, [0])).toBeNull();
  });

  it('replaces empty/whitespace message with the default copy', () => {
    expect(validateHint({ index: 1, message: '   ' }, cards, [])).toEqual({
      index: 1,
      message: 'Give this one a try!',
    });
    expect(validateHint({ index: 1 }, cards, [])).toEqual({
      index: 1,
      message: 'Give this one a try!',
    });
  });

  it('truncates extremely long messages to 200 chars', () => {
    const longMsg = 'a'.repeat(500);
    const result = validateHint({ index: 1, message: longMsg }, cards, []);
    expect(result?.message.length).toBe(200);
  });

  it('coerces a numeric-string index that round-trips to an integer', () => {
    expect(validateHint({ index: '1', message: 'go' }, cards, [])).toEqual({
      index: 1,
      message: 'go',
    });
  });
});
