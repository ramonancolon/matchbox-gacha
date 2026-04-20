# AI Usage

AI was my primary development accelerator throughout this project. This document explains exactly where it was used, what it produced, and what I personally verified before shipping.

## How AI Was Used

### Architecture & Refactoring
I used Cursor (Auto model) to refactor a monolithic `App.tsx` into a clean, modular architecture:
- Extracted all game logic into a `useMatchingGame` custom hook
- Introduced a `GamePersistenceService` interface to abstract LocalStorage, making a future database swap straightforward
- Created a `GameBoard` component to separate rendering from state

This was the highest-leverage use of AI — large-scale structural changes that would have taken hours manually were completed in minutes, with consistent patterns applied across the codebase.

### Unit Test Generation
I used the Claude CLI to generate a comprehensive test suite covering:
- Core game logic (card matching, scoring, timer)
- The Gemini AI hint service (including fallback behavior)
- The Firebase sign-in modal flow

I did not just accept the tests as written. I reviewed each test file, ran them, and caught cases where the generated tests were asserting against outdated behavior after I had changed the implementation.

### Debugging & Problem Solving
When I hit blockers I didn't immediately know how to solve, I used AI to close the knowledge gap quickly:
- **Firebase `auth/unauthorized-domain`**: I didn't know the exact Firebase Console flow to add an authorized domain. I asked AI, got the exact steps, and verified it manually in the console.
- **Audio 403 errors**: External CDN audio URLs were returning 403. AI suggested replacing them with the Web Audio API — I evaluated the tradeoff (no files to host, no external dependency) and approved it.
- **Gemini API 404 errors**: The model names in the fallback chain were wrong. AI gave me candidate names; I cross-referenced against Google AI Studio documentation before updating them.

### Firebase Security Rules
AI drafted the Firestore security rules. I reviewed the logic manually — specifically the `exists()` checks that prevent orphan score submissions — before deploying them.

### Documentation Acceleration
I also used AI to speed up documentation writing and revision:
- Drafting the initial versions of `README.md`, `DECISIONS_AND_OBSTACLES.md`, and `AI_USAGE.md`
- Tightening contributor instructions so another developer could clone the repo, make a branch, run checks, and open a PR without extra explanation
- Rewriting sections for clarity and conciseness so the docs matched the exercise rubric rather than reading like generic project notes

## What I Verified Manually

I did not treat AI output as correct by default. Specific things I checked myself:

- **Model names in `geminiService.ts`**: AI gave me model names that were wrong (deprecated). I verified against the live Google AI Studio API before accepting the fix.
- **Firebase Auth flow**: Tested sign-in with Google and email/password across browsers. Caught a soft-lock bug (modal stuck after closing the popup) that required a targeted fix.
- **Responsive layout**: Manually tested on mobile, tablet landscape, and desktop. The two-column sidebar layout required several manual iterations — AI gave me the structure, I adjusted the breakpoints by eye.
- **Environment variable setup**: Verified that `.env` was gitignored and that the app correctly read all `VITE_*` keys before pushing.
- **Analytics events**: Confirmed Firebase Analytics events were firing correctly in the Firebase dashboard. AI wrote the logging calls; I confirmed they were reaching the backend.
- **Documentation accuracy**: I reviewed the docs after AI drafting to make sure setup steps, branch naming rules, testing requirements, and repo links matched the actual project and exercise requirements.

## Where AI Helped Most

The biggest win was **speed on unfamiliar ground**. I didn't know every Firebase permission model, Vite environment variable convention, or Web Audio API detail going in. Using AI to get oriented quickly — then verifying the critical parts myself — let me ship a production-grade result on a short timeline without cutting corners that mattered.

The rule I applied: let AI handle the implementation, verify anything that touches security, external APIs, or user-facing behavior before it goes live.
