import { isInstalledWebApp } from "../lib/installedWebApp";
import type { CardData } from "../types";
import { type HintResponse, validateHint } from "./geminiService";

// Llama 3.2 1B (Instruct, 4-bit quantized) via WebLLM + WebGPU, only in an
// installed PWA. Normal browser tabs never load this path (see isInstalledWebApp).
// The first invocation downloads the model weights (~700 MB) and caches them in
// IndexedDB; subsequent invocations reuse the cached copy and start near-instantly.
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

// Generous ceiling on a single inference call so a stuck GPU backend can't
// leave the hint button spinning forever. A 1B model on WebGPU typically
// finishes the 80-token hint in 2–5 seconds.
const INFERENCE_TIMEOUT_MS = 20000;
const LOCAL_RETRY_MAX_TOKENS = 48;

// Soft wait for the WebLLM engine to be ready for THIS hint request. If the
// engine isn't initialized within this window (e.g. first launch, weights still
// downloading), we return null so the caller can use Gemini instead. The init
// promise keeps running in the background, so the next hint usually gets the
// warm engine for free.
const ENGINE_READY_TIMEOUT_MS = 5000;

export interface LocalLlmInstallStatus {
  active: boolean;
  progress: number; // 0..1
  text: string;
}

// Minimal structural type of what we actually call on the WebLLM engine, so the
// rest of the service doesn't need to depend on the full @mlc-ai/web-llm types.
interface LlmEngine {
  chat: {
    completions: {
      create: (args: {
        messages: Array<{ role: "system" | "user"; content: string }>;
        temperature?: number;
        max_tokens?: number;
      }) => Promise<{ choices: Array<{ message: { content: string | null } }> }>;
    };
  };
}

// Module-level singleton so repeated hint requests reuse the same loaded model
// instead of re-initializing WebGPU every call. Reset to null on init failure
// so the next hint request can transparently retry.
let enginePromise: Promise<LlmEngine | null> | null = null;
let installStatus: LocalLlmInstallStatus = {
  active: false,
  progress: 0,
  text: "",
};
const installStatusListeners = new Set<(status: LocalLlmInstallStatus) => void>();

const emitInstallStatus = (next: LocalLlmInstallStatus) => {
  installStatus = next;
  for (const listener of installStatusListeners) {
    try {
      listener(installStatus);
    } catch (error) {
      // A buggy subscriber must not stop the broadcast for everyone else.
      console.warn('[LocalLLM] install-status listener threw', error);
    }
  }
};

export function getLocalLlmInstallStatus(): LocalLlmInstallStatus {
  return installStatus;
}

export function subscribeLocalLlmInstallStatus(
  listener: (status: LocalLlmInstallStatus) => void
): () => void {
  installStatusListeners.add(listener);
  try {
    listener(installStatus);
  } catch (error) {
    // A buggy subscriber must not break the caller wiring up the subscription.
    console.warn('[LocalLLM] install-status listener threw on initial replay', error);
  }
  return () => {
    installStatusListeners.delete(listener);
  };
}

const hasWebGpu = (): boolean =>
  typeof navigator !== "undefined" && "gpu" in navigator;

const initEngine = async (): Promise<LlmEngine> => {
  // Dynamic import so the ~6 MB WebLLM runtime is only fetched for installed-PWA
  // hint requests. Keeps the main bundle slim. Install status is already marked
  // active in getEngine() before this promise starts.
  const webllm = await import("@mlc-ai/web-llm");
  const engine = await webllm.CreateMLCEngine(MODEL_ID, {
    initProgressCallback: (p: { progress: number; text: string }) => {
      // Surface progress in the console so players can tell why the first
      // fallback hint is slow.
      console.info(`[LocalLLM] ${p.text} (${Math.round(p.progress * 100)}%)`);
      emitInstallStatus({
        active: p.progress < 1,
        progress: Math.max(0, Math.min(1, Number.isFinite(p.progress) ? p.progress : 0)),
        text: p.text || "Downloading local AI model...",
      });
    },
  });
  emitInstallStatus({
    active: false,
    progress: 1,
    text: "Local AI model ready.",
  });
  return engine as unknown as LlmEngine;
};

const getEngine = (): Promise<LlmEngine | null> => {
  if (!isInstalledWebApp()) return Promise.resolve(null);
  if (!hasWebGpu()) return Promise.resolve(null);
  if (!enginePromise) {
    emitInstallStatus({
      active: true,
      progress: 0,
      text: "Starting local AI model setup...",
    });
    enginePromise = initEngine().catch((error) => {
      console.warn("[LocalLLM] Failed to initialize WebLLM engine:", error);
      emitInstallStatus({
        active: false,
        progress: 0,
        text: "",
      });
      enginePromise = null; // allow retry on next hint request
      return null;
    });
  }
  return enginePromise;
};

// Kick off model download/initialization eagerly (installed app only) so users
// see progress on first load instead of waiting for the first hint tap.
export function warmLocalLlmEngine(): void {
  void getEngine();
}

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[LocalLLM] ${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });

// Race the (possibly slow) engine init against a soft timeout so a cold start
// can't block the user. The underlying init promise is cached and keeps loading
// in the background; later hint requests will see the warm engine immediately.
const waitForEngine = async (): Promise<LlmEngine | null> => {
  try {
    return await withTimeout(getEngine(), ENGINE_READY_TIMEOUT_MS, "engine warmup");
  } catch {
    return null;
  }
};

const extractJson = (raw: string): unknown => {
  // Small 1B models sometimes wrap JSON in prose or code fences even when asked
  // for json_object, so we do a forgiving extract rather than a strict parse.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const braceStart = candidate.indexOf("{");
  const braceEnd = candidate.lastIndexOf("}");
  if (braceStart === -1 || braceEnd === -1 || braceEnd <= braceStart) return null;
  try {
    return JSON.parse(candidate.slice(braceStart, braceEnd + 1));
  } catch {
    return null;
  }
};

const coerceHintCandidate = (
  parsed: unknown,
  cards: CardData[],
  flippedIndices: number[]
): HintResponse | null => {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const rawIndex = obj.index;
  const index =
    typeof rawIndex === "number"
      ? rawIndex
      : typeof rawIndex === "string"
      ? Number(rawIndex.trim())
      : NaN;

  const message =
    typeof obj.message === "string"
      ? obj.message
      : typeof obj.hint === "string"
      ? obj.hint
      : typeof obj.reason === "string"
      ? obj.reason
      : "Give this one a try!";

  return validateHint({ index, message }, cards, flippedIndices);
};

export async function getLocalLlmHint(
  cards: CardData[],
  flippedIndices: number[],
  gridSize: number
): Promise<HintResponse | null> {
  if (!isInstalledWebApp()) return null;

  const install = getLocalLlmInstallStatus();
  // Until the cached model is fully ready, getNextMoveHint should use Gemini (and
  // deterministic fallback) — never block the player on WebLLM download/init.
  if (install.active || install.progress < 1) {
    return null;
  }

  const engine = await waitForEngine();
  if (!engine) return null;

  // Only send unmatched cards — matched cards can't be picked, so including
  // them just enlarges the context and slows inference on a 1B model. The
  // `isMatched` field is also redundant now since the filter removes them.
  const boardState: Array<{ index: number; iconName: string }> = [];
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].isMatched) {
      boardState.push({ index: i, iconName: cards[i].iconName });
    }
  }

  const systemInstruction =
    `You are a helpful AI assistant for a ${gridSize}x${gridSize} Memory Match game. ` +
    `Valid indices are 0 to ${cards.length - 1}. ` +
    `Suggest the next unmatched, unflipped card to flip. ` +
    `If one card is already flipped, prefer its matching pair if you can see it. ` +
    `Respond ONLY with a single JSON object of the shape ` +
    `{"index": <number>, "message": "<short hint>"} and nothing else.`;

  const userPrompt =
    `Board: ${JSON.stringify(boardState)}\n` +
    `Flipped: ${JSON.stringify(flippedIndices)}`;

  try {
    console.info("[LocalLLM] Running local hint inference...");

    // WebLLM's current grammar compiler can throw for structured
    // `response_format` payloads in some browser/runtime combinations.
    // We request plain text and apply strict JSON extraction + validation here.
    const response = await withTimeout(
      engine.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 80,
      }),
      INFERENCE_TIMEOUT_MS,
      "inference"
    );

    const text = response.choices[0]?.message?.content ?? "";
    if (import.meta.env.DEV) {
      console.info("[LocalLLM] Raw output:", text);
    }

    let validated = coerceHintCandidate(extractJson(text), cards, flippedIndices);

    if (!validated) {
      console.info("[LocalLLM] First output invalid; retrying once with stricter prompt.");
      const retryResponse = await withTimeout(
        engine.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "Return ONLY JSON in one line. Required shape: {\"index\": <integer>, \"message\": \"<short hint>\"}. No prose, no markdown, no code fences.",
            },
            {
              role: "user",
              content:
                `Cards: ${JSON.stringify(boardState)}\nFlipped: ${JSON.stringify(flippedIndices)}\n` +
                `Pick one valid unmatched and currently-unflipped index between 0 and ${cards.length - 1}.`,
            },
          ],
          temperature: 0,
          max_tokens: LOCAL_RETRY_MAX_TOKENS,
        }),
        INFERENCE_TIMEOUT_MS,
        "retry inference"
      );
      const retryText = retryResponse.choices[0]?.message?.content ?? "";
      if (import.meta.env.DEV) {
        console.info("[LocalLLM] Retry raw output:", retryText);
      }
      validated = coerceHintCandidate(extractJson(retryText), cards, flippedIndices);
    }

    if (validated) {
      console.info(`[LocalLLM] Local hint ready (index=${validated.index}).`);
    } else {
      console.info("[LocalLLM] Local output was invalid; falling back.");
    }
    return validated;
  } catch (error) {
    console.warn("[LocalLLM] Inference failed, deferring to deterministic fallback:", error);
    return null;
  }
}
