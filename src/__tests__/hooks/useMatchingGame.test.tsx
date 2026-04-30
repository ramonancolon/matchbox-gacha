// @vitest-environment happy-dom
import React from 'react';
import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useMatchingGame } from '../../hooks/useMatchingGame';
import type { GamePersistenceService } from '../../services/gamePersistenceService';
import type { BestScore, CardData, GameSettings } from '../../types';
import { getNextMoveHint } from '../../services/geminiService';
import { FRUIT_NAMES } from '../../assets/themes/fruits';

// ─── module mocks ────────────────────────────────────────────────────────────

vi.mock('../../lib/sounds', () => ({
  soundManager: { play: vi.fn(), setEnabled: vi.fn() },
}));

vi.mock('../../services/geminiService', () => ({
  getNextMoveHint: vi.fn(),
}));

const mockGetHint = vi.mocked(getNextMoveHint);

// ─── renderGame helper ────────────────────────────────────────────────────────

type HookResult = ReturnType<typeof useMatchingGame>;
type GameProps = Parameters<typeof useMatchingGame>[0];

/**
 * Renders the hook inside a real component so we avoid renderHook entirely.
 * The component returns null (no DOM output) but captures the latest hook
 * result via a closure ref that is updated on every render.
 */
function renderGame(props: GameProps) {
  let latest: HookResult = null!;

  function HookCapture(p: GameProps) {
    latest = useMatchingGame(p);
    return null;
  }

  const { unmount } = render(React.createElement(HookCapture, props));

  return {
    get game(): HookResult { return latest; },
    unmount,
  };
}

// ─── constants ────────────────────────────────────────────────────────────────

const defaultSettings: GameSettings = { gridSize: 4, theme: 'icons' };
const smallSettings: GameSettings = { gridSize: 2, theme: 'icons' };

// ─── helpers ─────────────────────────────────────────────────────────────────

const createMockPersistence = (initialBest: BestScore | null = null): GamePersistenceService => ({
  getBestScore: vi.fn(() => initialBest),
  setBestScore: vi.fn(),
  getBestScores: vi.fn(() => ({})),
  setBestScores: vi.fn(),
  getTutorialSeen: vi.fn(() => false),
  setTutorialSeen: vi.fn(),
});

/** renderGame with sane defaults — overrides take precedence. */
const setup = (overrides: Partial<GameProps> = {}) =>
  renderGame({
    settings: defaultSettings,
    user: null,
    soundEnabled: false,
    persistenceService: createMockPersistence(),
    ...overrides,
  });

const findMatchingPair = (cards: CardData[]): [number, number] | null => {
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].isMatched || cards[i].isFlipped) continue;
    const j = cards.findIndex(
      (c, idx) => idx !== i && c.iconName === cards[i].iconName && !c.isMatched && !c.isFlipped
    );
    if (j !== -1) return [i, j];
  }
  return null;
};

const findNonMatchingPair = (cards: CardData[]): [number, number] | null => {
  const available = cards
    .map((c, i) => ({ ...c, index: i }))
    .filter(c => !c.isMatched && !c.isFlipped);
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      if (available[i].iconName !== available[j].iconName) {
        return [available[i].index, available[j].index];
      }
    }
  }
  return null;
};

const winGame = (hook: ReturnType<typeof renderGame>) => {
  let remaining = hook.game.cards.filter(c => !c.isMatched);
  while (remaining.length > 0) {
    const pair = findMatchingPair(hook.game.cards);
    if (!pair) break;
    const [first, second] = pair;
    act(() => { hook.game.handleCardClick(first); });
    act(() => { hook.game.handleCardClick(second); });
    act(() => { vi.advanceTimersByTime(600); });
    remaining = hook.game.cards.filter(c => !c.isMatched);
  }
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('useMatchingGame', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ─── initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('creates 16 cards for a 4×4 grid', () => {
      const hook = setup();
      expect(hook.game.cards).toHaveLength(16);
      hook.unmount();
    });

    it('creates 36 cards for a 6×6 grid', () => {
      const hook = setup({ settings: { gridSize: 6, theme: 'icons' } });
      expect(hook.game.cards).toHaveLength(36);
      hook.unmount();
    });

    it('starts with idle status and zero moves, matches, time', () => {
      const hook = setup();
      expect(hook.game.status).toBe('idle');
      expect(hook.game.moves).toBe(0);
      expect(hook.game.matches).toBe(0);
      expect(hook.game.time).toBe(0);
      hook.unmount();
    });

    it('starts with 3 hints remaining and no active hint', () => {
      const hook = setup();
      expect(hook.game.hintsRemaining).toBe(3);
      expect(hook.game.hintIndex).toBeNull();
      expect(hook.game.hintMessage).toBeNull();
      hook.unmount();
    });

    it('every icon appears exactly twice (all cards are paired)', () => {
      const hook = setup();
      const count: Record<string, number> = {};
      hook.game.cards.forEach(c => { count[c.iconName] = (count[c.iconName] || 0) + 1; });
      Object.values(count).forEach(n => expect(n).toBe(2));
      hook.unmount();
    });

    it('all cards start face-down and unmatched', () => {
      const hook = setup();
      hook.game.cards.forEach(c => {
        expect(c.isFlipped).toBe(false);
        expect(c.isMatched).toBe(false);
      });
      hook.unmount();
    });

    it('loads best score from the persistence service on mount', () => {
      const best: BestScore = { moves: 12, time: 45 };
      const hook = setup({ persistenceService: createMockPersistence(best) });
      expect(hook.game.bestScore).toEqual(best);
      hook.unmount();
    });
  });

  // ─── fruits theme ───────────────────────────────────────────────────────────

  describe('fruits theme', () => {
    const fruitsSettings: GameSettings = { gridSize: 4, theme: 'fruits' };

    it('creates 16 cards for a 4×4 grid using fruit names', () => {
      const hook = setup({ settings: fruitsSettings });
      expect(hook.game.cards).toHaveLength(16);
      hook.game.cards.forEach(c => {
        expect(FRUIT_NAMES).toContain(c.iconName);
      });
      hook.unmount();
    });

    it('every fruit on the board appears exactly twice', () => {
      const hook = setup({ settings: fruitsSettings });
      const count: Record<string, number> = {};
      hook.game.cards.forEach(c => { count[c.iconName] = (count[c.iconName] || 0) + 1; });
      Object.values(count).forEach(n => expect(n).toBe(2));
      hook.unmount();
    });

    it('supports a 6×6 grid (fruit pool is large enough for 18 unique pairs)', () => {
      const hook = setup({ settings: { gridSize: 6, theme: 'fruits' } });
      expect(hook.game.cards).toHaveLength(36);
      const unique = new Set(hook.game.cards.map(c => c.iconName));
      expect(unique.size).toBe(18);
      hook.unmount();
    });
  });

  // ─── handleCardClick — first flip ───────────────────────────────────────────

  describe('handleCardClick — first flip', () => {
    it('transitions status to playing and adds the index to flippedIndices', () => {
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      expect(hook.game.status).toBe('playing');
      expect(hook.game.flippedIndices).toContain(0);
      expect(hook.game.moves).toBe(0);
      hook.unmount();
    });

    it('starts the timer so time increments each second', () => {
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      act(() => { vi.advanceTimersByTime(3000); });
      expect(hook.game.time).toBe(3);
      hook.unmount();
    });
  });

  // ─── handleCardClick — guard conditions ─────────────────────────────────────

  describe('handleCardClick — guards', () => {
    it('ignores a duplicate click on an already-flipped card', () => {
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      act(() => { hook.game.handleCardClick(0); });
      expect(hook.game.flippedIndices.filter(i => i === 0)).toHaveLength(1);
      hook.unmount();
    });

    it('blocks a third card flip while two are pending', () => {
      const hook = setup();
      const [a, b] = findNonMatchingPair(hook.game.cards)!;
      const c = hook.game.cards.findIndex((card, i) => i !== a && i !== b && !card.isMatched);
      act(() => { hook.game.handleCardClick(a); });
      act(() => { hook.game.handleCardClick(b); });
      act(() => { hook.game.handleCardClick(c); });
      expect(hook.game.flippedIndices).not.toContain(c);
      hook.unmount();
    });

    it('clears the active hint when any card is clicked', async () => {
      mockGetHint.mockResolvedValue({ index: 7, message: 'Try this!' });
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      await act(async () => { await hook.game.handleGetHint(); });
      expect(hook.game.hintIndex).toBe(7);

      const nextCard = hook.game.cards.findIndex(
        (c, i) => i !== 0 && !c.isFlipped && !c.isMatched
      );
      act(() => { hook.game.handleCardClick(nextCard); });
      expect(hook.game.hintIndex).toBeNull();
      expect(hook.game.hintMessage).toBeNull();
      hook.unmount();
    });
  });

  // ─── handleCardClick — matching pair ────────────────────────────────────────

  describe('handleCardClick — matching pair', () => {
    it('increments moves, marks cards matched after 500 ms, increments matches', () => {
      const hook = setup();
      const [first, second] = findMatchingPair(hook.game.cards)!;

      act(() => { hook.game.handleCardClick(first); });
      act(() => { hook.game.handleCardClick(second); });
      expect(hook.game.moves).toBe(1);

      act(() => { vi.advanceTimersByTime(600); });
      expect(hook.game.cards[first].isMatched).toBe(true);
      expect(hook.game.cards[second].isMatched).toBe(true);
      expect(hook.game.matches).toBe(1);
      expect(hook.game.flippedIndices).toHaveLength(0);
      hook.unmount();
    });
  });

  // ─── handleCardClick — non-matching pair ────────────────────────────────────

  describe('handleCardClick — non-matching pair', () => {
    it('increments moves and flips cards back after 1000 ms', () => {
      const hook = setup();
      const [first, second] = findNonMatchingPair(hook.game.cards)!;

      act(() => { hook.game.handleCardClick(first); });
      act(() => { hook.game.handleCardClick(second); });
      expect(hook.game.moves).toBe(1);

      act(() => { vi.advanceTimersByTime(1100); });
      expect(hook.game.cards[first].isFlipped).toBe(false);
      expect(hook.game.cards[second].isFlipped).toBe(false);
      expect(hook.game.matches).toBe(0);
      expect(hook.game.flippedIndices).toHaveLength(0);
      hook.unmount();
    });
  });

  // ─── win condition (2×2 grid to minimise act() calls) ───────────────────────

  describe('win condition', () => {
    it('transitions to "won" when all pairs are matched', () => {
      const hook = setup({ settings: smallSettings });
      winGame(hook);
      expect(hook.game.status).toBe('won');
      hook.unmount();
    });

    it('blocks further card clicks after winning', () => {
      const hook = setup({ settings: smallSettings });
      winGame(hook);
      const movesBefore = hook.game.moves;
      const unflipped = hook.game.cards.findIndex(c => !c.isFlipped);
      if (unflipped !== -1) {
        act(() => { hook.game.handleCardClick(unflipped); });
        expect(hook.game.moves).toBe(movesBefore);
      }
      hook.unmount();
    });

    it('clears hints on win', () => {
      const hook = setup({ settings: smallSettings });
      winGame(hook);
      expect(hook.game.hintIndex).toBeNull();
      expect(hook.game.hintMessage).toBeNull();
      hook.unmount();
    });
  });

  // ─── handleGetHint ───────────────────────────────────────────────────────────

  describe('handleGetHint', () => {
    it('sets hintIndex and hintMessage, decrements hintsRemaining', async () => {
      mockGetHint.mockResolvedValue({ index: 5, message: 'Try card 5!' });
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      await act(async () => { await hook.game.handleGetHint(); });

      expect(hook.game.hintIndex).toBe(5);
      expect(hook.game.hintMessage).toBe('Try card 5!');
      expect(hook.game.hintsRemaining).toBe(2);
      hook.unmount();
    });

    it('auto-clears hint after 5 seconds', async () => {
      mockGetHint.mockResolvedValue({ index: 5, message: 'Try card 5!' });
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      await act(async () => { await hook.game.handleGetHint(); });
      act(() => { vi.advanceTimersByTime(5100); });
      expect(hook.game.hintIndex).toBeNull();
      expect(hook.game.hintMessage).toBeNull();
      hook.unmount();
    });

    it('does nothing when status is idle', async () => {
      const hook = setup();
      await act(async () => { await hook.game.handleGetHint(); });
      expect(mockGetHint).not.toHaveBeenCalled();
      hook.unmount();
    });

    it('does nothing when hintsRemaining is 0', async () => {
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      for (let i = 0; i < 3; i++) {
        mockGetHint.mockResolvedValueOnce({ index: i + 1, message: `Hint ${i}` });
        await act(async () => { await hook.game.handleGetHint(); });
      }
      expect(hook.game.hintsRemaining).toBe(0);
      vi.clearAllMocks();
      await act(async () => { await hook.game.handleGetHint(); });
      expect(mockGetHint).not.toHaveBeenCalled();
      hook.unmount();
    });

    it('does not change state when the API returns null', async () => {
      mockGetHint.mockResolvedValue(null);
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      await act(async () => { await hook.game.handleGetHint(); });
      expect(hook.game.hintIndex).toBeNull();
      expect(hook.game.hintsRemaining).toBe(3);
      hook.unmount();
    });

    it('blocks a concurrent hint request while one is already in flight', async () => {
      let resolveHint: (v: { index: number; message: string } | null) => void;
      mockGetHint.mockReturnValueOnce(
        new Promise(res => { resolveHint = res; }) as Promise<{ index: number; message: string } | null>
      );
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });

      // Fire two requests; the second must be ignored while the first is pending.
      let firstDone: Promise<void> | null = null;
      act(() => { firstDone = hook.game.handleGetHint(); });
      act(() => { hook.game.handleGetHint(); });

      expect(mockGetHint).toHaveBeenCalledTimes(1);
      await act(async () => { resolveHint!({ index: 5, message: 'go' }); await firstDone!; });
      hook.unmount();
    });
  });

  // ─── initGame ────────────────────────────────────────────────────────────────

  describe('initGame', () => {
    it('resets all game state to initial values', () => {
      const hook = setup();
      const [a, b] = findNonMatchingPair(hook.game.cards)!;
      act(() => { hook.game.handleCardClick(a); });
      act(() => { hook.game.handleCardClick(b); });

      act(() => { hook.game.initGame(); });
      expect(hook.game.moves).toBe(0);
      expect(hook.game.matches).toBe(0);
      expect(hook.game.status).toBe('idle');
      expect(hook.game.time).toBe(0);
      expect(hook.game.hintsRemaining).toBe(3);
      expect(hook.game.flippedIndices).toHaveLength(0);
      expect(hook.game.hintIndex).toBeNull();
      hook.unmount();
    });

    it('stops the timer so time does not increment after reset', () => {
      const hook = setup();
      act(() => { hook.game.handleCardClick(0); });
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { hook.game.initGame(); });
      act(() => { vi.advanceTimersByTime(2000); });
      expect(hook.game.time).toBe(0);
      hook.unmount();
    });

    it('produces a fresh set of paired cards', () => {
      const hook = setup();
      act(() => { hook.game.initGame(); });
      expect(hook.game.cards).toHaveLength(16);
      const count: Record<string, number> = {};
      hook.game.cards.forEach(c => { count[c.iconName] = (count[c.iconName] || 0) + 1; });
      Object.values(count).forEach(n => expect(n).toBe(2));
      hook.unmount();
    });
  });

  // ─── best score persistence (2×2 grid) ───────────────────────────────────────

  describe('best score persistence', () => {
    it('calls setBestScore when there is no previous best', () => {
      const persistence = createMockPersistence(null);
      const hook = setup({ settings: smallSettings, persistenceService: persistence });
      winGame(hook);
      expect(persistence.setBestScore).toHaveBeenCalled();
      hook.unmount();
    });

    it('updates bestScore state after winning with no prior best', () => {
      const hook = setup({ settings: smallSettings, persistenceService: createMockPersistence(null) });
      winGame(hook);
      expect(hook.game.bestScore).not.toBeNull();
      hook.unmount();
    });

    it('saves when current score is better than stored (fewer moves)', () => {
      const persistence = createMockPersistence({ moves: 999, time: 9999 });
      const hook = setup({ settings: smallSettings, persistenceService: persistence });
      winGame(hook);
      expect(persistence.setBestScore).toHaveBeenCalled();
      hook.unmount();
    });

    it('does not save when current score is worse than stored', () => {
      const persistence = createMockPersistence({ moves: 1, time: 1 });
      const hook = setup({ settings: smallSettings, persistenceService: persistence });
      winGame(hook);
      expect(persistence.setBestScore).not.toHaveBeenCalled();
      hook.unmount();
    });
  });

  // ─── onWin callback ───────────────────────────────────────────────────────────

  describe('onWin callback', () => {
    it('fires with game metadata when a logged-in user wins', () => {
      const onWin = vi.fn();
      const mockUser = { uid: 'u1', displayName: 'Player' } as any;
      const hook = setup({ settings: smallSettings, user: mockUser, onWin });
      winGame(hook);
      expect(onWin).toHaveBeenCalledWith(expect.objectContaining({
        gridSize: 2,
        theme: 'icons',
        user: mockUser,
      }));
      hook.unmount();
    });

    it('does not fire when user is a guest (null)', () => {
      const onWin = vi.fn();
      const hook = setup({ settings: smallSettings, onWin });
      winGame(hook);
      expect(onWin).not.toHaveBeenCalled();
      hook.unmount();
    });
  });

  // ─── analytics event logging ──────────────────────────────────────────────────

  describe('analytics event logging', () => {
    it('does not fire game_init on first mount (silent initialisation)', () => {
      const logEvent = vi.fn();
      const hook = setup({ logEvent });
      expect(logEvent).not.toHaveBeenCalledWith('game_init', expect.anything());
      hook.unmount();
    });

    it('fires game_init when initGame is called explicitly after mount', () => {
      const logEvent = vi.fn();
      const hook = setup({ logEvent });
      act(() => { hook.game.initGame(); });
      expect(logEvent).toHaveBeenCalledWith('game_init', expect.objectContaining({ grid_size: 4 }));
      hook.unmount();
    });

    it('fires game_start on the first card flip', () => {
      const logEvent = vi.fn();
      const hook = setup({ logEvent });
      act(() => { hook.game.handleCardClick(0); });
      expect(logEvent).toHaveBeenCalledWith('game_start', expect.any(Object));
      hook.unmount();
    });

    it('fires card_flip with the clicked index', () => {
      const logEvent = vi.fn();
      const hook = setup({ logEvent });
      act(() => { hook.game.handleCardClick(3); });
      expect(logEvent).toHaveBeenCalledWith('card_flip', expect.objectContaining({ index: 3 }));
      hook.unmount();
    });

    it('fires match_found for a successful match', () => {
      const logEvent = vi.fn();
      const hook = setup({ logEvent });
      const [first, second] = findMatchingPair(hook.game.cards)!;
      act(() => { hook.game.handleCardClick(first); });
      act(() => { hook.game.handleCardClick(second); });
      expect(logEvent).toHaveBeenCalledWith('match_found', expect.any(Object));
      hook.unmount();
    });

    it('fires match_failed for a mismatch', () => {
      const logEvent = vi.fn();
      const hook = setup({ logEvent });
      const [first, second] = findNonMatchingPair(hook.game.cards)!;
      act(() => { hook.game.handleCardClick(first); });
      act(() => { hook.game.handleCardClick(second); });
      expect(logEvent).toHaveBeenCalledWith('match_failed', expect.any(Object));
      hook.unmount();
    });

    it('fires game_won with moves and time when the game ends', () => {
      const logEvent = vi.fn();
      const hook = setup({ settings: smallSettings, logEvent });
      winGame(hook);
      expect(logEvent).toHaveBeenCalledWith('game_won', expect.objectContaining({
        grid_size: 2,
        moves: expect.any(Number),
        time: expect.any(Number),
      }));
      hook.unmount();
    });
  });
});
