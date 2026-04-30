import "../lib/firebase";
import { getApp } from "firebase/app";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { isInstalledWebApp } from "../lib/installedWebApp";
import type { CardData } from "../types";
import { getLocalLlmHint } from "./localLlmService";

export interface HintResponse {
  index: number;
  message: string;
}

// Hint order:
// - Installed PWA: Gemini (server) while the local model is still downloading; once
//   ready, local Llama first, then Gemini, then deterministic.
// - Non-installed browser: Gemini (server) only, then deterministic — never local LLM.

const FUNCTIONS_REGION = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ?? "us-central1";

interface CloudHintRequest {
  boardSnapshot: Array<{ index: number; iconName: string }>;
  flippedIndices: number[];
  gridSize: number;
  cardCount: number;
}

type CloudHintResult =
  | { ok: true; index: number; message: string }
  | { ok: false };

// Per-request timeout aligned with server-side model timeout budget.
const CLOUD_HINT_TIMEOUT_MS = 30000;

// Errors that mean "do not bother retrying for the rest of this session" — the
// callable is not deployed, the secret is missing, or the caller is unauthorized.
// We remember this and skip cloud hints to avoid burning user time on every
// hint click for the same dead endpoint.
const NON_RETRYABLE_CODES = new Set([
  "functions/not-found",
  "functions/failed-precondition",
  "functions/permission-denied",
  "functions/unauthenticated",
]);
let cloudHintsDisabledForSession = false;

let hintCallable:
  | ReturnType<typeof httpsCallable<CloudHintRequest, CloudHintResult>>
  | null = null;

const getHintCallable = () => {
  if (!hintCallable) {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION);
    if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR === "true") {
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    }
    hintCallable = httpsCallable<CloudHintRequest, CloudHintResult>(functions, "getHint");
  }
  return hintCallable;
};

const isRetryableCloudError = (error: unknown): boolean => {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: string }).code;
    if (code === "functions/unavailable" || code === "functions/deadline-exceeded") return true;
    const msg = String((error as { message?: string }).message ?? "");
    return /network|fetch|failed to fetch|timeout/i.test(msg);
  }
  return false;
};

// Browser CORS preflight failures against the callable URL usually mean a
// deployment/config mismatch (wrong project, wrong region, or function missing),
// not a transient outage. Disable cloud hints for this session so we do not
// hammer a dead endpoint on every click.
const isMisconfiguredCloudEndpointError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const msg = String((error as { message?: string }).message ?? "");
  return /blocked by cors policy|response to preflight request|access-control-allow-origin/i.test(
    msg
  );
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

async function getCloudHint(
  cards: CardData[],
  flippedIndices: number[],
  gridSize: number
): Promise<HintResponse | null> {
  if (cloudHintsDisabledForSession) return null;

  try {
    const fn = getHintCallable();
    const result = await withTimeout(
      fn({
        boardSnapshot: buildBoardSnapshot(cards),
        flippedIndices: [...flippedIndices],
        gridSize,
        cardCount: cards.length,
      }),
      CLOUD_HINT_TIMEOUT_MS,
      "cloud hint"
    );

    const data = result.data;
    if (data?.ok === true) {
      return validateHint({ index: data.index, message: data.message }, cards, flippedIndices);
    }
    return null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code && NON_RETRYABLE_CODES.has(code)) {
      cloudHintsDisabledForSession = true;
      console.warn(`Cloud hint disabled for session (${code}):`, error);
    } else if (isMisconfiguredCloudEndpointError(error)) {
      cloudHintsDisabledForSession = true;
      console.warn(
        `Cloud hint disabled for session (callable endpoint misconfigured: check region/project deployment):`,
        error
      );
    } else if (isRetryableCloudError(error)) {
      console.warn("Cloud hint unavailable:", error);
    } else {
      console.warn("Cloud hint failed:", error);
    }
    return null;
  }
}

/** Test/debug hook: re-enable cloud hints after they were disabled by a non-retryable error. */
export function resetCloudHintCircuitBreaker() {
  cloudHintsDisabledForSession = false;
}

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

const buildBoardSnapshot = (cards: CardData[]) => {
  const snapshot: Array<{ index: number; iconName: string }> = [];
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].isMatched) snapshot.push({ index: i, iconName: cards[i].iconName });
  }
  return snapshot;
};

export async function getNextMoveHint(
  cards: CardData[],
  flippedIndices: number[],
  gridSize: number
): Promise<HintResponse | null> {
  if (isInstalledWebApp()) {
    const localFirst = await getLocalLlmHint(cards, flippedIndices, gridSize);
    if (localFirst) return localFirst;
  }

  const cloudHint = await getCloudHint(cards, flippedIndices, gridSize);
  if (cloudHint) return cloudHint;

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
