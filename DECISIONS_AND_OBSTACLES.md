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

## Technical Workflow & Tooling
To maintain high velocity while ensuring code quality, I used an AI-augmented development stack:

- **Cursor (Auto Model) for refactoring**: Used for large-scale architectural shifts — decoupling state logic from UI components, generating service interfaces. Fast and consistent across the codebase.
- **Claude CLI for test generation**: Programmatically generated the unit test suite. I reviewed and ran all tests, catching cases where generated tests were asserting against stale behavior.
- **Claude 3.5 Sonnet for finalization**: Used for fine-tuning CSS transitions, hardening Firebase security rules, and performing final logic audits before shipping.

## Obstacles & Friction

- **Navigation Complexity**: Balancing the sticky navigation across mobile and desktop caused several layout regressions. The "Double Sound Icon" and "Full-Width New Game button" were friction points where the CSS mobile-first approach conflicted with specific landscape requirements.
- **Popup Z-Indexing**: The suggestion popup originally sat behind the sticky header. Resolved by re-evaluating the stacking context and moving from negative offsets to positive translations combined with an elevated z-index (`z-[70]`).
- **Firebase Rules**: Hardening Firestore rules to be production-ready while allowing guest score submissions required careful balance — specifically using `exists()` checks to prevent orphan scores from users who delete their accounts.
- **Gemini API model names**: The AI hint fallback chain used deprecated model names that returned 404s. I cross-referenced Google AI Studio documentation to identify the correct current model names (`gemini-2.5-flash`, `gemini-2.5-flash-lite`) before fixing them.
- **Firebase authorized domains**: The deployed app's domain wasn't registered in Firebase Auth, causing sign-in failures. This wasn't a code problem — it required a manual configuration step in the Firebase Console that I hadn't anticipated.

## Tradeoffs

- **Simple game mechanics, production-grade infrastructure**: I prioritized a solid backend, tested codebase, and clean architecture over complex game design. A deeper game would have been faster to ship but harder to collaborate on.
- **Gacha theme is cosmetic**: The "Gacha" portion is currently card themes only. A real gacha system would require an inventory database, item economy, and significantly more scope — determined to be out of range for a Day 1 delivery.
- **Client-side Gemini calls**: The AI hint feature calls the Gemini API directly from the browser. This exposes the API key in the client bundle. The pragmatic tradeoff: this is a game, not a financial application, and the key can be rotated. A server-side proxy would be the right long-term fix.
