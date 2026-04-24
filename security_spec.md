# Security Specification: Memory Match Leaderboard

This document describes the security expectations for the leaderboard and profile data model. It is intentionally short and focused on the invariants the Firestore rules must protect.

## Core Data Invariants

1. Users can only create or update their own profile document.
2. Score submissions are append-only. Existing scores cannot be updated or deleted by clients.
3. The `userId` on a score must match the authenticated user creating it.
4. `createdAt` must come from server time, not the client.
5. Score fields such as moves and time must stay within valid numeric ranges.
6. Unexpected fields should not silently bypass the intended schema.

## Client-Side Boundary

This app is a static React deployment, so browser-exposed `VITE_*` values should be treated as public configuration, not secrets. Firebase API keys and the Gemini key can appear in the client bundle. The security model must therefore rely on:

1. Firestore security rules for leaderboard and profile authorization.
2. Firebase authorized domains for auth flows.
3. Key restrictions, monitoring, and rotation for provider keys.
4. GitHub Actions secrets only for deploy credentials and CI-only configuration.

If the AI hint feature needs stronger key protection later, the Gemini call should move behind a server-side proxy with request validation and rate limiting.

## Operational Hardening

1. CI runs `npm audit --audit-level=high --omit=dev` before build and deploy.
2. Deploy credentials are stored as GitHub Actions secrets and are not required for pull-request CI from forks.
3. `public/security.txt` and `public/.well-known/security.txt` provide a fixed-origin disclosure path for security reports.
4. Static assets are split intentionally: hashed app assets go through Vite and Bunny CDN, while crawler/security files stay at stable origin URLs under `public/`.

## Denial Tests

These are the payloads and access patterns the rules should reject:

1. **Identity spoofing**: User A tries to create a score for User B.
2. **Profile takeover**: User A tries to update User B's profile.
3. **Immutability breach**: User A tries to update an existing score to lower their move count.
4. **Immutability breach**: User A tries to delete a bad score after submission.
5. **Timestamp fraud**: User A tries to set `createdAt` to an arbitrary past value.
6. **Data injection**: User A tries to add a large unexpected field such as a 1.5 MB `comment`.
7. **Negative values**: User A tries to submit `-1` moves or another impossible score value.
8. **ID poisoning**: User A tries to use an extremely large or malformed score ID.
9. **Blanket read**: An unauthenticated client tries to list protected user documents.
10. **Query scraping**: A client tries to query score data outside the intended access pattern.
11. **Privilege escalation**: A user tries to add an `admin` flag to their own profile.
12. **Schema skipping**: A user tries to add or update unsupported status fields on a score.

## Test Harness

Use Firebase Rules Unit Testing to encode the denials above as repeatable tests:

```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

// Encode each denial case above as an explicit test.
// The goal is to keep the rules verifiable, not just aspirational.
```
