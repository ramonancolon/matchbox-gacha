// @vitest-environment happy-dom
import React from 'react';
import { render } from '@testing-library/react';
import { vi, it, expect } from 'vitest';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(function() { return {}; }),
  OAuthProvider: vi.fn(function() { return {}; }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(), collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(),
  updateDoc: vi.fn(), addDoc: vi.fn(),
}));
vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(),
  isSupported: vi.fn(() => Promise.resolve(false)),
  logEvent: vi.fn(),
}));
vi.mock('../../lib/sounds', () => ({ soundManager: { play: vi.fn(), setEnabled: vi.fn() } }));
vi.mock('../../services/geminiService', () => ({ getNextMoveHint: vi.fn() }));

import { useMatchingGame } from '../../hooks/useMatchingGame';

// Defined outside component so the reference is stable across re-renders
const SETTINGS = { gridSize: 4, theme: 'icons' } as const;
const persistence = {
  getBestScore: vi.fn(() => null),
  setBestScore: vi.fn(),
  getBestScores: vi.fn(() => ({})),
  setBestScores: vi.fn(),
  getTutorialSeen: vi.fn(() => false),
  setTutorialSeen: vi.fn(),
};

it('creates 16 cards for 4x4 grid', () => {
  let cards: any[] = [];
  function HookCapture() {
    const game = useMatchingGame({ settings: SETTINGS, user: null, soundEnabled: false, persistenceService: persistence });
    cards = game.cards;
    return null;
  }
  const { unmount } = render(React.createElement(HookCapture));
  expect(cards).toHaveLength(16);
  unmount();
});
