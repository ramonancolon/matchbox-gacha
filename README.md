# Matchbox Gacha

Matchbox Gacha is a browser-based memory matching game with local best-score persistence, a global leaderboard, AI-powered hints, and a responsive layout tuned for mobile, tablet, and desktop.

Built as part of the Vibe Coder Exercise.

**Live URL**: https://matchboxgacha.games  
**Repo URL**: https://github.com/ramonancolon/matchbox-gacha.git  
**Stack**: React, TypeScript, Tailwind CSS, Firebase, Vite

## Overview

The project started as a memory game, but the implementation goal was broader than gameplay alone. The focus was to ship something that felt production-ready: structured state management, clear contributor workflow, test coverage, real backend integration, and a deployment path that could survive beyond a demo.

Key features:

- Local best-score persistence with a service abstraction that can swap storage backends cleanly
- Firebase-backed authentication and global leaderboard support
- AI hinting with layered fallback behavior
- Responsive UI across phone, tablet, and desktop layouts
- CDN-backed asset delivery for faster production loads

---

## Clone and Run

### Prerequisites
- Node.js **20** (matches the Cloud Functions runtime; `.nvmrc` is checked in — run `nvm use` or `fnm use` to switch)
- npm

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ramonancolon/matchbox-gacha.git
   cd matchbox-gacha
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in the required values. See `.env.example` for descriptions and links to where each key comes from:
   - `VITE_FIREBASE_*` — from your [Firebase Console](https://console.firebase.google.com) project settings
   - Gemini hints use the **`getHint` Cloud Function**; configure `GEMINI_API_KEY` as a Functions secret (see **Deploying `getHint`** below), not in `.env`.

4. **Start local dev (recommended: cloud-backed)**
   ```bash
   npm run dev:cloud
   ```
   - Starts Vite and hits your deployed Firebase services (same path used in production for callable hints).
   - Requires App Check to be configured for local development (see debug token note below).

   Optional alternatives:
   ```bash
   npm run dev          # auto-picks local emulators if Java exists, otherwise dev:cloud
   npm run dev:local    # requires Java; runs Functions + Firestore emulators
   ```

### AI Hint Runtime Notes

The hint system is intentionally layered, but the order depends on how the app is launched:

- **Normal browser tab**: call the Firebase callable **`getHint`**, which runs the Gemini model chain **on the server** (the Gemini API key is **not** in the web bundle). If the cloud call fails or returns no legal move, fall back to a deterministic scripted hint. The browser-local LLM is never loaded in this mode.
- **Installed web app / Chromium PWA**: while the local **Llama 3.2 1B** model (WebLLM/WebGPU) is still downloading or not yet reported ready, hints use **`getHint`** (Gemini on the server) immediately, then the deterministic scripted hint if needed. After the local engine finishes its first-time setup, hints try **local Llama first**, then **`getHint`**, then deterministic logic.

The local model is limited to installed-app contexts because it can require a large first-time model download. Install progress is shown as an inline card **below the Hall of Fame** in the sidebars (not a blocking overlay). Initialization continues in the background; you never wait on WebLLM for a hint while the model is still loading.

### Deploying `getHint` (Gemini on the server)

The Gemini API key is stored as a **Firebase Functions secret**, not in `VITE_*` env vars.

1. Install [Firebase CLI](https://firebase.google.com/docs/cli) and log in (`firebase login`).
2. Set the default project in `.firebaserc` (or run `firebase use <your-project-id>`).
3. Create the secret (you will paste the key when prompted):

   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```

4. Install dependencies and build functions, then deploy:

   ```bash
   cd functions
   npm ci
   npm run build
   cd ..
   firebase deploy --only functions:getHint
   ```

5. Enable **Firebase App Check** for your web app and enforce it for callable requests:

   - In Firebase Console: **Build → App Check**.
   - Register your web app with a provider (typically reCAPTCHA v3).
   - Turn on **enforcement** for Cloud Functions (or at minimum for callable functions).

6. Add your **reCAPTCHA v3 site key** (public) at **build time**:

   - **Local / preview:** in `.env` as `VITE_FIREBASE_APPCHECK_SITE_KEY` (see `.env.example`).
   - **Production (CI):** add the same value as the GitHub Actions secret `VITE_FIREBASE_APPCHECK_SITE_KEY` so the deploy workflow can inject it when it runs `npm run build` (see `.github/workflows/deploy.yml`).

   Do not put the reCAPTCHA **secret** in `VITE_*` variables; that stays in Firebase App Check only.

`getHint` enforces App Check and applies Firestore-backed distributed throttling to reduce abuse across function instances. If App Check is not configured, callable requests will fail and hints will fall back to deterministic logic.

7. (Recommended) Enable Firestore TTL cleanup for rate-limit documents:
   - Collection: `hintRateLimits`
   - TTL field: `expiresAt`

The callable is deployed to **`us-central1`** by default. Override the client region with `VITE_FIREBASE_FUNCTIONS_REGION` if you deploy elsewhere.

**Cloud-backed local dev (recommended):** use `npm run dev:cloud` for day-to-day frontend work against deployed Firebase services.

**Local emulator (optional):** use `npm run dev:local` (Java required) to run Functions + Firestore emulators and keep leaderboard/profile data isolated from production.

**App Check debug tokens (local dev):** App Check enforcement blocks `getHint` from devices without a real App Check token. For `npm run dev:cloud`, register a debug token in Firebase Console under **Build → App Check → Apps → Manage debug tokens** and set `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` in local env (`.env.local` recommended). See Firebase's [debug provider guide](https://firebase.google.com/docs/app-check/web/debug-provider).

### Installed Web App Notes

Production builds include a web app manifest and a minimal service worker so Chromium-based browsers can install Matchbox Gacha as a standalone app. Service worker registration only runs in production; local `npm run dev` sessions are not affected.

---

## Contributing

Use this workflow for every change, no matter how small. The goal is to keep the repo easy to review, easy to reproduce locally, and safe to merge.

1. **Branch from `main`**
   ```bash
   git checkout -b fix/your-change-name
   ```
   Branch names must use one of these prefixes:
   - `docs/` for documentation edits
   - `feature/` for new features; these require unit tests
   - `fix/` for bug fixes
   - `chore/` for config and maintenance edits

2. **Make your change with focused commits**

3. **Add or update tests** for any logic you changed

4. **Run checks locally before opening a PR**
   ```bash
   npm run test
   npm run lint
   npm run build
   ```
   All three must pass. Do not open a PR if any of them fail.
   If the PR changes dependencies or deployment behavior, also run:
   ```bash
   npm audit --audit-level=high --omit=dev
   ```

5. **Bump the version in `package.json`** following semver (see **Versioning** below).

6. **Open a pull request** against `main` with:
   - What changed
   - Why it changed
   - How you tested it
   - The new version and why that bump level was chosen

PRs that skip tests or fail local checks should not be opened.

---

## Versioning

The app follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

Update `package.json` on every merge to `main` using these rules:

| Bump level | When to use it                                                                            | Example changes in this project                                                         |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **MAJOR** (`x.0.0`) | Breaking changes that require users or collaborators to adapt.                    | Removing a theme, changing persisted score format, renaming a required env variable.    |
| **MINOR** (`0.x.0`) | A new user-facing feature, backwards-compatible.                                  | Adding a new theme, adding a new difficulty level, adding the leaderboard, Bunny CDN.   |
| **PATCH** (`0.0.x`) | A backwards-compatible bug fix or small internal improvement, no new features.    | Fixing mobile audio unlock, fixing a broken favicon link, tightening a Firestore rule.  |

Guidelines:

- If a PR contains both a feature and a bug fix, bump at the **higher** level (feature = MINOR wins over PATCH).
- Documentation-only changes (`docs/…` branches) do **not** require a version bump.
- The version should be set in the same commit (or PR) that introduces the change, so `git log` and the version number tell the same story.
- Reset the lower segments to zero when bumping a higher one: `1.4.2` → new feature → `1.5.0`, not `1.5.2`.

If you're unsure which bump level applies, default to the higher one. It is better to over-signal a user-facing change than to under-signal it.

---

## Running Tests

```bash
# Run all tests
npm run test

# Watch mode during development
npm run test:watch

# Coverage report
npm run test:coverage
```

**When adding a new feature:** tests are required, not optional. The PR template will ask for them explicitly. Do not merge without a passing test run.

---

## Project Structure

This is the part of the repo most contributors touch day to day:

```
src/
  assets/           # In-app image / icon / media files (see "Assets" section below)
    ui/             # Chrome: favicons, logos, provider marks (Google, Apple, etc.)
    themes/         # Per-theme art for the card grid
      fruits/       # Fruit & vegetable PNGs (banana, watermelon, etc.)
  components/       # UI components (Card, GameBoard, SignInModal, etc.)
  hooks/            # Shared hooks: game state, modal accessibility, etc.
  services/         # gamePersistenceService, geminiService, localLlmService
  lib/              # Firebase setup, sound utilities
  types.ts          # Shared TypeScript types
```

---

## Assets (images, icons, favicons, logos)

**Regular in-app image assets must live under `src/assets/`.** Do not add UI icons, theme art, card art, or favicons anywhere else in the repo.

The only exception is for fixed-origin files that search engines, crawlers, or security tools must be able to request by an exact URL from the site root. Those are documented in **Use `public/` only for fixed-origin files** below.

Why this rule exists:

- Everything under `src/assets/` goes through Vite's asset pipeline
- Built files receive hashed filenames for cache-busting
- The deployment workflow uploads `dist/assets/` to Bunny CDN automatically
- Assets placed elsewhere will not follow the same path or caching behavior

### Folder layout

`src/assets/` is organized by the role an asset plays, not by file type. Pick the subfolder that matches the asset's purpose:

| Subfolder              | What goes here                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/assets/ui/`       | App chrome: favicons, the Matchbox Gacha logo, auth provider marks (Google, Apple), empty states, etc.  |
| `src/assets/themes/`   | Per-theme card art for the matching grid. Each theme gets its own subfolder with an `index.ts` barrel that imports the images and exports a `<THEME>_IMAGES` map and `<THEME>_NAMES` array. Current themes: `fruits/`. Follow the same pattern to add new ones.       |

Do not create new top-level folders under `src/assets/` without updating this table and the project structure diagram. If an asset does not fit an existing category, propose the new folder in your PR description.

### How to add a new image

1. Drop the file into the correct subfolder (e.g. `src/assets/ui/my-icon.svg` or `src/assets/themes/icons/star.svg`).
2. Import it in the component that uses it:
   ```tsx
   import myIcon from '../assets/ui/my-icon.svg';

   <img src={myIcon} alt="..." />
   ```
3. That's it. On build, Vite emits `dist/assets/my-icon-<hash>.svg` and the deploy workflow uploads it to your configured `VITE_CDN_URL` (for example `https://matchboxgacha.b-cdn.net/assets/my-icon-<hash>.svg`). The subfolder structure in `src/assets/` is for source organization only. At build time everything is flattened into `dist/assets/` with content hashes, so filenames in `src/assets/` must remain unique across subfolders.

### Favicons and `index.html`

The favicon and any other images referenced directly from `index.html` live in `src/assets/ui/` and are referenced with a root-relative path:

```html
<link rel="icon" type="image/svg+xml" href="/src/assets/ui/tabIcon.svg" />
```

Vite rewrites these paths at build time to the hashed, CDN-prefixed URL. Do not reference images from `index.html` via the old `/favicon.svg` (root) pattern — that requires the file to be in `public/` and it will NOT be uploaded to the CDN.

### Use `public/` only for fixed-origin files

The `public/` folder in Vite is only for files that must live at a fixed, unhashed URL on the origin. It bypasses the asset pipeline entirely, which means files there:

- are served from the origin (DreamHost), not the CDN
- do not get content-hashed (bad for cache-busting)
- are not uploaded to Bunny by the `dist/assets` upload step

Allowed `public/` use cases in this project:

- `robots.txt`
- `sitemap.xml`
- `.well-known/security.txt`
- Open Graph social card images at stable URLs (for example `/og-image.svg` or `/og-image.png`)
- Twitter card images only when a stable raster file exists (`.png`, `.jpg`, `.webp`, or `.gif`)

For regular UI imagery (icons, theme art, in-app images), use `src/assets/`.

---

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which:

1. Runs a high-severity production dependency audit for root dependencies.
2. Installs, audits, lints, and builds the `functions/` package (so `getHint` changes are validated in CI).
3. Runs a Firestore Emulator integration test for the distributed limiter (`allowDistributedRequest`) using a `demo-*` Firebase project ID so the step works in fork PRs without secrets.
4. Runs root tests and lint.
5. Builds the app with `VITE_CDN_URL` set, so all asset URLs are rewritten to the CDN.
6. Deploys `functions:getHint` automatically to the configured Firebase project.
7. Uploads every file in `dist/assets/` to Bunny CDN via the Bunny Storage API.
8. Rsyncs the `dist/` folder (including `index.html` and fixed-origin `public/` files) to DreamHost, which serves the HTML entry point from the app origin.

This split is intentional: HTML is served from the origin for a fast first byte, while hashed static assets are served from the Bunny CDN edge.

### Required GitHub repo secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret                          | Value                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `VITE_CDN_URL`                  | Your Bunny pull-zone URL (for example `https://matchboxgacha.b-cdn.net`) |
| `BUNNY_STORAGE_ZONE`            | Bunny storage zone name (e.g. `matchbox-gacha`)                    |
| `BUNNY_PASSWORD`                | Storage zone password (Bunny → Storage Zones → FTP & API Access)   |
| `DREAMHOST_SSH_KEY`             | Private SSH key for the deploy user                                |
| `DREAMHOST_HOST`                | DreamHost server hostname                                          |
| `DREAMHOST_USER`                | SSH username                                                       |
| `DREAMHOST_PATH`                | Absolute path on DreamHost where `dist/` is rsynced                |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON for a Firebase service account with Cloud Functions deploy permissions |
| `VITE_FIREBASE_*` (all eight)   | From Firebase Console → Project Settings                           |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | reCAPTCHA v3 site key for Firebase App Check                     |

Gemini hints are served by the **`getHint` Cloud Function**; configure `GEMINI_API_KEY` with `firebase functions:secrets:set` (see **Deploying `getHint`**). Do **not** add `VITE_GEMINI_API_KEY` to GitHub Actions — it is no longer used by the web build.

The limiter integration test runs in CI through the Firestore emulator and does not require deploy secrets. It uses a `demo-*` Firebase project ID intentionally for offline emulator mode.

> The workflow is configured for a storage zone in **Falkenstein (DE)**, which uses the default `storage.bunnycdn.com` host. If you migrate the zone to another region, update the host in `.github/workflows/deploy.yml` (e.g. `ny.storage`, `la.storage`, `uk.storage`, `sg.storage`, `syd.storage`).

### CDN note

The production app shell is intentionally served same-origin so PWA files (`/manifest.webmanifest`, `/sw.js`) are never rewritten to a CDN origin (which can break installability due to CORS). `VITE_CDN_URL` may still be used by external deploy tooling, but the Vite `base` is pinned to `/` for correctness.

---

## Notes for Contributors

- `.env` is gitignored. Never commit real API keys.
- The `GamePersistenceService` interface abstracts score storage. If you need to change persistence behavior, implement the interface instead of scattering `localStorage` calls.
- The AI hint flow is intentionally mode-aware: normal browser tabs use server-side Gemini (`getHint`), then deterministic logic only. Installed web apps use Gemini until the local model is ready, then browser-local Llama first, then `getHint`, then deterministic logic.
- Regular app image assets belong in `src/assets/`, organized by role (`ui/`, `themes/`, etc.). Only fixed-origin crawler/security files belong in `public/`. See the Assets section above.
