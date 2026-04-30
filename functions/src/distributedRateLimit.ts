import { createHash } from "crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { allowRequest as allowInMemoryRequest } from "./rateLimit";

const COLLECTION = "hintRateLimits";

function getDb() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getFirestore();
}

function getBucketStartMs(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

function getDocId(callerKey: string, bucketStartMs: number): string {
  // Firestore doc IDs cannot contain "/" and should stay short/stable.
  const hash = createHash("sha256").update(callerKey).digest("hex").slice(0, 24);
  return `${hash}_${bucketStartMs}`;
}

/**
 * Distributed rate limit using Firestore transactions.
 *
 * - Consistent across Cloud Function instances
 * - Windowed counter by caller key + time bucket
 * - TTL-friendly `expiresAt` field for automatic cleanup
 *
 * If Firestore is unavailable, fall back to the in-memory limiter so hints
 * still function (with weaker cross-instance guarantees).
 */
export async function allowDistributedRequest(
  callerKey: string,
  limit: number,
  windowMs: number,
  nowMs: number = Date.now()
): Promise<boolean> {
  const bucketStartMs = getBucketStartMs(nowMs, windowMs);
  const docId = getDocId(callerKey, bucketStartMs);
  const expiresAtMs = bucketStartMs + windowMs * 2;

  try {
    const db = getDb();
    const ref = db.collection(COLLECTION).doc(docId);

    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? Number(snap.get("count") ?? 0) : 0;
      if (current >= limit) return false;

      if (!snap.exists) {
        tx.set(ref, {
          count: 1,
          bucketStartMs,
          windowMs,
          expiresAt: Timestamp.fromMillis(expiresAtMs),
        });
      } else {
        tx.update(ref, {
          count: FieldValue.increment(1),
          expiresAt: Timestamp.fromMillis(expiresAtMs),
        });
      }
      return true;
    });
  } catch (error) {
    console.warn("[RateLimit] Firestore limiter unavailable, using in-memory fallback:", error);
    return allowInMemoryRequest(callerKey, limit, windowMs, nowMs);
  }
}
