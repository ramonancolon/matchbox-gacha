# Security Specification: Memory Match Leaderboard

## Data Invariants
1. Users can only edit their own profile.
2. Scores are immutable (create only).
3. `userId` in `Score` must match the authenticated user.
4. `createdAt` must be server time.
5. Scores must have valid ranges for moves and time.

## The "Dirty Dozen" Payloads (Denial Tests)
1. **Identity Spoofing**: User A tries to create a score for User B.
2. **Identity Spoofing**: User A tries to update User B's profile.
3. **Immutability Breach**: User A tries to update a submitted score to lower their moves.
4. **Immutability Breach**: User A tries to delete a bad score.
5. **Timestamp Fraud**: User A tries to set `createdAt` to 1 year ago.
6. **Data Injection**: User A tries to add a 1.5MB "comment" field to a Score.
7. **Negative Values**: User A tries to submit a score with `-1` moves.
8. **ID Poisoning**: User A tries to use a 1MB string as a Score ID.
9. **Blanket Read**: Unauthenticated user tries to list all user documents.
10. **Query Scraping**: User tries to list scores without a mode filter (if we want to force filtered queries).
11. **Profile Escalation**: User tries to set an `admin` flag on their profile (though not in schema, tests safety net).
12. **Status Skipping**: User tries to update a hypothetical `isVerified` flag on a score.

## Test Runner
```typescript
import { assertFails, assertSucceeded } from '@firebase/rules-unit-testing';
// ... test cases for above payloads ...
```
