import type { CardData } from "../types";
import { type HintResponse, validateHint } from "./geminiService";

// Llama 3.2 1B (Instruct, 4-bit quantized) running in the browser via WebLLM + WebGPU.
// The first invocation downloads the model weights (~700 MB) and caches them in
// IndexedDB; subsequent invocations reuse the cached copy and start near-instantly.
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

// Generous ceiling on a single inference call so a stuck GPU backend can't
// leave the hint button spinning forever. A 1B model on WebGPU typically
// finishes the 80-token hint in 2–5 seconds.
const INFERENCE_TIMEOUT_MS = 20000;

// Minimal structural type of what we actually call on the WebLLM engine, so the
// rest of the service doesn't need to depend on the full @mlc-ai/web-llm types.
interface LlmEngine {
  chat: {
    completions: {
      create: (args: {
        messages: Array<{ role: "system" | "user"; content: string }>;
        temperature?: number;
        max_tokens?: number;
        response_format?: { type: "json_object" };
      }) => Promise<{ choices: Array<{ message: { content: string | null } }> }>;
    };
  };
}

// Module-level singleton so repeated hint requests reuse the same loaded model
// instead of re-initializing WebGPU every call. Reset to null on init failure
// so the next hint request can transparently retry.
let enginePromise: Promise<LlmEngine | null> | null = null;

const hasWebGpu = (): boolean =>
  typeof navigator !== "undefined" && "gpu" in navigator;

const initEngine = async (): Promise<LlmEngine> => {
  // Dynamic import so the ~6 MB WebLLM runtime is only fetched when the
  // Gemini chain has actually failed. Keeps the initial bundle slim.
  const webllm = await import("@mlc-ai/web-llm");
  const engine = await webllm.CreateMLCEngine(MODEL_ID, {
    initProgressCallback: (p: { progress: number; text: string }) => {
      // Surface progress in the console so players can tell why the first
      // fallback hint is slow. We don't need a UI indicator for v1.
      console.info(`[LocalLLM] ${p.text} (${Math.round(p.progress * 100)}%)`);
    },
  });
  return engine as unknown as LlmEngine;
};

const getEngine = (): Promise<LlmEngine | null> => {
  if (!hasWebGpu()) return Promise.resolve(null);
  if (!enginePromise) {
    enginePromise = initEngine().catch((error) => {
      console.warn("[LocalLLM] Failed to initialize WebLLM engine:", error);
      enginePromise = null; // allow retry on next hint request
      return null;
    });
  }
  return enginePromise;
};

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

export async function getLocalLlmHint(
  cards: CardData[],
  flippedIndices: number[],
  gridSize: number
): Promise<HintResponse | null> {
  const engine = await getEngine();
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
    const response = await withTimeout(
      engine.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 80,
        response_format: { type: "json_object" },
      }),
      INFERENCE_TIMEOUT_MS,
      "inference"
    );

    const text = response.choices[0]?.message?.content ?? "";
    return validateHint(extractJson(text), cards, flippedIndices);
  } catch (error) {
    console.warn("[LocalLLM] Inference failed, deferring to deterministic fallback:", error);
    return null;
  }
}
