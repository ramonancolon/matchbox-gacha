import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── firebase module mocks (must be before any imports from firebase.ts) ──────

const mockSignInWithPopup = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockSignInWithEmailAndPassword = vi.hoisted(() => vi.fn());
const mockCreateUserWithEmailAndPassword = vi.hoisted(() => vi.fn());
const mockSendPasswordResetEmail = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockGetDoc = vi.hoisted(() => vi.fn());
const mockSetDoc = vi.hoisted(() => vi.fn());
const mockUpdateDoc = vi.hoisted(() => vi.fn());
const mockAddDoc = vi.hoisted(() => vi.fn());
const mockConnectFirestoreEmulator = vi.hoisted(() => vi.fn());
const mockInitializeAppCheck = vi.hoisted(() => vi.fn());
const mockReCaptchaV3Provider = vi.hoisted(() => vi.fn(function (key: string) {
  return { _key: key };
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(function () { return {}; }),
  OAuthProvider: vi.fn(function () { return {}; }),
  signInWithPopup: mockSignInWithPopup,
  signOut: mockSignOut,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  updateProfile: mockUpdateProfile,
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: mockConnectFirestoreEmulator,
  doc: vi.fn(() => 'mock-doc-ref'),
  collection: vi.fn(() => 'mock-collection-ref'),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  addDoc: mockAddDoc,
}));

vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(),
  isSupported: vi.fn(() => Promise.resolve(false)),
  logEvent: vi.fn(),
}));

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: mockInitializeAppCheck,
  ReCaptchaV3Provider: mockReCaptchaV3Provider,
}));

import {
  signInWithGoogle,
  signInWithApple,
  signInEmail,
  signUpEmail,
  sendPasswordReset,
  logOut,
  syncUserProfile,
  updateUserBest,
  submitScore,
} from '../../lib/firebase';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  uid: 'user-123',
  displayName: 'Test Player',
  photoURL: 'https://example.com/avatar.jpg',
  ...overrides,
} as any);

const existingDoc = (data: object) => ({
  exists: () => true,
  data: () => data,
});

const missingDoc = () => ({
  exists: () => false,
  data: () => null,
});

describe('Firebase auth functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── sign-in providers ───────────────────────────────────────────────────────

  it('signInWithGoogle calls signInWithPopup', async () => {
    mockSignInWithPopup.mockResolvedValue({ user: makeUser() });
    await signInWithGoogle();
    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('signInWithApple calls signInWithPopup', async () => {
    mockSignInWithPopup.mockResolvedValue({ user: makeUser() });
    await signInWithApple();
    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('signInWithGoogle propagates errors', async () => {
    mockSignInWithPopup.mockRejectedValue(new Error('popup-closed'));
    await expect(signInWithGoogle()).rejects.toThrow('popup-closed');
  });

  // ─── email auth ──────────────────────────────────────────────────────────────

  it('signInEmail calls signInWithEmailAndPassword with correct args', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: makeUser() });
    await signInEmail('test@example.com', 'secret123');
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'secret123'
    );
  });

  it('signInEmail propagates errors', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(new Error('wrong-password'));
    await expect(signInEmail('a@b.com', 'bad')).rejects.toThrow('wrong-password');
  });

  // ─── password reset ──────────────────────────────────────────────────────────

  it('sendPasswordReset calls sendPasswordResetEmail with the email', async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    await sendPasswordReset('forgot@example.com');
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      'forgot@example.com'
    );
  });

  it('sendPasswordReset propagates errors', async () => {
    mockSendPasswordResetEmail.mockRejectedValue(new Error('user-not-found'));
    await expect(sendPasswordReset('missing@example.com')).rejects.toThrow('user-not-found');
  });

  it('signUpEmail creates user and sets display name', async () => {
    const mockUser = makeUser();
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockUpdateProfile.mockResolvedValue(undefined);

    await signUpEmail('new@example.com', 'password123', 'NewPlayer');

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'new@example.com',
      'password123'
    );
    expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'NewPlayer' });
  });

  it('signUpEmail propagates creation errors', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue(new Error('email-already-in-use'));
    await expect(signUpEmail('dupe@example.com', 'pass', 'Name')).rejects.toThrow('email-already-in-use');
  });

  // ─── sign out ─────────────────────────────────────────────────────────────────

  it('logOut calls signOut', async () => {
    mockSignOut.mockResolvedValue(undefined);
    await logOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

// ─── submitScore ─────────────────────────────────────────────────────────────

describe('submitScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'score-doc-id' });
  });

  it('writes a document to the scores collection', async () => {
    await submitScore('user-1', 'Player1', 'photo.jpg', 10, 30, 4, 'icons');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it('includes all required fields in the submitted document', async () => {
    await submitScore('user-1', 'Player1', 'photo.jpg', 10, 30, 4, 'icons');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        userId: 'user-1',
        userName: 'Player1',
        userPhoto: 'photo.jpg',
        moves: 10,
        time: 30,
        mode: '4',
        theme: 'icons',
      })
    );
  });

  it('converts mode number to string', async () => {
    await submitScore('user-1', 'Player1', null, 5, 20, 6, 'emojis');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({ mode: '6' })
    );
  });

  it('falls back to "Anonymous" when userName is empty', async () => {
    await submitScore('guest', '', null, 8, 25, 4, 'icons');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({ userName: 'Anonymous' })
    );
  });

  it('uses empty string when userPhoto is null', async () => {
    await submitScore('user-1', 'Player', null, 8, 25, 4, 'icons');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({ userPhoto: '' })
    );
  });

  it('propagates errors when the score write fails', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(
      submitScore('user-1', 'Player', null, 8, 25, 4, 'icons')
    ).rejects.toThrow('permission-denied');
  });

  it('serializes a server timestamp on the createdAt field', async () => {
    await submitScore('user-1', 'Player', null, 8, 25, 4, 'icons');
    const doc = mockAddDoc.mock.calls[0][1] as { createdAt: unknown };
    expect(doc.createdAt).toEqual({ _serverTimestamp: true });
  });
});

// ─── updateUserBest ───────────────────────────────────────────────────────────

describe('updateUserBest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('does nothing when the user document does not exist', async () => {
    mockGetDoc.mockResolvedValue(missingDoc());
    await updateUserBest('user-1', '4', 10, 30);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('updates when there is no existing best (first win)', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({ bests: {} }));
    await updateUserBest('user-1', '4', 10, 30);
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
      'bests.4': { moves: 10, time: 30 },
    });
  });

  it('updates when new score has fewer moves', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({ bests: { '4': { moves: 20, time: 60 } } }));
    await updateUserBest('user-1', '4', 10, 45);
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
      'bests.4': { moves: 10, time: 45 },
    });
  });

  it('updates when moves tie but new score is faster', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({ bests: { '4': { moves: 10, time: 60 } } }));
    await updateUserBest('user-1', '4', 10, 30);
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
      'bests.4': { moves: 10, time: 30 },
    });
  });

  it('does not update when new score has more moves', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({ bests: { '4': { moves: 5, time: 15 } } }));
    await updateUserBest('user-1', '4', 10, 30);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('does not update when moves tie and new score is slower', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({ bests: { '4': { moves: 10, time: 15 } } }));
    await updateUserBest('user-1', '4', 10, 30);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

// ─── syncUserProfile ──────────────────────────────────────────────────────────

describe('syncUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockAddDoc.mockResolvedValue({ id: 'score-id' });
  });

  it('creates a new profile when the user does not yet exist in Firestore', async () => {
    mockGetDoc.mockResolvedValue(missingDoc());
    const user = makeUser();

    const profile = await syncUserProfile(user);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(profile.displayName).toBe('Test Player');
  });

  it('returns existing profile data without overwriting when user already exists', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({
      displayName: 'Stored Name',
      photoURL: 'stored.jpg',
      bests: { '4': { moves: 8, time: 20 } },
    }));

    const profile = await syncUserProfile(makeUser());

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(profile.displayName).toBe('Stored Name');
    expect(profile.bests['4']).toEqual({ moves: 8, time: 20 });
  });

  it('merges a better local best into the cloud profile', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({
      displayName: 'Player',
      photoURL: '',
      bests: { '4': { moves: 20, time: 60 } },
    }));

    const localBests = { '4': { moves: 8, time: 25 } };
    const profile = await syncUserProfile(makeUser(), localBests);

    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(profile.bests['4']).toEqual({ moves: 8, time: 25 });
  });

  it('does not update cloud when local best is worse', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({
      displayName: 'Player',
      photoURL: '',
      bests: { '4': { moves: 5, time: 10 } },
    }));

    const localBests = { '4': { moves: 20, time: 60 } };
    await syncUserProfile(makeUser(), localBests);

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('migrates legacy bestMoves/bestTime schema on read', async () => {
    mockGetDoc.mockResolvedValue(existingDoc({
      displayName: 'OldUser',
      photoURL: '',
      bests: {},
      bestMoves: { '4': 12 },
      bestTime: { '4': 45 },
    }));

    const profile = await syncUserProfile(makeUser());

    // Migration should setDoc with merged bests
    expect(mockSetDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({ bests: expect.objectContaining({ '4': { moves: 12, time: 45 } }) }),
      { merge: true }
    );
    expect(profile.bests['4']).toEqual({ moves: 12, time: 45 });
  });

  it('uses "Anonymous" as fallback when user has no displayName', async () => {
    mockGetDoc.mockResolvedValue(missingDoc());
    const user = makeUser({ displayName: null });

    const profile = await syncUserProfile(user);

    expect(profile.displayName).toBe('Anonymous');
  });
});

// ─── Firestore emulator wiring ───────────────────────────────────────────────
//
// `dev:local` boots the Firestore emulator alongside Functions. The lib/firebase
// module gates `connectFirestoreEmulator` on import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR.
// Use vi.resetModules() so each case re-runs the module-load code path with
// a fresh env stub.

// ─── App Check init ─────────────────────────────────────────────────────────
//
// The Cloud Function `getHint` enforces App Check, so the browser must call
// `initializeAppCheck` with a real reCAPTCHA v3 site key. firebase.ts gates
// initialization on VITE_FIREBASE_APPCHECK_SITE_KEY (skip on missing/placeholder)
// and optionally installs a debug token for local dev. These tests lock the
// gating logic so a misconfigured deploy fails loudly rather than silently
// dropping every cloud hint.

describe('App Check init', () => {
  type DebugWindow = Window & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean };

  const clearDebugToken = () => {
    delete (globalThis as unknown as DebugWindow).FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (typeof window !== 'undefined') {
      delete (window as DebugWindow).FIREBASE_APPCHECK_DEBUG_TOKEN;
    }
  };

  // The async IIFE inside initAppCheck awaits a dynamic `import()` of
  // firebase/app-check before calling our mock, which can take several
  // microtasks to settle in jsdom. Poll the mock instead of guessing how
  // many `await Promise.resolve()`s are enough.
  const waitForAppCheckCall = () =>
    vi.waitFor(() => expect(mockInitializeAppCheck).toHaveBeenCalled());

  const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  beforeEach(() => {
    vi.resetModules();
    mockInitializeAppCheck.mockClear();
    mockReCaptchaV3Provider.mockClear();
    clearDebugToken();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearDebugToken();
  });

  it('skips initialization when the site key is empty', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '');
    await import('../../lib/firebase');
    await flushMicrotasks();
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
  });

  it('skips initialization when the site key is the .env.example placeholder', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'YOUR_RECAPTCHA_V3_SITE_KEY');
    await import('../../lib/firebase');
    await flushMicrotasks();
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
  });

  it('initializes App Check with the configured reCAPTCHA v3 site key', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '6LeREAL_SITE_KEY');
    await import('../../lib/firebase');
    await waitForAppCheckCall();
    expect(mockReCaptchaV3Provider).toHaveBeenCalledWith('6LeREAL_SITE_KEY');
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    const opts = mockInitializeAppCheck.mock.calls[0][1] as { isTokenAutoRefreshEnabled: boolean };
    expect(opts.isTokenAutoRefreshEnabled).toBe(true);
  });

  it('installs the debug token from env onto window before init when in dev', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '6LeREAL_SITE_KEY');
    vi.stubEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', 'debug-token-abc');

    await import('../../lib/firebase');
    await waitForAppCheckCall();

    const w = window as DebugWindow;
    expect(w.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('debug-token-abc');
  });

  it('does not overwrite a debug token the developer already set via DevTools', async () => {
    (window as DebugWindow).FIREBASE_APPCHECK_DEBUG_TOKEN = 'devtools-token';
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '6LeREAL_SITE_KEY');
    vi.stubEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', 'env-token');

    await import('../../lib/firebase');
    await waitForAppCheckCall();

    expect((window as DebugWindow).FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('devtools-token');
  });

  it('does not install a debug token when env var is unset', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '6LeREAL_SITE_KEY');
    vi.stubEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', '');

    await import('../../lib/firebase');
    await waitForAppCheckCall();

    expect((window as DebugWindow).FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('swallows initializeAppCheck errors so module load never fails', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '6LeREAL_SITE_KEY');
    mockInitializeAppCheck.mockImplementationOnce(() => {
      throw new Error('reCAPTCHA failed to load (network/AdBlock)');
    });

    await expect(import('../../lib/firebase')).resolves.toBeDefined();
    await waitForAppCheckCall();
  });
});

describe('Firestore emulator hookup', () => {
  beforeEach(() => {
    vi.resetModules();
    mockConnectFirestoreEmulator.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('connects to the Firestore emulator when the dev flag is set', async () => {
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_EMULATOR', 'true');
    await import('../../lib/firebase');
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(
      expect.anything(),
      '127.0.0.1',
      8080
    );
  });

  it('does not connect when the flag is unset', async () => {
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_EMULATOR', '');
    await import('../../lib/firebase');
    expect(mockConnectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('does not connect when the flag is anything other than "true"', async () => {
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_EMULATOR', 'false');
    await import('../../lib/firebase');
    expect(mockConnectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('swallows errors from connectFirestoreEmulator (e.g. double-connect on HMR reload)', async () => {
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_EMULATOR', 'true');
    mockConnectFirestoreEmulator.mockImplementationOnce(() => {
      throw new Error('Firestore emulator already connected');
    });
    // Module init must not throw even when the underlying SDK call rejects.
    await expect(import('../../lib/firebase')).resolves.toBeDefined();
  });
});
