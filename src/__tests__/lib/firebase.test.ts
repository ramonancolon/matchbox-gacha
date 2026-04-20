import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── firebase module mocks (must be before any imports from firebase.ts) ──────

const mockSignInWithPopup = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockSignInWithEmailAndPassword = vi.hoisted(() => vi.fn());
const mockCreateUserWithEmailAndPassword = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockGetDoc = vi.hoisted(() => vi.fn());
const mockSetDoc = vi.hoisted(() => vi.fn());
const mockUpdateDoc = vi.hoisted(() => vi.fn());
const mockAddDoc = vi.hoisted(() => vi.fn());

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
  updateProfile: mockUpdateProfile,
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
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

import {
  signInWithGoogle,
  signInWithApple,
  signInEmail,
  signUpEmail,
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
