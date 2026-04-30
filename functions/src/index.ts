import { GoogleGenAI, Type } from "@google/genai";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { allowDistributedRequest } from "./distributedRateLimit";
import { isRetryableError, validateServerHint } from "./serverHint";
import {
  HintRequestPayload,
  HintValidationError,
  validateHintRequest,
} from "./validate";

export type { HintRequestPayload };

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
  "gemini-3.1-pro",
] as const;

const GEMINI_TIMEOUT_MS = 8000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 24;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    index: { type: Type.NUMBER },
    message: { type: Type.STRING },
  },
  required: ["index", "message"],
};

// Shared client across warm invocations: the SDK + key initialization is
// non-trivial, and Cloud Functions reuse module scope between requests on the
// same instance. Initialized lazily inside the handler once the secret is
// available.
let cachedClient: GoogleGenAI | null = null;
const getClient = (apiKey: string): GoogleGenAI => {
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

/**
 * Callable: runs Gemini on the server so the API key never ships in the web bundle.
 * Returns { ok: true, index, message } or { ok: false } when no model produced a legal hint.
 */
export const getHint = onCall(
  {
    region: "us-central1",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
    enforceAppCheck: true,
    cors: true,
  },
  async (request) => {
    let payload: HintRequestPayload;
    try {
      payload = validateHintRequest(request.data as Partial<HintRequestPayload> | undefined);
    } catch (error) {
      if (error instanceof HintValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      throw error;
    }
    const { boardSnapshot, flippedIndices, gridSize, cardCount } = payload;

    const apiKey = GEMINI_API_KEY.value()?.trim();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Gemini is not configured on the server.");
    }

    const callerKey =
      request.auth?.uid ??
      request.app?.appId ??
      "unknown-caller";
    if (!(await allowDistributedRequest(callerKey, RATE_LIMIT_PER_WINDOW, RATE_LIMIT_WINDOW_MS))) {
      throw new HttpsError("resource-exhausted", "Rate limit exceeded for hints.");
    }

    const client = getClient(apiKey);

    const systemInstruction = `You are a helpful AI assistant for a Memory Match game.
Your goal is to suggest the next move to the user.
The user is playing on a ${gridSize}x${gridSize} grid.
Indices go from 0 to ${cardCount - 1}. Only choose from the provided cards.
If one card is already flipped, suggest its matching pair if you know it from the provided cards.
If no cards are flipped, suggest a potential pair.
Be encouraging and concise.
Return JSON with 'index' (the card index to flip) and 'message' (a short hint).`;

    const prompt = `Current Board State: ${JSON.stringify(boardSnapshot)}
Currently Flipped Indices: ${JSON.stringify(flippedIndices)}`;

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
          continue;
        }

        const validated = validateServerHint(parsed, boardSnapshot, flippedIndices, cardCount);
        if (validated) {
          return { ok: true as const, index: validated.index, message: validated.message };
        }
      } catch (error) {
        if (isRetryableError(error)) {
          continue;
        }
        break;
      }
    }

    return { ok: false as const };
  }
);
