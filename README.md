# Matchbox Gacha

A browser-based memory matching game with local high score persistence, a global leaderboard, AI-powered move suggestions, and responsive design across mobile, tablet, and desktop.

Built as part of the Vibe Coder Exercise.

**Live URL**: https://matchboxgacha.games
**Repo URL**: https://github.com/ramonancolon/matchbox-gacha.git
**Stack**: React, TypeScript, Tailwind CSS, Firebase, Vite

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
   - `VITE_GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com)
   - `VITE_FIREBASE_*` — from your [Firebase Console](https://console.firebase.google.com) project settings

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:3000`.

---

## Contributing

Use this workflow for every change, no matter how small. Collaborators should create a branch from `main` and open a pull request back into `main`.

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

5. **Open a pull request** against `main` with:
   - What changed
   - Why it changed
   - How you tested it

PRs that skip tests or don't pass lint will not be merged.

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

```
src/
  assets/           # ALL image / icon / media files (see "Assets" section below)
    ui/             # Chrome: favicons, logos, provider marks (Google, Apple, etc.)
    themes/         # Per-theme art for the card grid
      fruits/       # Fruit & vegetable PNGs (banana, watermelon, etc.)
  components/       # UI components (Card, GameBoard, SignInModal, etc.)
  hooks/            # useMatchingGame — all core game logic lives here
  services/         # gamePersistenceService, geminiService
  lib/              # Firebase setup, sound utilities
  types.ts          # Shared TypeScript types
```

---

## Assets (images, icons, favicons, logos)

**All static image assets MUST live under `src/assets/`.** This is a hard rule — do not add images anywhere else in the repo, and do not use the `public/` folder for images.

Why: every file under `src/assets/` flows through Vite's build pipeline and ends up in `dist/assets/` with a content-hashed filename. The deploy workflow automatically uploads everything in `dist/assets/` to Bunny CDN, so anything you put in `src/assets/` is served from the CDN in production with zero extra configuration.

### Folder layout

`src/assets/` is organized by the role an asset plays, not by file type. Pick the subfolder that matches the asset's purpose:

| Subfolder              | What goes here                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/assets/ui/`       | App chrome: favicons, the Matchbox Gacha logo, auth provider marks (Google, Apple), empty states, etc.  |
| `src/assets/themes/`   | Per-theme card art for the matching grid. Each theme gets its own subfolder with an `index.ts` barrel that imports the images and exports a `<THEME>_IMAGES` map and `<THEME>_NAMES` array. Current themes: `fruits/`. Follow the same pattern to add new ones.       |

Do not create new top-level folders under `src/assets/` without updating this table and the project structure diagram. If an asset doesn't fit an existing category, propose a new subfolder in your PR description.

### How to add a new image

1. Drop the file into the correct subfolder (e.g. `src/assets/ui/my-icon.svg` or `src/assets/themes/icons/star.svg`).
2. Import it in the component that uses it:
   ```tsx
   import myIcon from '../assets/ui/my-icon.svg';

   <img src={myIcon} alt="..." />
   ```
3. That's it. On build, Vite emits `dist/assets/my-icon-<hash>.svg` and the deploy workflow uploads it to `https://matchbox-gacha.b-cdn.net/assets/my-icon-<hash>.svg` automatically. The subfolder structure in `src/assets/` is for source organization only — at build time everything is flattened into `dist/assets/` with content hashes, so filenames in `src/assets/` must remain unique across subfolders.

### Favicons and `index.html`

The favicon and any other images referenced directly from `index.html` live in `src/assets/ui/` and are referenced with a root-relative path:

```html
<link rel="icon" type="image/svg+xml" href="/src/assets/ui/tabIcon.svg" />
```

Vite rewrites these paths at build time to the hashed, CDN-prefixed URL. Do not reference images from `index.html` via the old `/favicon.svg` (root) pattern — that requires the file to be in `public/` and it will NOT be uploaded to the CDN.

### Do NOT use `public/`

The `public/` folder in Vite is for files that must live at a fixed, unhashed URL on the origin (e.g. `robots.txt`, `sitemap.xml`). It bypasses the asset pipeline entirely, which means files there:

- are served from the origin (DreamHost), not the CDN,
- do not get content-hashed (bad for cache-busting),
- will not be picked up by the Bunny upload step.

If you find yourself wanting to put an image in `public/`, stop and put it in the appropriate `src/assets/` subfolder instead.

---

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which:

1. Runs tests and lint.
2. Builds the app with `VITE_CDN_URL` set, so all asset URLs are rewritten to the CDN.
3. Uploads every file in `dist/assets/` to Bunny CDN via the Bunny Storage API.
4. Rsyncs the `dist/` folder (including `index.html`) to DreamHost, which serves the HTML entry point from the app origin.

The split is intentional: HTML is served from origin (fast first byte, no CDN DNS hop for the initial request), and all hashed assets (JS, CSS, images, fonts) come from the Bunny CDN edge.

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
| `VITE_GEMINI_API_KEY`           | From Google AI Studio                                              |
| `VITE_FIREBASE_*` (all nine)    | From Firebase Console → Project Settings                           |

> The workflow is configured for a storage zone in **Falkenstein (DE)**, which uses the default `storage.bunnycdn.com` host. If you migrate the zone to another region, update the host in `.github/workflows/deploy.yml` (e.g. `ny.storage`, `la.storage`, `uk.storage`, `sg.storage`, `syd.storage`).

### Local CDN builds

`VITE_CDN_URL` in `.env` only applies when you run `npm run build` locally. For `npm run dev`, leave it unset — Vite will serve assets from `/` as normal.

---

## Notes for Contributors

- `.env` is gitignored. Never commit real API keys.
- The `GamePersistenceService` interface abstracts storage — if you need to change how scores are saved, implement the interface, don't scatter `localStorage` calls.
- The Gemini AI hint feature has a local fallback — if the API is unavailable, the game still works.
- All image assets go in `src/assets/`, organized by role (`ui/`, `themes/`, etc.). See the Assets section above.
