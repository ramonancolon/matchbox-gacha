#!/usr/bin/env node
/**
 * `npm run dev` dispatcher.
 *
 * Picks `dev:local` when the Firestore emulator can run (Java present on PATH)
 * and falls back to `dev:cloud` otherwise. The Functions and Firestore
 * emulators ship as Java JARs, so without a JDK `firebase emulators:start`
 * fails immediately — better to skip straight to the cloud-backed flow than
 * surface a cryptic Java error.
 */

import { spawn, spawnSync } from 'node:child_process';

// Spawn without shell:true to avoid Node's DEP0190 deprecation warning. On
// Windows we need the explicit .exe name because there's no shell to do
// PATHEXT lookup for us.
const javaBin = process.platform === 'win32' ? 'java.exe' : 'java';
const javaCheck = spawnSync(javaBin, ['-version'], { stdio: 'ignore' });
const hasJava = javaCheck.status === 0;

const target = hasJava ? 'dev:local' : 'dev:cloud';

if (hasJava) {
  console.log('[dev] Java detected — starting local emulators (dev:local).');
} else {
  console.log('[dev] Java not detected on PATH.');
  console.log('[dev] Falling back to dev:cloud — the app will hit deployed Firebase services.');
  console.log('[dev] To run against local emulators instead, install Eclipse Temurin 21 (https://adoptium.net) and re-run `npm run dev`.');
}

// On Windows, npm is `npm.cmd`; Node refuses to spawn .cmd without a shell
// (post-BatBadBut hardening). Pass the full command as a single string with
// shell:true — DEP0190 only fires when args are passed via the array form
// alongside shell:true.
const child = spawn(`npm run ${target}`, { stdio: 'inherit', shell: true });

// Forward common terminate signals so concurrently / vite shut down cleanly
// when the parent receives Ctrl+C.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
