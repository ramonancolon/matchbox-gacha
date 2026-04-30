/// <reference types="vite/client" />

/** Injected from `package.json` via Vite `define` (see `vite.config.ts`). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Firebase callable region for `getHint` (default: us-central1). */
  readonly VITE_FIREBASE_FUNCTIONS_REGION?: string;
  /** Set to `true` in dev to use the Functions emulator on port 5001. */
  readonly VITE_FIREBASE_FUNCTIONS_EMULATOR?: string;
  /** reCAPTCHA v3 site key used by Firebase App Check in the browser. */
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string;
  /**
   * Optional App Check debug token for local development. When set in dev
   * builds, the firebase init code installs it at `self.FIREBASE_APPCHECK_DEBUG_TOKEN`
   * before `initializeAppCheck`. Register the token in Firebase Console →
   * App Check → Apps → Manage debug tokens. Never set in production builds.
   */
  readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_DATABASE_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  readonly VITE_CDN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
