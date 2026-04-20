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
  components/       # UI components (Card, GameBoard, SignInModal, etc.)
  hooks/            # useMatchingGame — all core game logic lives here
  services/         # gamePersistenceService, geminiService
  lib/              # Firebase setup, sound utilities
  types.ts          # Shared TypeScript types
```

---

## Notes for Contributors

- `.env` is gitignored. Never commit real API keys.
- The `GamePersistenceService` interface abstracts storage — if you need to change how scores are saved, implement the interface, don't scatter `localStorage` calls.
- The Gemini AI hint feature has a local fallback — if the API is unavailable, the game still works.
