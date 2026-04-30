# AI Usage

AI was a development accelerator throughout this project, but not a substitute for verification. This document explains where it helped, what kind of work it handled well, and what I still reviewed manually before shipping.

## How AI Was Used

### Architecture & Refactoring
I used different tools and models for different phases of the project:

- **Google AI Studio** for the initial build and early implementation direction
- **Cursor Auto / Composer** for broad refactors, day-to-day code reshaping, and unit test creation/expansion
- **Cursor Auto Premium** for the ADA/accessibility and SEO pass
- **Gemini 3.1 Pro Preview Agent** for tightly scoped single-file refactors before Opus validation
- **Claude Opus 4.7** for intricate feature refactors where multiple files and behaviors had to move together
- **Google AI Studio + Cursor** for documentation drafting and first-pass documentation structure
- **GPT-5.4 with Cursor** for final documentation validation, refactoring, and clarity passes across multiple markdown files
- **Claude CLI (Opus)** for final execution-review passes on test/build output and diffs before deploy

Across the implementation work, AI helped refactor a monolithic `App.tsx` into a more modular architecture:
- Extracted all game logic into a `useMatchingGame` custom hook
- Introduced a `GamePersistenceService` interface to abstract LocalStorage, making a future database swap straightforward
- Created a `GameBoard` component to separate rendering from state

This was the highest-leverage use of AI. Large structural changes that would have taken hours manually were completed much faster, and the resulting patterns stayed more consistent across the codebase.

My usual workflow was to start with **Google AI Studio** for the first implementation pass, use **Cursor Auto / Composer** for broad refactors and test generation, then bring in **Claude Opus 4.7 in Cursor** to audit and tighten higher-risk cross-file behavior. For tightly scoped single-file edits, I often used a **Gemini 3.1 Pro Preview agent** first and then ran an Opus check immediately after before accepting the change.

For difficult Cursor tasks, I got better results when I added more context up front: related files, current implementation details, known constraints, recent failures, and the exact behavior I wanted preserved. The harder the task, the more important that context became. It helped Cursor and Opus reason across the whole feature instead of optimizing one file in isolation.

### Workflow Quality Gates
I used a layered review loop to reduce regression risk while keeping iteration speed high:

- **Cursor + Opus (Code Check):** after Gemini or Cursor Auto generated initial edits, I used Opus in Cursor to review logic, catch edge cases, and apply targeted diffs while staying in the editor flow.
- **Gemini 3.1 Pro Preview Agent (Single-file Refactors):** for tightly scoped single-file edits, I used a Gemini 3.1 Pro Preview agent first, then ran a Cursor Opus check immediately after to validate logic and edge cases before keeping the change.
- **CLI + Opus (Execution Check):** before CI/deploy, I used Claude CLI (Opus) to review test/build output and diffs (for example: checking `App.tsx` test runs for hidden failures, warnings, or path regressions) before the GitHub workflow took over.
- **GPT in Cursor (Documentation Check):** once code and runtime checks passed, I used GPT in Cursor for final documentation consistency and clarity sweeps.

### Unit Test Generation
I used **Cursor** as the primary tool for unit test creation and expansion, especially when a feature or bug fix needed fast coverage across happy paths, edge cases, and fallback behavior. I used **Claude Opus 4.7 in Cursor** to review and adjust generated tests when they were tied to broader feature refactors. That work covered:
- Core game logic (card matching, scoring, timer)
- The AI hint service (including cloud, local, and deterministic fallback behavior)
- The Firebase sign-in modal flow
- New theme-related behavior such as the fruits theme

I did not just accept the tests as written. I reviewed each test file, ran the suite, and caught cases where generated tests were still asserting against outdated behavior after implementation changes. That included both brand new tests and edits to older assertions when the intended behavior changed.

### Debugging & Problem Solving
When I hit blockers I didn't immediately know how to solve, I used AI to close the knowledge gap quickly:
- **Firebase `auth/unauthorized-domain`**: I didn't know the exact Firebase Console flow to add an authorized domain. I asked AI, got the exact steps, and verified it manually in the console.
- **Audio 403 errors**: External CDN audio URLs were returning 403. AI suggested replacing them with the Web Audio API — I evaluated the tradeoff (no files to host, no external dependency) and approved it.
- **Gemini API 404 errors**: The model names in the server-side `getHint` fallback chain were wrong. AI gave me candidate names; I cross-referenced against Google AI Studio documentation before updating them.
- **Browser-local LLM in the installed app**: AI helped evaluate whether a local model was realistic in a frontend-only app, which led to browser-side Llama 3.2 1B via WebLLM and WebGPU. I later limited it to the installed web app path so normal browser tabs never download the large local model.
- **Bunny CDN deployment setup**: AI helped me wire Vite's CDN base path and the GitHub Actions upload flow for Bunny storage. I still manually verified the correct storage hostname, secrets, built asset URLs, and final deploy behavior.

The pattern that worked best here was to use AI for orientation first, then switch to narrower, verification-focused follow-ups once I understood the shape of the problem. That kept the generated suggestions useful without letting them drift into confident but unverified guesses.

### AI Hint Model Choice
I chose a **mode-aware layered hint strategy** for the in-game suggestion feature:

- In a normal browser tab, call the Firebase callable **`getHint`**, which runs the Gemini chain on the server so the Gemini API key is not shipped in the web bundle.
- If `getHint` is unavailable or returns no legal move in a normal tab, fall back to a deterministic scripted hint. The browser-local LLM is never loaded there.
- In the installed web app / Chromium PWA, use **`getHint`** while the local **Llama 3.2 1B** engine (WebLLM/WebGPU) is still downloading or not yet ready; once ready, try **local inference first**.
- If the local model is unavailable, not ready yet, or produces an unusable response in the installed app, fall back to **`getHint`** and then the deterministic scripted hint.

That approach keeps normal web sessions lightweight and keeps the Gemini key server-side, while giving installed-app users **Gemini-backed hints during the first-time local download** and a **local-first** path after the model is warmed. The hint UI does not block on WebLLM init; progress is shown inline under the Hall of Fame.

### Asset Generation
I used **Gemini Nano Banana 2** to generate the fruit-theme images that power the new `fruits` card theme.

- AI helped create the initial fruit and produce illustrations quickly enough to make a full theme practical within scope.
- I did not treat the first outputs as final. I iterated with new prompts until the images were consistent enough to use together as a set.
- After generation, I manually selected, named, organized, and integrated the final assets into `src/assets/themes/fruits/`.

### Firebase Security Rules
AI drafted the Firestore security rules. I reviewed the logic manually — specifically the `exists()` checks that prevent orphan score submissions — before deploying them.

### Documentation Acceleration
I used **Google AI Studio + Cursor** for first-pass documentation drafting, then used **GPT-5.4 with Cursor** for final validation and restructuring:
- Drafting and revising `README.md`, `DECISIONS_AND_OBSTACLES.md`, and `AI_USAGE.md`
- Tightening contributor instructions so another developer could clone the repo, make a branch, run checks, and open a PR without extra explanation
- Rewriting sections for clarity and cohesion so the docs matched the exercise rubric rather than reading like disconnected project notes

For documentation work, GPT-5.4 performed best as a final-pass checker when I gave it more context than just the file being edited. The strongest results came from providing the surrounding repo conventions, contributor workflow, current implementation details, and intended audience, then using GPT to validate consistency and clarity after the initial draft existed.

### Accessibility & SEO Refactor
I used **Cursor Auto Premium** to run the ADA/accessibility and SEO hardening pass, then used **Claude Opus 4.7** for the more intricate refactor decisions that needed deeper cross-file reasoning. The accessibility and SEO work was not localized — it touched `index.html`, global CSS, `App.tsx`, every modal component, the leaderboard, the game board, the shared hooks directory, and the test suite simultaneously.

Concretely, that work included:
- Auditing and adding ARIA labeling, `aria-pressed` state, live regions, and semantic landmarks across the app
- Normalizing modal accessibility (dialog roles, initial focus, Escape-to-close, focus restoration) behind a new shared `useModalA11y` hook so the pattern lives in one file instead of three
- Rewriting SEO meta in `index.html` (title, description, canonical, Open Graph, Twitter, `theme-color`) and catching a production bug where social-card image URLs were pointing at dev-only `/src/assets/...` paths that Vite does not rewrite
- Scoping `aria-busy` to the hint button instead of the app root, promoting the wordmark to a real `<h1>`, and adding a durable skip-link CSS rule so it does not depend on Tailwind class scanning of `index.html`
- Updating the test suite to use accessible role-based queries instead of icon-based heuristics

Auto Premium helped move quickly across the broad ADA/SEO surface, while Opus was useful for the deeper follow-up refactors where consistency mattered more than speed. That combination made it possible to apply a single consistent a11y pattern across everything, catch cross-file inconsistencies (like three modals each implementing focus/Escape slightly differently), and keep the SEO and a11y changes stylistically unified rather than layered on as disconnected one-off edits.

### Production Hardening (Follow-up Pass)
After the first accessibility and SEO pass, I used **Claude Opus 4.7 in Cursor** again (with Max Mode where the diff spanned many files) to do a deeper **production hardening** sweep: unify patterns, fix correctness issues, and tighten CI and runtime behavior.

What shipped in that pass:

- **`useModalA11y` deepened**: tab focus trapping inside the dialog container, body scroll lock while a modal is open, stable `onClose` via ref so re-renders do not steal focus from inputs, and a corrected `aria-hidden` filter (only treat `aria-hidden="true"` as hidden — `false` is a valid visibility override).
- **Hint service resilience**: cloud hints go through the Firebase callable `getHint`, so the Gemini API key is **not** in the web bundle. If `getHint` is not deployed or the `GEMINI_API_KEY` secret is missing, the callable fails and the app falls back to deterministic hints (installed apps rely on `getHint` until the local model is ready, then prefer local when it returns a valid move).
- **SEO and crawlability files under `public/`**: `robots.txt`, `sitemap.xml`, stable `og-image.svg` for Open Graph, `security.txt` and `.well-known/security.txt` for responsible disclosure. `README.md` was updated to document when `public/` is allowed versus `src/assets/`.
- **Twitter card image policy**: `twitter:image` was removed when using SVG-only art because Twitter's documented supported formats are JPG, PNG, WEBP, and GIF — pointing at SVG would fail silently. `index.html` includes an HTML comment with the exact meta tags to add when a 1200×630 PNG ships.
- **Structured data**: JSON-LD (`VideoGame`) in `index.html` for richer search snippets where parsers support it.
- **CI/CD hardening** (`.github/workflows/deploy.yml`): least-privilege `permissions`, deploy concurrency group, job timeouts, non-persistent checkout credentials, `npm audit --audit-level=high --omit=dev` on production dependencies, and shorter artifact retention.

I used AI to propose the checklist and draft the diffs, then **verified locally** with `npm run test`, `npm run lint`, and `npm run build` before treating the pass as done. I also re-read the final diff for cross-file consistency (for example, one hook owning modal behavior instead of three slightly different implementations).

### Documentation Updates for Hardening
I used **GPT-5.4 with Cursor** (with broader repo context pasted in or attached) to refresh `README.md`, `DECISIONS_AND_OBSTACLES.md`, and this `AI_USAGE.md` so contributor-facing docs match the new `public/` exceptions, CI behavior, and how AI was used on the hardening work — not just what changed in code.

### Onboarding & Deploy Automation Follow-up
In a later follow-up pass, I used AI to streamline contributor onboarding and reduce setup mistakes:

- Updated local guidance to center `npm run dev:cloud` as the primary frontend workflow, with emulator mode available as an optional path.
- Updated CI/deploy workflow to auto-deploy `functions:getHint` on push, authenticated by a GitHub secret service account key (`FIREBASE_SERVICE_ACCOUNT_JSON`).
- Updated docs so new contributors can start locally without production credentials, and maintainers can still promote backend changes automatically through the pipeline.

## What I Verified Manually

I did not treat AI output as correct by default. Specific things I checked myself:

- **Model names and hint fallback order**: AI gave me candidate model names and fallback ideas, but I verified the final server-side `getHint` Gemini chain, installed-app behavior (Gemini until local model ready, then local-first), and normal-browser no-local path myself before accepting the change.
- **Firebase Auth flow**: Tested sign-in with Google and email/password across browsers. Caught a soft-lock bug (modal stuck after closing the popup) that required a targeted fix.
- **Responsive layout**: Manually tested on mobile, tablet landscape, and desktop. The two-column sidebar layout required several manual iterations — AI gave me the structure, I adjusted the breakpoints by eye.
- **Environment variable setup**: Verified that `.env` was gitignored and that the app correctly read all `VITE_*` keys before pushing.
- **Analytics events**: Confirmed Firebase Analytics events were firing correctly in the Firebase dashboard. AI wrote the logging calls; I confirmed they were reaching the backend.
- **Documentation accuracy**: I reviewed the docs after AI drafting to make sure setup steps, branch naming rules, testing requirements, and repo links matched the actual project and exercise requirements.
- **Fruit-theme code integration**: I manually reviewed the code changes that wired the new `fruits` theme into the settings UI, card-generation logic, image rendering path, tests, and build output.
- **Fruit-theme images**: I manually reviewed the generated fruit images before keeping them, then verified that the final selected files were named correctly, placed in the right theme folder, emitted into `dist/assets/`, and rendered correctly in the app.
- **Prompt iteration**: I verified the image work both through manual code edits and through additional prompting. AI helped generate and revise the image set, but I personally checked the results at each step before accepting them.
- **CDN behavior**: I manually verified that built assets were rewritten to the Bunny CDN URL, that the hashed files landed in `dist/assets/`, and that the deployment setup improved asset delivery speed while keeping static traffic off the origin as much as practical.
- **Test coverage changes**: I manually reviewed and ran the tests after AI-generated additions or updates, including new test cases and changes to existing assertions where the implementation had evolved.
- **Production hardening**: Re-ran the full test, lint, and build pipeline after the CI workflow and modal focus-trap changes; read the updated workflow YAML to confirm permissions, audit step, and artifact retention matched intent; spot-checked `index.html` and `public/` files for valid URLs and comments where platform limits apply (for example, Twitter image formats).

In practice, my rule was simple: the more a change touched architecture, external services, or user-facing behavior, the less I trusted AI output without running the code and reading the final diff carefully.

## Where AI Helped Most

The biggest win was **speed on unfamiliar ground**. I didn't know every Firebase permission model, Vite environment variable convention, or Web Audio API detail going in. Using AI to get oriented quickly — then verifying the critical parts myself — let me ship a production-grade result on a short timeline without cutting corners that mattered.

The rule I applied: let AI handle the acceleration, then manually verify anything that touches security, external APIs, user-facing behavior, or shipped assets before it goes live. That included both the code and the generated fruit images, with final validation done through hands-on review, manual code edits, and follow-up prompts where needed.
