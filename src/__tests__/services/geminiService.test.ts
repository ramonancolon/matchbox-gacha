import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CardData } from '../../types';

// Hoist the mock function so it can be referenced inside vi.mock factory
const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/genai', () => ({
  // Must use a regular function (not arrow) because it is invoked with `new`
  GoogleGenAI: vi.fn(function () {
    return { models: { generateContent: mockGenerateContent } };
  }),
  Type: { OBJECT: 'OBJECT', NUMBER: 'NUMBER', STRING: 'STRING' },
}));

import { getNextMoveHint } from '../../services/geminiService';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeCards = (): CardData[] => [
  { id: 'heart-0', iconName: 'Heart', isFlipped: false, isMatched: false },
  { id: 'star-1',  iconName: 'Star',  isFlipped: false, isMatched: false },
  { id: 'heart-2', iconName: 'Heart', isFlipped: true,  isMatched: false },
  { id: 'star-3',  iconName: 'Star',  isFlipped: false, isMatched: false },
];

describe('getNextMoveHint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── happy path ──────────────────────────────────────────────────────────────

  it('returns a parsed hint response on a successful API call', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ index: 1, message: 'Try flipping card at index 1!' }),
    });

    const result = await getNextMoveHint(makeCards(), [2], 4);

    expect(result).toEqual({ index: 1, message: 'Try flipping card at index 1!' });
  });

  it('passes the full board state in the prompt', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ index: 3, message: 'Nice move!' }),
    });

    await getNextMoveHint(makeCards(), [2], 4);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    // Board state should include icon names and matched status
    expect(callArgs.contents).toContain('"Heart"');
    expect(callArgs.contents).toContain('"Star"');
  });

  it('passes currently flipped indices in the prompt', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ index: 0, message: 'Go for it!' }),
    });

    await getNextMoveHint(makeCards(), [2], 4);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain('[2]');
  });

  it('includes the grid size in the system instruction', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ index: 0, message: 'Go for it!' }),
    });

    await getNextMoveHint(makeCards(), [], 6);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toContain('6x6');
  });

  it('includes isMatched status in the board state snapshot', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ index: 2, message: 'Keep going!' }),
    });

    const cardsWithMatch: CardData[] = [
      { id: 'a-0', iconName: 'Heart', isFlipped: true,  isMatched: true },
      { id: 'a-1', iconName: 'Heart', isFlipped: true,  isMatched: true },
      { id: 'b-2', iconName: 'Star',  isFlipped: false, isMatched: false },
      { id: 'b-3', iconName: 'Star',  isFlipped: false, isMatched: false },
    ];

    await getNextMoveHint(cardsWithMatch, [], 2);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain('"isMatched":true');
  });

  // ─── error handling ──────────────────────────────────────────────────────────

  it('falls back to a local hint when the API throws a network error', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Network error'));

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('falls back to a local hint when the response has no text', async () => {
    mockGenerateContent.mockResolvedValue({ text: null });

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('falls back to a local hint when the response text is malformed JSON', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'not-valid-json' });

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  it('falls back to a local hint when the API returns an empty text string', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    const result = await getNextMoveHint(makeCards(), [], 4);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ index: expect.any(Number), message: expect.any(String) });
  });

  // ─── response schema enforcement ─────────────────────────────────────────────

  it('requests a JSON response with index and message fields', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ index: 0, message: 'Test' }),
    });

    await getNextMoveHint(makeCards(), [], 4);

    const { config } = mockGenerateContent.mock.calls[0][0];
    expect(config.responseMimeType).toBe('application/json');
    expect(config.responseSchema.properties).toHaveProperty('index');
    expect(config.responseSchema.properties).toHaveProperty('message');
  });
});
