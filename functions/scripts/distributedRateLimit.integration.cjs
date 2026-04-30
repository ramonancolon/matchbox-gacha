/**
 * Integration test for the Firestore-backed distributed rate limiter.
 *
 * Verifies cross-process behavior that the in-memory unit test cannot:
 *   1. Sequential calls across separate Node processes share state
 *      (allow → allow → block → next-window allow).
 *   2. A concurrent burst across N parallel processes is gated to
 *      exactly `limit` allows, proving the Firestore transaction
 *      actually serializes contention (the whole point of using a
 *      transaction instead of a naive read/write).
 *
 * Run via `firebase emulators:exec --only firestore` so
 * FIRESTORE_EMULATOR_HOST is set and Admin SDK targets the emulator.
 */
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const COLLECTION = "hintRateLimits";
const WORKER = path.join(__dirname, "distributedRateLimit.worker.cjs");

function workerArgs(key, limit, windowMs, nowMs) {
  return [WORKER, key, `${limit}`, `${windowMs}`, `${nowMs}`];
}

function runWorker(key, limit, windowMs, nowMs) {
  const result = spawnSync(process.execPath, workerArgs(key, limit, windowMs, nowMs), {
    stdio: "pipe",
    encoding: "utf8",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(
      `Worker exited with ${result.status}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  return result.stdout.trim();
}

function runWorkerAsync(key, limit, windowMs, nowMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, workerArgs(key, limit, windowMs, nowMs), {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with ${code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function clearLimiterDocs() {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).get();
  if (snap.empty) return;

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

async function testSequential() {
  const key = "integration-sequential";
  const limit = 2;
  const windowMs = 60_000;
  const nowMs = 1_700_000_000_000;

  const first = runWorker(key, limit, windowMs, nowMs);
  const second = runWorker(key, limit, windowMs, nowMs);
  const third = runWorker(key, limit, windowMs, nowMs);
  const nextWindow = runWorker(key, limit, windowMs, nowMs + windowMs + 1);

  if (first !== "allow") throw new Error(`sequential[1] expected allow, got ${first}`);
  if (second !== "allow") throw new Error(`sequential[2] expected allow, got ${second}`);
  if (third !== "block") throw new Error(`sequential[3] expected block, got ${third}`);
  if (nextWindow !== "allow") {
    throw new Error(`sequential[next-window] expected allow, got ${nextWindow}`);
  }
}

async function testConcurrentBurst() {
  const key = "integration-concurrent";
  const limit = 3;
  const burst = 8;
  const windowMs = 60_000;
  const nowMs = 1_700_000_300_000;

  const results = await Promise.all(
    Array.from({ length: burst }, () => runWorkerAsync(key, limit, windowMs, nowMs))
  );

  const allows = results.filter((r) => r === "allow").length;
  const blocks = results.filter((r) => r === "block").length;

  if (allows + blocks !== burst) {
    throw new Error(`burst returned unexpected outputs: ${results.join(",")}`);
  }
  if (allows !== limit) {
    throw new Error(
      `burst expected exactly ${limit} allows across ${burst} concurrent callers, got ${allows} (results=${results.join(
        ","
      )})`
    );
  }
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required. Run via firebase emulators:exec.");
  }

  await clearLimiterDocs();
  await testSequential();
  await clearLimiterDocs();
  await testConcurrentBurst();

  console.log("distributed limiter integration test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
