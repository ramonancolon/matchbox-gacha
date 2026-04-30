const { allowDistributedRequest } = require("../lib/distributedRateLimit.js");

async function main() {
  const [key, limitRaw, windowMsRaw, nowMsRaw] = process.argv.slice(2);
  const limit = Number(limitRaw);
  const windowMs = Number(windowMsRaw);
  const nowMs = Number(nowMsRaw);

  if (!key || !Number.isFinite(limit) || !Number.isFinite(windowMs) || !Number.isFinite(nowMs)) {
    throw new Error("Usage: node distributedRateLimit.worker.cjs <key> <limit> <windowMs> <nowMs>");
  }

  const allowed = await allowDistributedRequest(key, limit, windowMs, nowMs);
  process.stdout.write(`${allowed ? "allow" : "block"}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
