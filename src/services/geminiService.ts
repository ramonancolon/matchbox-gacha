import { GoogleGenAI, Type } from "@google/genai";
import type { CardData } from "../types";
import { getLocalLlmHint } from "./localLlmService";

export interface HintResponse {
  index: number;
  message: string;
}

// Models are tried in order. After the whole chain fails we drop down to a
// browser-local Llama 3.2 1B via WebLLM, and finally a deterministic script
// fallback so the hint feature is never fully unavailable.
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
  "gemini-3.1-pro",
] as const;
const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY ?? "").trim();

// Per-model timeout. Tight enough that a dead endpoint doesn't stall the user,
// loose enough to tolerate a slow mobile network response.
const GEMINI_TIMEOUT_MS = 8000;

// Hoisted because the schema never changes per call.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    index: { type: Type.NUMBER },
    message: { type: Type.STRING },
  },
  required: ["index", "message"],
};

// Lazy module-level client so the SDK isn't instantiated on import for pages
// that never request a hint. The missing-key guard lives in `getNextMoveHint`
// so we never reach this function without a usable key.
let clientInstance: GoogleGenAI | null = null;
const getClient = (): GoogleGenAI => {
  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return clientInstance;
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") return true;
    if (error instanceof TypeError) return true; // fetch network failure
  }
  if (typeof error === "object" && error !== null) {
    const msg = (error as { message?: string }).message ?? "";
    const status = (error as { status?: number }).status;
    if (status === 500 || status === 503 || status === 504) return true;
    if (status === 429 || status === 404) return true;
    return /overloaded|quota|rate.?limit|unavailable|not.found|timeout|network/i.test(msg);
  }
  return false;
};

// Reject any hint — cloud or local — that points outside the board, at an
// already-matched card, or at a currently-flipped card. Centralizing this
// means Gemini, Llama, and the deterministic path all enforce the same
// "must be a legal move" contract for the UI.
export function validateHint(
  raw: unknown,
  cards: CardData[],
  flippedIndices: readonly number[]
): HintResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const index = Number(obj.index);
  if (!Number.isInteger(index) || index < 0 || index >= cards.length) return null;
  if (cards[index].isMatched) return null;
  if (flippedIndices.includes(index)) return null;
  const rawMessage = typeof obj.message === "string" ? obj.message.trim() : "";
  return {
    index,
    message: rawMessage ? rawMessage.slice(0, 200) : "Give this one a try!",
  };
}

// Matched cards are face-up permanently and can never be "picked" again, so
// sending them wastes prompt tokens without giving the model useful signal.
const buildBoardSnapshot = (cards: CardData[]) => {
  const snapshot: Array<{ index: number; iconName: string }> = [];
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].isMatched) snapshot.push({ index: i, iconName: cards[i].iconName });
  }
  return snapshot;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });

export async function getNextMoveHint(
  cards: CardData[],
  flippedIndices: number[],
  gridSize: number
): Promise<HintResponse | null> {
  if (!GEMINI_API_KEY) {
    // Production hardening: avoid repeated failing cloud calls when a key is
    // missing/misconfigured and jump straight to local fallback layers.
    const localLlmHint = await getLocalLlmHint(cards, flippedIndices, gridSize);
    if (localLlmHint) return localLlmHint;
    return getDeterministicHint(cards, flippedIndices);
  }

  const boardState = buildBoardSnapshot(cards);

  const systemInstruction = `You are a helpful AI assistant for a Memory Match game.
Your goal is to suggest the next move to the user.
The user is playing on a ${gridSize}x${gridSize} grid.
Indices go from 0 to ${cards.length - 1}. Only choose from the provided cards.
If one card is already flipped, suggest its matching pair if you know it from the provided cards.
If no cards are flipped, suggest a potential pair.
Be encouraging and concise.
Return JSON with 'index' (the card index to flip) and 'message' (a short hint).`;

  const prompt = `Current Board State: ${JSON.stringify(boardState)}
Currently Flipped Indices: ${JSON.stringify(flippedIndices)}`;

  const client = getClient();

  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        GEMINI_TIMEOUT_MS,
        `Gemini model "${model}"`
      );

      if (!response.text) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        continue; // malformed JSON — try the next model
      }

      const validated = validateHint(parsed, cards, flippedIndices);
      if (validated) return validated;
      // Otherwise the model returned a hint pointing at a matched/flipped card
      // or an out-of-range index. Try the next model instead of surfacing a
      // useless tip to the player.
    } catch (error) {
      if (isRetryableError(error)) {
        console.warn(`Gemini model "${model}" unavailable — trying next fallback.`);
        continue;
      }
      console.error(`Gemini Hint Error on model "${model}":`, error);
      break;
    }
  }

  // All Gemini API models failed — try the in-browser Llama 3.2 1B model next.
  // Falls through to the deterministic fallback if WebGPU is unavailable, the
  // weights can't be fetched, or the local model produces an unusable response.
  const localLlmHint = await getLocalLlmHint(cards, flippedIndices, gridSize);
  if (localLlmHint) return localLlmHint;

  return getDeterministicHint(cards, flippedIndices);
}

function getDeterministicHint(
  cards: CardData[],
  flippedIndices: number[]
): HintResponse | null {
  const flippedSet = new Set(flippedIndices);
  const unmatched: Array<CardData & { index: number }> = [];
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].isMatched) unmatched.push({ ...cards[i], index: i });
  }
  if (unmatched.length === 0) return null;

  if (flippedIndices.length === 1) {
    const flippedCard = cards[flippedIndices[0]];
    const pair = unmatched.find(
      (c) => c.iconName === flippedCard.iconName && c.index !== flippedIndices[0]
    );
    if (pair) {
      return { index: pair.index, message: "You're on the right track — try that one!" };
    }
  }

  const candidates = unmatched.filter((c) => !flippedSet.has(c.index));
  if (candidates.length === 0) return null;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return { index: pick.index, message: "Give this one a try — good luck!" };
}
