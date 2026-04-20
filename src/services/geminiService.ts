import { GoogleGenAI, Type } from "@google/genai";
import { CardData } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export interface HintResponse {
  index: number;
  message: string;
}

// Models tried in order — primary first, then fallbacks on overload/error.
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

const shouldTryNextModel = (error: unknown): boolean => {
  if (typeof error === 'object' && error !== null) {
    const msg = (error as { message?: string }).message ?? '';
    const status = (error as { status?: number }).status;
    // Retry on: overload, rate-limit, or model not found (wrong name / not in API version)
    return (
      status === 503 ||
      status === 429 ||
      status === 404 ||
      /overloaded|quota|rate.?limit|unavailable|not.found/i.test(msg)
    );
  }
  return false;
};

const buildRequest = (model: string, prompt: string, systemInstruction: string) => ({
  model,
  contents: prompt,
  config: {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        index: { type: Type.NUMBER },
        message: { type: Type.STRING }
      },
      required: ["index", "message"]
    }
  }
});

export async function getNextMoveHint(
  cards: CardData[],
  flippedIndices: number[],
  gridSize: number
): Promise<HintResponse | null> {
  const boardState = cards.map((c, i) => ({
    index: i,
    iconName: c.iconName,
    isMatched: c.isMatched
  }));

  const systemInstruction = `You are a helpful AI assistant for a Memory Match game. 
  Your goal is to suggest the next move to the user.
  The user is playing on a ${gridSize}x${gridSize} grid.
  Indices go from 0 to ${cards.length - 1}.
  If one card is already flipped, suggest its matching pair if you know it from the provided cards.
  If no cards are flipped, suggest a potential pair.
  Be encouraging and concise.
  Return the response in JSON format with 'index' (the card index to flip) and 'message' (a short hint message).`;

  const prompt = `Current Board State: ${JSON.stringify(boardState)}
  Currently Flipped Indices: ${JSON.stringify(flippedIndices)}`;

  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      const response = await ai.models.generateContent(
        buildRequest(model, prompt, systemInstruction)
      );

      if (response.text) {
        return JSON.parse(response.text) as HintResponse;
      }
    } catch (error) {
      if (shouldTryNextModel(error)) {
        console.warn(`Gemini model "${model}" unavailable — trying next fallback.`);
        continue;
      }
      console.error(`Gemini Hint Error on model "${model}":`, error);
      break;
    }
  }

  // All API models failed — use local deterministic hint so the feature
  // never goes completely dark for the player.
  return getLocalFallbackHint(cards, flippedIndices);
}

function getLocalFallbackHint(
  cards: CardData[],
  flippedIndices: number[]
): HintResponse | null {
  const unmatched = cards
    .map((c, i) => ({ ...c, index: i }))
    .filter(c => !c.isMatched);

  if (unmatched.length === 0) return null;

  // If one card is already flipped, try to find its known pair among unmatched cards.
  if (flippedIndices.length === 1) {
    const flippedCard = cards[flippedIndices[0]];
    const pair = unmatched.find(
      c => c.iconName === flippedCard.iconName && c.index !== flippedIndices[0]
    );
    if (pair) {
      return { index: pair.index, message: "You're on the right track — try that one!" };
    }
  }

  // Otherwise suggest a random unflipped, unmatched card.
  const candidates = unmatched.filter(c => !flippedIndices.includes(c.index));
  if (candidates.length === 0) return null;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return { index: pick.index, message: "Give this one a try — good luck!" };
}
