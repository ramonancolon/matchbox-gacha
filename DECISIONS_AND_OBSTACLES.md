# Decisions & Obstacles

## Scope & Strategy
The goal was to build a memory game that felt premium rather than like a generic tutorial project. I focused on **responsive polish** and **global state synchronization** as the primary differentiators to elevate the user experience.

The scope was deliberately constrained. Rather than adding complex game mechanics, I invested that time in making the infrastructure solid: clean architecture, a real backend, a tested codebase, and a contributor workflow that a second developer could actually use.

## Key Decisions

- **Firebase over LocalStorage**: The brief required local persistence. I implemented LocalStorage first (via a `GamePersistenceService` abstraction), then layered Firebase on top for global leaderboards. The abstraction layer means LocalStorage still works if Firebase is unavailable — it was the right order to build in.
- **Service abstraction for persistence**: Rather than calling `localStorage` directly throughout the app, I introduced a `GamePersistenceService` interface. This costs one extra file but means swapping to a database later is a single implementation change, not a codebase-wide refactor.
- **Pill-Shaped UI**: I moved away from standard rectangular buttons to a pill-shaped, high-density interface to give the game a "mobile-first," high-fidelity app feel. This was a deliberate style choice, not an accident of default components.
- **Tablet Landscape Layout**: Most games default to center-alignment on larger screens. I implemented a custom two-column sidebar layout to maximize screen real estate on tablets in landscape mode — this required a separate layout branch in the CSS, but pays off significantly on iPads and landscape phones.
- **Web Audio API over hosted audio files**: External CDN audio files were returning 403 errors. Rather than host audio files myself, I replaced them with procedurally generated tones via the Web Audio API. No external dependency, no hosting cost, no future availability risk.
- **Bunny CDN for static assets**: I routed built assets through Bunny CDN so JavaScript, CSS, and images are served from the edge instead of directly from the origin server. That improves load speed, reduces pressure on the DreamHost box as traffic grows, and limits how much static-asset traffic hits the origin directly.
- **Gemini for the suggestion feature**: The in-game AI hint system is intentionally narrow in scope, so I chose Gemini models as a pragmatic cost/performance fit. The feature only needs short, situational suggestions, not heavyweight generation, so cheaper models were the right tradeoff.

## Technical Workflow & Tooling
To maintain high velocity while ensuring code quality, I used an AI-augmented development stack:

- **Claude Sonnet 4.6 with Cursor for further edits and small changes**: Used for iterative follow-up edits, smaller refactors, and polishing passes once the main structure was in place.
- **GPT-5.4 with Cursor for documentation**: Used to draft and revise project documentation, contributor instructions, versioning rules, and submission-ready writeups.
- **Claude Opus 4.7 for bug fixes and new major features**: Used on the higher-complexity work — shipping larger features, fixing implementation bugs, and updating behavior when multiple parts of the codebase had to move together.
- **AI-assisted test generation and updates**: This included both creating new test cases and modifying existing tests when behavior changed. I still reviewed the test logic myself and re-ran the full suite before treating it as valid.
- **Gemini Nano Banana 2 for asset generation**: Used to generate the new fruit-theme images. This sped up creation of a cohesive visual set without having to source mismatched stock assets or draw them by hand.

## Obstacles & Friction

- **Navigation Complexity**: Balancing the sticky navigation across mobile and desktop caused several layout regressions. The "Double Sound Icon" and "Full-Width New Game button" were friction points where the CSS mobile-first approach conflicted with specific landscape requirements.
- **Popup Z-Indexing**: The suggestion popup originally sat behind the sticky header. Resolved by re-evaluating the stacking context and moving from negative offsets to positive translations combined with an elevated z-index (`z-[70]`).
- **Firebase Rules**: Hardening Firestore rules to be production-ready while allowing guest score submissions required careful balance — specifically using `exists()` checks to prevent orphan scores from users who delete their accounts.
- **Gemini API model names**: The AI hint fallback chain used deprecated model names that returned 404s. I cross-referenced Google AI Studio documentation to identify the correct current model names (`gemini-2.5-flash`, `gemini-2.5-flash-lite`) before fixing them.
- **Firebase authorized domains**: The deployed app's domain wasn't registered in Firebase Auth, causing sign-in failures. This wasn't a code problem — it required a manual configuration step in the Firebase Console that I hadn't anticipated.
- **Theme asset integration**: Adding the fruits theme was not just a matter of dropping images into the repo. The new assets had to be organized into the theme folder structure, routed through Vite's asset pipeline, rendered correctly in cards, and included in the Bunny CDN deploy flow. AI helped generate and iterate on the images, but I still had to manually wire the code and verify the build output.
- **CDN deployment wiring**: Bunny CDN improved performance and scaling, but it added deployment friction. I had to configure Vite's `base` path, GitHub Actions secrets, Bunny storage uploads, and the correct regional storage hostname before the deploys worked reliably.
- **Keeping tests aligned with rapid iteration**: Once AI accelerated feature and bug-fix work, the test suite also had to evolve quickly. That created friction around making sure newly generated test cases and edits to older tests still matched the intended behavior rather than freezing outdated assumptions in place.

## Tradeoffs

- **Simple game mechanics, production-grade infrastructure**: I prioritized a solid backend, tested codebase, and clean architecture over complex game design. A deeper game would have been faster to ship but harder to collaborate on.
- **Gacha theme is cosmetic**: The "Gacha" portion is currently card themes only. A real gacha system would require an inventory database, item economy, and significantly more scope — determined to be out of range for a Day 1 delivery.
- **Client-side Gemini calls**: The AI hint feature calls the Gemini API directly from the browser. This exposes the API key in the client bundle. The pragmatic tradeoff: this is a game, not a financial application, and the key can be rotated. A server-side proxy would be the right long-term fix.
- **AI-generated images with human review**: Using Gemini Nano Banana 2 to generate the fruits theme was much faster than creating an original art set manually, but it introduced a review step. I accepted the tradeoff because I manually checked the final images for consistency and then verified the code paths, asset names, and prompts before wiring the theme into production.
- **CDN helps, but does not replace real app security**: Moving static assets to Bunny CDN improves speed and reduces direct origin exposure, but it is not a substitute for Firebase rules, secure deploy credentials, or proper backend access control. I used it as an operational hardening step, not as the main security model.
