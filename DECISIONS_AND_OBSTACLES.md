# Decisions & Obstacles

## Scope & Strategy
The goal was to build a memory game that felt polished rather than tutorial-grade. I focused on **responsive polish** and **shared state that could survive real app behavior** as the primary ways to make the project feel more complete.

The scope was deliberately constrained. Instead of adding deeper game mechanics, I spent that time on infrastructure: cleaner architecture, a real backend, test coverage, and a contributor workflow another developer could actually follow without extra explanation.

## Key Decisions

- **Firebase over LocalStorage**: The brief required local persistence. I implemented LocalStorage first (via a `GamePersistenceService` abstraction), then layered Firebase on top for global leaderboards. The abstraction layer means LocalStorage still works if Firebase is unavailable — it was the right order to build in.
- **Service abstraction for persistence**: Rather than calling `localStorage` directly throughout the app, I introduced a `GamePersistenceService` interface. This costs one extra file but means swapping to a database later is a single implementation change, not a codebase-wide refactor.
- **Pill-Shaped UI**: I moved away from standard rectangular buttons to a pill-shaped, high-density interface to give the game a "mobile-first," high-fidelity app feel. This was a deliberate style choice, not an accident of default components.
- **Tablet Landscape Layout**: Most games default to center-alignment on larger screens. I implemented a custom two-column sidebar layout to maximize screen real estate on tablets in landscape mode — this required a separate layout branch in the CSS, but pays off significantly on iPads and landscape phones.
- **Web Audio API over hosted audio files**: External CDN audio files were returning 403 errors. Rather than host audio files myself, I replaced them with procedurally generated tones via the Web Audio API. No external dependency, no hosting cost, no future availability risk.
- **Bunny CDN for static assets**: I routed built assets through Bunny CDN so JavaScript, CSS, and images are served from the edge instead of directly from the origin server. That improves load speed, reduces pressure on the DreamHost box as traffic grows, and limits how much static-asset traffic hits the origin directly.
- **Layered AI fallback for the suggestion feature**: The in-game AI hint system is intentionally narrow in scope, so I kept the cloud path lightweight with a small Gemini chain. After that, I added a browser-local Llama 3.2 1B fallback via WebLLM/WebGPU, and then a deterministic scripted fallback so the feature never fully disappears.

## Technical Workflow & Tooling
To move quickly without giving up code quality, I used an AI-augmented development stack:

- **Google AI Studio for the initial build**: Used for early implementation direction and the first working version of the app.
- **Cursor Auto / Composer for refactors**: Used for broad restructuring and day-to-day cleanup once the first version existed.
- **Cursor Auto Premium for ADA and SEO**: Used for the accessibility and SEO sweep because those changes touched HTML, CSS, components, hooks, and tests together.
- **Claude CLI for unit test creation**: Used to generate and expand tests quickly around game logic, service behavior, modal flows, and fallback paths.
- **Claude Opus 4.7 for intricate feature refactors**: Used when a change required deeper cross-file reasoning, especially around AI hints, fallback behavior, accessibility hooks, and production hardening.
- **GPT-5.4 with Cursor for documentation**: Used to draft and revise project documentation, contributor instructions, versioning rules, and submission-ready writeups.
- **Gemini Nano Banana 2 for asset generation**: Used to generate the new fruit-theme images. This sped up creation of a cohesive visual set without having to source mismatched stock assets or draw them by hand.

The most effective pattern was to match the tool to the phase of work. I started with **Google AI Studio** for the initial build, used **Auto / Composer** for broad refactors, then switched to **Claude Opus 4.7** when the refactor became intricate enough to need deeper reasoning across hooks, services, tests, and UI behavior. For documentation, **GPT-5.4** produced better results when it had the current implementation details, repo conventions, and target audience instead of just isolated markdown snippets.

## Obstacles & Friction

### Production Hardening (Modals, SEO, CI, Hints)
These showed up during the follow-up pass that tightened accessibility, crawl files, deploy workflow, and hint behavior for real deploys.

- **One source of truth for modals**: Three modals with slightly different Escape, focus, and scroll behavior drifted over time. Consolidating into `useModalA11y` fixed the pattern, but every caller had to align on `dialogRef`, `restoreFocus`, and stable close behavior, and tests had to follow new focus order and accessible names.
- **`aria-hidden` filtering**: A tab trap that skips any element with an `aria-hidden` attribute incorrectly skips nodes that use `aria-hidden="false"` to re-expose content. The implementation had to treat only `aria-hidden="true"` as hidden.
- **Focus vs re-renders**: Inline `onClose` handlers caused the focus-trap effect to re-run and steal focus from inputs. Fixing it inside the hook with an `onClose` ref avoided forcing every parent to memorize callbacks.
- **Twitter card images vs SVG art**: Twitter documents raster formats for card images; pointing `twitter:image` at SVG risked broken previews. Omitting `twitter:image` until a PNG exists was the honest tradeoff, with commented meta tags ready for a future 1200×630 asset.
- **`public/` vs `src/assets/`**: Crawl and security files (`robots.txt`, `sitemap.xml`, `.well-known`, static OG art) must live under `public/` at repo root, not under `src/assets/`. The README rule had to spell out the exception so contributors do not fight Vite.
- **CI on fork PRs**: `GITHUB_TOKEN` for `pull_request` from forks does not expose the same secrets as pushes to the default branch. Deploy steps must stay optional when credentials are missing while lint, test, build, and audit still run.
- **`npm audit` in the pipeline**: `--audit-level=high` is the right bar for production dependency checks, but it creates occasional triage when new advisories land in the ecosystem.
- **Missing `VITE_GEMINI_API_KEY`**: Hint requests used to walk a failing cloud chain when the key was absent. Early exit to local Llama and deterministic fallback improves behavior, but operators need to know misconfiguration is quiet rather than loudly erroring on every hint.

- **Navigation complexity**: Balancing the sticky navigation across mobile and desktop caused several layout regressions. The "double sound icon" and "full-width New Game button" issues came from the mobile-first CSS approach colliding with specific landscape requirements.
- **Popup z-indexing**: The suggestion popup originally rendered behind the sticky header. I fixed that by reworking the stacking context and switching from negative offsets to positive translations with a higher z-index (`z-[70]`).
- **Firebase rules**: Hardening Firestore rules to be production-ready while still allowing guest score submissions required careful balance, especially around `exists()` checks that prevent orphan submissions.
- **Gemini API model names**: The AI hint fallback chain originally used deprecated model names that returned 404s. I cross-referenced Google AI Studio documentation to identify a current working chain before fixing it.
- **Frontend-only local LLM constraints**: Because this project has no dedicated app server, a "local" AI fallback had to run in the browser instead of on the backend. That made WebLLM + WebGPU the practical route, but it also introduced browser-support and first-download tradeoffs.
- **Firebase authorized domains**: The deployed app's domain was not registered in Firebase Auth, so sign-in failed until I fixed the console configuration.
- **Theme asset integration**: Adding the fruits theme was not just a matter of dropping images into the repo. The assets had to be organized correctly, routed through Vite's pipeline, rendered in the card UI, and included in the Bunny CDN deploy flow.
- **CDN deployment wiring**: Bunny CDN improved performance and scaling, but it added setup friction. I had to configure Vite's `base` path, GitHub Actions secrets, Bunny uploads, and the correct regional storage hostname before deploys were reliable.
- **Single-environment deployment pipeline**: To stay within the exercise time box and still ship the core requirements plus the optional global leaderboard, I chose one reliable production pipeline instead of building a separate staging environment.
- **Keeping tests aligned with rapid iteration**: Once AI accelerated feature and bug-fix work, the test suite also had to evolve quickly. That created friction around making sure newly generated tests and older assertions still matched the intended behavior.

## Tradeoffs

- **Simple game mechanics, stronger infrastructure**: I prioritized a solid backend, tested codebase, and cleaner architecture over adding more complicated game systems.
- **The gacha theme is cosmetic**: The "gacha" portion is currently theme-based presentation only. A true gacha system would require inventory, persistence, and economy design that were out of scope.
- **Client-side AI calls**: The hint feature still calls Gemini directly from the browser, which exposes the API key in the client bundle. I accepted that tradeoff for this project because it is a game, not a financial application, and the key can be rotated.
- **Browser-local LLM fallback**: The Llama fallback improves resilience when cloud AI is unavailable, but it depends on WebGPU support and may require a large first-time model download on the triggering device.
- **AI-generated images with human review**: Using Gemini Nano Banana 2 to generate the fruits theme was much faster than creating an original art set manually, but it added a review and selection step before shipping.
- **CDN helps, but does not replace real app security**: Moving static assets to Bunny CDN improves speed and reduces direct origin exposure, but it does not replace Firebase rules, secure deploy credentials, or backend access control.
