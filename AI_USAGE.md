# AI Usage

AI was my primary development accelerator throughout this project. This document explains exactly where it was used, what it produced, and what I personally verified before shipping.

## How AI Was Used

### Architecture & Refactoring
I used **Claude Sonnet 4.6 with Cursor** for follow-up edits and smaller iterative changes across the codebase, and **Claude Opus 4.7** for bug fixes and larger feature work. I also used **GPT-5.4 with Cursor** heavily for documentation drafting and revision.

Across the implementation work, AI helped refactor a monolithic `App.tsx` into a clean, modular architecture:
- Extracted all game logic into a `useMatchingGame` custom hook
- Introduced a `GamePersistenceService` interface to abstract LocalStorage, making a future database swap straightforward
- Created a `GameBoard` component to separate rendering from state

This was the highest-leverage use of AI — large-scale structural changes that would have taken hours manually were completed in minutes, with consistent patterns applied across the codebase.

### Unit Test Generation
I used **Claude Opus 4.7** for bug-fix and feature work that also required test coverage, including both creating new test cases and updating existing ones when behavior changed. That work covered:
- Core game logic (card matching, scoring, timer)
- The Gemini AI hint service (including fallback behavior)
- The Firebase sign-in modal flow
- New theme-related behavior such as the fruits theme

I did not just accept the tests as written. I reviewed each test file, ran them, and caught cases where generated tests were asserting against outdated behavior after I had changed the implementation. That included both brand new test cases and edits to existing tests when features or fixes changed the expected behavior.

### Debugging & Problem Solving
When I hit blockers I didn't immediately know how to solve, I used AI to close the knowledge gap quickly:
- **Firebase `auth/unauthorized-domain`**: I didn't know the exact Firebase Console flow to add an authorized domain. I asked AI, got the exact steps, and verified it manually in the console.
- **Audio 403 errors**: External CDN audio URLs were returning 403. AI suggested replacing them with the Web Audio API — I evaluated the tradeoff (no files to host, no external dependency) and approved it.
- **Gemini API 404 errors**: The model names in the fallback chain were wrong. AI gave me candidate names; I cross-referenced against Google AI Studio documentation before updating them.
- **Browser-local LLM fallback**: AI helped evaluate whether a local fallback was realistic in a frontend-only app, which led to a browser-side Llama 3.2 1B fallback via WebLLM and WebGPU after the Gemini chain is exhausted.
- **Bunny CDN deployment setup**: AI helped me wire Vite's CDN base path and the GitHub Actions upload flow for Bunny storage. I still manually verified the correct storage hostname, secrets, built asset URLs, and final deploy behavior.

### AI Hint Model Choice
I chose a **layered hint strategy** for the in-game suggestion feature:

- Try a small Gemini chain first for cheap, fast cloud responses.
- If that fails, fall back to a browser-local **Llama 3.2 1B** model running through **WebLLM** with **WebGPU**.
- If local inference is unavailable or unusable, fall back again to a deterministic scripted hint so the feature never goes completely dark.

That approach kept normal hint requests lightweight while still giving the game a no-backend fallback path during Gemini outages.

### Asset Generation
I used **Gemini Nano Banana 2** to generate the fruit-theme images that power the new `fruits` card theme.

- AI helped create the initial fruit and produce illustrations quickly enough to make a full theme practical within scope.
- I did not treat the first outputs as final. I iterated with new prompts until the images were consistent enough to use together as a set.
- After generation, I manually selected, named, organized, and integrated the final assets into `src/assets/themes/fruits/`.

### Firebase Security Rules
AI drafted the Firestore security rules. I reviewed the logic manually — specifically the `exists()` checks that prevent orphan score submissions — before deploying them.

### Documentation Acceleration
I used **GPT-5.4 with Cursor** to speed up documentation writing and revision:
- Drafting and revising `README.md`, `DECISIONS_AND_OBSTACLES.md`, and `AI_USAGE.md`
- Tightening contributor instructions so another developer could clone the repo, make a branch, run checks, and open a PR without extra explanation
- Rewriting sections for clarity and conciseness so the docs matched the exercise rubric rather than reading like generic project notes

## What I Verified Manually

I did not treat AI output as correct by default. Specific things I checked myself:

- **Model names and hint fallback order in `geminiService.ts`**: AI gave me candidate model names and fallback ideas, but I verified the final Gemini chain and browser-local fallback behavior myself before accepting the change.
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

## Where AI Helped Most

The biggest win was **speed on unfamiliar ground**. I didn't know every Firebase permission model, Vite environment variable convention, or Web Audio API detail going in. Using AI to get oriented quickly — then verifying the critical parts myself — let me ship a production-grade result on a short timeline without cutting corners that mattered.

The rule I applied: let AI handle the acceleration, then manually verify anything that touches security, external APIs, user-facing behavior, or shipped assets before it goes live. That included both the code and the generated fruit images, with final validation done through hands-on review, manual code edits, and follow-up prompts where needed.
