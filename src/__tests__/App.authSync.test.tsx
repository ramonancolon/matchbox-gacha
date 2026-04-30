// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnAuthStateChanged = vi.hoisted(() => vi.fn());
const mockSyncUserProfile = vi.hoisted(() => vi.fn());
const mockSetBestScore = vi.hoisted(() => vi.fn());
const mockSetBestScores = vi.hoisted(() => vi.fn());
const mockGetBestScores = vi.hoisted(() => vi.fn(() => ({ 4: null, 6: null })));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
}));

vi.mock('../lib/firebase', () => ({
  auth: {},
  logOut: vi.fn(),
  syncUserProfile: mockSyncUserProfile,
  submitScore: vi.fn(),
  updateUserBest: vi.fn(),
  logGameEvent: vi.fn(),
}));

vi.mock('../hooks/useMatchingGame', () => ({
  useMatchingGame: () => ({
    cards: [],
    flippedIndices: [],
    moves: 0,
    matches: 0,
    status: 'idle',
    time: 0,
    bestScore: null,
    hintIndex: null,
    hintMessage: null,
    isGettingHint: false,
    hintsRemaining: 3,
    initGame: vi.fn(),
    handleCardClick: vi.fn(),
    handleGetHint: vi.fn(),
    setBestScore: mockSetBestScore,
  }),
}));

vi.mock('../services/gamePersistenceService', () => ({
  gamePersistenceService: {
    getTutorialSeen: vi.fn(() => true),
    setTutorialSeen: vi.fn(),
    getBestScores: mockGetBestScores,
    setBestScores: mockSetBestScores,
  },
}));

vi.mock('../services/localLlmService', () => ({
  getLocalLlmInstallStatus: vi.fn(() => ({ active: false, progress: 0, text: '' })),
  subscribeLocalLlmInstallStatus: vi.fn(() => () => {}),
  warmLocalLlmEngine: vi.fn(),
}));

vi.mock('../lib/installedWebApp', () => ({
  isInstalledWebApp: vi.fn(() => false),
}));

vi.mock('../lib/sounds', () => ({
  soundManager: { prime: vi.fn(), setEnabled: vi.fn(), play: vi.fn() },
}));

vi.mock('../components/GameBoard', () => ({
  GameBoard: () => <div data-testid="game-board" />,
}));
vi.mock('../components/Leaderboard', () => ({
  Leaderboard: () => <div data-testid="leaderboard" />,
}));
vi.mock('../components/LocalLlmInstallModule', () => ({
  LocalLlmInstallModule: () => null,
}));
vi.mock('../components/SignInModal', () => ({
  SignInModal: () => null,
}));
vi.mock('../components/TutorialModal', () => ({
  TutorialModal: () => null,
}));
vi.mock('../components/GameOverModal', () => ({
  GameOverModal: () => null,
}));

import App from '../App';

const makeDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const flushMicrotasks = async () => {
  // syncUserProfile awaits + the post-await branch each schedule a microtask;
  // two flushes is enough to drain everything we care about.
  await Promise.resolve();
  await Promise.resolve();
};

describe('App auth sync behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBestScores.mockReturnValue({ 4: null, 6: null });
  });

  it('does not re-subscribe auth listener when grid size changes', async () => {
    mockSyncUserProfile.mockResolvedValue({
      bests: { '4': { moves: 10, time: 60 }, '6': { moves: 20, time: 120 } },
    });
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      void cb({ uid: 'u1' });
      return vi.fn();
    });

    render(<App />);
    await waitFor(() => expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /Adjust Settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /Set difficulty to Hard 6 by 6/i }));

    expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
  });

  it('ignores late syncUserProfile resolution after unmount', async () => {
    const deferred = makeDeferred<{ bests: Record<string, { moves: number; time: number }> }>();
    mockSyncUserProfile.mockReturnValue(deferred.promise);
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      void cb({ uid: 'u1' });
      return vi.fn();
    });

    const { unmount } = render(<App />);
    await waitFor(() => expect(mockSyncUserProfile).toHaveBeenCalledTimes(1));
    unmount();

    deferred.resolve({ bests: { '4': { moves: 8, time: 42 }, '6': { moves: 16, time: 99 } } });
    await flushMicrotasks();

    expect(mockSetBestScores).not.toHaveBeenCalled();
    expect(mockSetBestScore).not.toHaveBeenCalled();
  });

  it('pushes the synced best for the current grid size when sync resolves', async () => {
    mockSyncUserProfile.mockResolvedValue({
      bests: { '4': { moves: 10, time: 60 }, '6': { moves: 20, time: 120 } },
    });
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      void cb({ uid: 'u1' });
      return vi.fn();
    });

    render(<App />);
    await waitFor(() => expect(mockSetBestScore).toHaveBeenCalled());

    expect(mockSetBestScores).toHaveBeenCalledWith({
      4: { moves: 10, time: 60 },
      6: { moves: 20, time: 120 },
    });
    expect(mockSetBestScore).toHaveBeenCalledWith({ moves: 10, time: 60 });
  });

  it('uses the latest grid size when sync resolves after a difficulty change', async () => {
    const deferred = makeDeferred<{ bests: Record<string, { moves: number; time: number }> }>();
    mockSyncUserProfile.mockReturnValue(deferred.promise);
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      void cb({ uid: 'u1' });
      return vi.fn();
    });

    render(<App />);
    await waitFor(() => expect(mockSyncUserProfile).toHaveBeenCalledTimes(1));

    // User switches to 6x6 *before* the sync resolves.
    fireEvent.click(screen.getByRole('button', { name: /Adjust Settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /Set difficulty to Hard 6 by 6/i }));

    deferred.resolve({
      bests: { '4': { moves: 10, time: 60 }, '6': { moves: 20, time: 120 } },
    });
    await flushMicrotasks();

    // The synced push should match the current grid (6), not the grid at sync start (4).
    expect(mockSetBestScore).toHaveBeenLastCalledWith({ moves: 20, time: 120 });
  });

  it('drops a stale sync result if the auth state changes before it resolves', async () => {
    const deferredA = makeDeferred<{ bests: Record<string, { moves: number; time: number }> }>();
    mockSyncUserProfile.mockReturnValueOnce(deferredA.promise);

    let authCb: ((u: { uid: string } | null) => void) | undefined;
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      authCb = cb;
      void cb({ uid: 'u1' });
      return vi.fn();
    });

    render(<App />);
    await waitFor(() => expect(mockSyncUserProfile).toHaveBeenCalledTimes(1));

    // Auth flips to signed-out *before* sync A resolves.
    await act(async () => {
      authCb!(null);
    });

    // Let React flush cleanup of the previous effect before resolving stale promise.
    await Promise.resolve();

    // Now resolve the in-flight sync from the (now-stale) signed-in callback.
    await act(async () => {
      deferredA.resolve({
        bests: { '4': { moves: 10, time: 60 }, '6': { moves: 20, time: 120 } },
      });
    });
    await flushMicrotasks();

    // The stale result must not write to persistence or push a best score.
    expect(mockSetBestScores).not.toHaveBeenCalled();
    expect(mockSetBestScore).not.toHaveBeenCalled();
  });

  it('does not write persistence or push best when sync returns no bests', async () => {
    mockSyncUserProfile.mockResolvedValue({});
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      void cb({ uid: 'u1' });
      return vi.fn();
    });

    render(<App />);
    await waitFor(() => expect(mockSyncUserProfile).toHaveBeenCalledTimes(1));
    await flushMicrotasks();

    expect(mockSetBestScores).not.toHaveBeenCalled();
    expect(mockSetBestScore).not.toHaveBeenCalled();
  });

  it('does not call syncUserProfile when the user is signed out', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      void cb(null);
      return vi.fn();
    });

    render(<App />);
    await flushMicrotasks();

    expect(mockSyncUserProfile).not.toHaveBeenCalled();
    expect(mockSetBestScores).not.toHaveBeenCalled();
    expect(mockSetBestScore).not.toHaveBeenCalled();
  });
});
