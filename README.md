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
- Node.js v18+
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
   - `VITE_GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com), required only for Gemini-powered cloud hints
   - `VITE_FIREBASE_*` — from your [Firebase Console](https://console.firebase.google.com) project settings

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:3000`.

### AI Hint Runtime Notes

The hint system is intentionally layered so the feature still works when cloud AI is unavailable or `VITE_GEMINI_API_KEY` is not configured:

1. Try a small Gemini model chain first
2. Fall back to browser-local Llama 3.2 1B via WebLLM/WebGPU
3. Fall back again to a deterministic scripted hint

This means the game still provides hints even if Gemini is unavailable, but the browser-local fallback depends on WebGPU support and may require a large first-time model download on the device that triggers it.

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
3. That's it. On build, Vite emits `dist/assets/my-icon-<hash>.svg` and the deploy workflow uploads it to `https://matchbox-gacha.b-cdn.net/assets/my-icon-<hash>.svg` automatically. The subfolder structure in `src/assets/` is for source organization only. At build time everything is flattened into `dist/assets/` with content hashes, so filenames in `src/assets/` must remain unique across subfolders.

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

1. Runs a high-severity production dependency audit with `npm audit --audit-level=high --omit=dev`.
2. Runs tests and lint.
3. Builds the app with `VITE_CDN_URL` set, so all asset URLs are rewritten to the CDN.
4. Uploads every file in `dist/assets/` to Bunny CDN via the Bunny Storage API.
5. Rsyncs the `dist/` folder (including `index.html` and fixed-origin `public/` files) to DreamHost, which serves the HTML entry point from the app origin.

This split is intentional: HTML is served from the origin for a fast first byte, while hashed static assets are served from the Bunny CDN edge.

### Required GitHub repo secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret                          | Value                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `VITE_CDN_URL`                  | `https://matchbox-gacha.b-cdn.net`                                 |
| `BUNNY_STORAGE_ZONE`            | Bunny storage zone name (e.g. `matchbox-gacha`)                    |
| `BUNNY_PASSWORD`                | Storage zone password (Bunny → Storage Zones → FTP & API Access)   |
| `DREAMHOST_SSH_KEY`             | Private SSH key for the deploy user                                |
| `DREAMHOST_HOST`                | DreamHost server hostname                                          |
| `DREAMHOST_USER`                | SSH username                                                       |
| `DREAMHOST_PATH`                | Absolute path on DreamHost where `dist/` is rsynced                |
| `VITE_GEMINI_API_KEY`           | From Google AI Studio; optional for fallback-only hints             |
| `VITE_FIREBASE_*` (all eight)   | From Firebase Console → Project Settings                           |

> The workflow is configured for a storage zone in **Falkenstein (DE)**, which uses the default `storage.bunnycdn.com` host. If you migrate the zone to another region, update the host in `.github/workflows/deploy.yml` (e.g. `ny.storage`, `la.storage`, `uk.storage`, `sg.storage`, `syd.storage`).

### Local CDN builds

`VITE_CDN_URL` in `.env` only applies when you run `npm run build` locally. For `npm run dev`, leave it unset — Vite will serve assets from `/` as normal.

---

## Notes for Contributors

- `.env` is gitignored. Never commit real API keys.
- The `GamePersistenceService` interface abstracts score storage. If you need to change persistence behavior, implement the interface instead of scattering `localStorage` calls.
- The AI hint flow is intentionally layered: Gemini first, browser-local Llama second, deterministic logic last.
- Regular app image assets belong in `src/assets/`, organized by role (`ui/`, `themes/`, etc.). Only fixed-origin crawler/security files belong in `public/`. See the Assets section above.
