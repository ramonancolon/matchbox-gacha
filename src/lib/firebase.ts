import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  User,
  GoogleAuthProvider, 
  OAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, collection, query, where, orderBy, limit, onSnapshot, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import type { Analytics } from 'firebase/analytics';
import { BestScore } from '../types';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

// App Check setup. The Cloud Function `getHint` enforces App Check, so the
// browser must obtain a token before calling it. Set
// `VITE_FIREBASE_APPCHECK_SITE_KEY` at build time (see `.env.example` and
// deploy workflow). If the site key is missing, initialization is skipped and
// cloud hint calls fail with `unauthenticated`; the client falls back to
// deterministic hints. Initialized before getAuth/getFirestore so any future
// App-Check-enforced services (Firestore, Storage) receive tokens from the
// first request.
let appCheckInitPromise: Promise<void> | null = null;

// The Firebase App Check SDK looks for a debug token at this exact global
// path before initialization. Setting `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`
// in a local `.env.local` lets dev builds satisfy enforcement on `getHint`
// without a real reCAPTCHA token. Register the token in Firebase Console →
// App Check → Apps → Manage debug tokens.
// See https://firebase.google.com/docs/app-check/web/debug-provider
const installAppCheckDebugToken = () => {
  if (!import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  const debugToken = (import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN ?? '').trim();
  if (!debugToken) return;
  const target = window as Window & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean };
  // Don't overwrite a token the developer already injected via DevTools.
  if (target.FIREBASE_APPCHECK_DEBUG_TOKEN) return;
  target.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
};

const initAppCheck = () => {
  if (typeof window === 'undefined') return;
  if (appCheckInitPromise) return;

  appCheckInitPromise = (async () => {
    const siteKey = (import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY ?? '').trim();
    const looksLikePlaceholder = /^YOUR_[A-Z0-9_]+$/.test(siteKey);
    if (!siteKey || looksLikePlaceholder) {
      if (import.meta.env.DEV) {
        console.warn(
          'App Check not initialized: set VITE_FIREBASE_APPCHECK_SITE_KEY to your reCAPTCHA v3 site key at build time (public key, not the secret). getHint will return unauthenticated and the client will fall back to deterministic hints.'
        );
      }
      return;
    }

    installAppCheckDebugToken();

    try {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (error) {
      console.warn('Failed to initialize Firebase App Check', error);
    }
  })();
};

initAppCheck();

export const auth = getAuth(app);
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID);

// `npm run dev:local` boots both the Functions and Firestore emulators against
// the `demo-matchbox` project and sets VITE_FIREBASE_FUNCTIONS_EMULATOR=true.
// Without this hookup, leaderboard/profile reads still hit production Firestore
// while only hint calls use the emulator — leaking dev writes into prod.
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  } catch (error) {
    // connectFirestoreEmulator throws if called twice on the same instance
    // (e.g. across HMR reloads). Safe to ignore.
    if (import.meta.env.DEV) {
      console.warn('Firestore emulator hookup skipped (already connected?)', error);
    }
  }
}

// Initialize Analytics lazily for speed optimization
let analyticsInstance: Analytics | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

async function getAnalyticsLazy() {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.measurementId) {
    console.warn('Firebase Analytics disabled: missing VITE_FIREBASE_MEASUREMENT_ID');
    return null;
  }
  if (analyticsInstance) return analyticsInstance;
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      try {
        const { getAnalytics, isSupported, setAnalyticsCollectionEnabled } = await import('firebase/analytics');
        const supported = await isSupported();
        if (supported) {
          analyticsInstance = getAnalytics(app);
          setAnalyticsCollectionEnabled(analyticsInstance, true);
        } else {
          console.warn('Firebase Analytics not supported in this browser/runtime');
        }
        return analyticsInstance;
      } catch (e) {
        console.warn('Analytics blocked or unavailable', e);
        return null;
      }
    })();
  }
  return analyticsPromise;
}

/**
 * Log granular analytics events safely and async to avoid main-thread blocking
 */
export async function logGameEvent(eventName: string, params?: Record<string, unknown>) {
  try {
    const analytics = await getAnalyticsLazy();
    if (analytics) {
      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, eventName, {
        ...params,
        platform: 'web',
        ...(import.meta.env.DEV ? { debug_mode: true } : {})
      });
    } else if (import.meta.env.DEV) {
      console.warn(`Analytics event skipped (${eventName}): analytics unavailable`);
    }
  } catch (e) {
    console.warn(`Failed to log analytics event (${eventName})`, e);
  }
}

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithApple = () => signInWithPopup(auth, appleProvider);
export const signInEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const sendPasswordReset = (email: string) => sendPasswordResetEmail(auth, email);
export const signUpEmail = async (email: string, pass: string, name: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(userCredential.user, { displayName: name });
  return userCredential;
};

export const logOut = () => signOut(auth);

// User Profile Utils
interface UserBestMap {
  [mode: string]: BestScore;
}

interface UserProfileDoc {
  displayName: string;
  photoURL: string;
  bests: UserBestMap;
}

interface LegacyUserProfileDoc extends Partial<UserProfileDoc> {
  bestMoves?: Record<string, number>;
  bestTime?: Record<string, number>;
}

export async function syncUserProfile(user: User, localBests?: Record<string, BestScore | null>): Promise<UserProfileDoc> {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  
  const defaultProfile: UserProfileDoc = {
    displayName: user.displayName || 'Anonymous',
    photoURL: user.photoURL || '',
    bests: {}
  };
  let cloudData: UserProfileDoc = defaultProfile;

  if (snap.exists()) {
    const rawData = snap.data() as LegacyUserProfileDoc;
    cloudData = {
      displayName: rawData.displayName || defaultProfile.displayName,
      photoURL: rawData.photoURL || defaultProfile.photoURL,
      bests: rawData.bests || {}
    };

    // Migrating old schema if it exists
    if (rawData.bestMoves || rawData.bestTime) {
      const migratedBests: UserBestMap = { ...cloudData.bests };
      ['4', '6'].forEach(mode => {
        if (!migratedBests[mode] && rawData.bestMoves?.[mode]) {
          migratedBests[mode] = {
            moves: rawData.bestMoves[mode],
            time: rawData.bestTime?.[mode] || 0
          };
        }
      });
      await setDoc(userRef, { bests: migratedBests }, { merge: true });
      cloudData.bests = migratedBests;
    }
  } else {
    await setDoc(userRef, cloudData);
  }

  // If local bests are provided (from guest session), merge them
  if (localBests) {
    let hasUpdates = false;
    const updates: Record<string, BestScore> = {};

    Object.entries(localBests).forEach(([mode, best]) => {
      if (!best) return;
      
      const cloudBest = cloudData.bests?.[mode] as BestScore | undefined;
      
      // A score is better if moves are fewer, OR moves are same but time is faster
      const isBetter = !cloudBest || 
                       best.moves < cloudBest.moves || 
                       (best.moves === cloudBest.moves && best.time < cloudBest.time);

      if (isBetter) {
        updates[`bests.${mode}`] = best;
        if (!cloudData.bests) cloudData.bests = {};
        cloudData.bests[mode] = best;
        hasUpdates = true;

        // Backfill this local guest record into the global scores collection
        submitScore(user.uid, user.displayName || 'Anonymous', user.photoURL, best.moves, best.time, parseInt(mode), 'legacy');
      }
    });

    if (hasUpdates) {
      await updateDoc(userRef, updates);
    }
  }

  return cloudData;
}

export async function updateUserBest(userId: string, mode: string, moves: number, time: number) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const currentBest = data.bests?.[mode] as BestScore | undefined;

  const isBetter = !currentBest || 
                   moves < currentBest.moves || 
                   (moves === currentBest.moves && time < currentBest.time);

  if (isBetter) {
    await updateDoc(userRef, {
      [`bests.${mode}`]: { moves, time }
    });
  }
}

// Score Utils
export async function submitScore(userId: string | 'guest', userName: string, userPhoto: string | null, moves: number, time: number, mode: number, theme: string) {
  await addDoc(collection(db, 'scores'), {
    userId,
    userName: userName || 'Anonymous',
    userPhoto: userPhoto || '',
    moves,
    time,
    mode: mode.toString(),
    theme,
    createdAt: serverTimestamp()
  });
}
