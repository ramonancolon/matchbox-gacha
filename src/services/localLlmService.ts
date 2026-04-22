import type { CardData } from "../types";
import type { HintResponse } from "./geminiService";

// Llama 3.2 1B (Instruct, 4-bit quantized) running in the browser via WebLLM + WebGPU.
// The first invocation downloads the model weights (~700 MB) and caches them in
// IndexedDB; subsequent invocations reuse the cached copy and start near-instantly.
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

// We keep the engine as a module-level singleton so repeated hint requests reuse
// the same loaded model instead of re-initializing WebGPU every call.
let enginePromise: Promise<LlmEngine | null> | null = null;

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

function hasWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function getEngine(): Promise<LlmEngine | null> {
  if (!hasWebGpu()) return null;
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    try {
      // Dynamic import so the ~13 MB WebLLM runtime is only fetched when the
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
    } catch (error) {
      console.warn("[LocalLLM] Failed to initialize WebLLM engine:", error);
      enginePromise = null; // allow a retry on the next hint request
      return null;
    }
  })();

  return enginePromise;
}

function extractJson(raw: string): { index?: unknown; message?: unknown } | null {
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
}

export async function getLocalLlmHint(
  cards: CardData[],
  flippedIndices: number[],
  gridSize: number
): Promise<HintResponse | null> {
  const engine = await getEngine();
  if (!engine) return null;

  const boardState = cards.map((c, i) => ({
    index: i,
    iconName: c.iconName,
    isMatched: c.isMatched,
  }));

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
    const response = await engine.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 120,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = extractJson(text);
    if (!parsed) return null;

    const index = Number(parsed.index);
    const message = typeof parsed.message === "string" ? parsed.message : "";

    // Guardrails: reject hallucinated indices or pointers at already-matched or
    // already-flipped cards, so we don't surface a useless "tip" to the player.
    if (!Number.isInteger(index) || index < 0 || index >= cards.length) return null;
    if (cards[index].isMatched) return null;
    if (flippedIndices.includes(index)) return null;

    return {
      index,
      message: message || "Local hint: try this one!",
    };
  } catch (error) {
    console.warn("[LocalLLM] Inference failed, deferring to deterministic fallback:", error);
    return null;
  }
}
