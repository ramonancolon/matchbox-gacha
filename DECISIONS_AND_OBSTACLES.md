# Decisions & Obstacles

## Scope & Strategy
The goal was to build a memory game that felt premium rather than like a generic tutorial project. I chose to focus on **responsive polish** and **global state synchronization** as the primary differentiators.

## Key Decisions
- **Firebase over LocalStorage**: While the brief required local persistence, I made the pragmatic choice to implement a full Firebase backend early. This allowed for a global high score system and user accounts, which significantly strengthened the submission.
- **Pill-Shaped UI**: I moved away from standard rectangular buttons to a pill-shaped, high-density interface. This choice was made to give the game a "mobile-first" high-fidelity app feel.
- **Tablet Landscape Layout**: A critical decision was re-architecting the grid for tablet landscape. Most games default to center-alignment, but I implemented a custom two-column sidebar layout to maximize screen real estate on larger touch devices.

## Obstacles & Friction
- **Navigation Complexity**: Balancing the sticky navigation across mobile and desktop caused several layout regressions. The "Double Sound Icon" and "Full-Width New Game button" were friction points where the CSS mobile-first approach conflicted with specific landscape requirements.
- **Popup Z-Indexing**: The suggestion popup originally sat behind the sticky header. This was resolved by re-evaluating the stacking context and moving from negative offsets to positive translations combined with an elevated z-index (`z-[70]`).
- **Firebase Rules**: Hardening the Firestore rules to be production-ready while allowing guest submissions required careful balance (using `exists()` checks to prevent orphan scores).

## Tradeoffs
- **Custom Game Design**: I prioritized layout and infrastructure over complex game mechanics. The game design (memory match) is simple, but the implementation is production-grade.
- **Gacha Theme**: The "Gacha" portion is currently cosmetic (card themes). A deeper implementation would have required an inventory system, which was out of scope for a "Day 1" delivery.
