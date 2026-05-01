/**
 * Pure request-validation logic for the `getHint` callable. Lives in its own
 * file with no firebase-functions dependency so it can be unit-tested from
 * the main repo's vitest suite.
 */

export interface HintRequestPayload {
  boardSnapshot: Array<{ index: number; iconName: string }>;
  flippedIndices: number[];
  gridSize: number;
  cardCount: number;
}

export class HintValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HintValidationError";
  }
}

// Cost / abuse guards on the inbound payload. Loose enough for the largest
// real grid (currently 8x8 = 64 cards) with headroom, tight enough that a
// malicious caller cannot send a 10k-card "board" and spike Gemini billing.
export const MAX_GRID_SIZE = 12;
export const MIN_GRID_SIZE = 2;
export const MAX_CARDS = MAX_GRID_SIZE * MAX_GRID_SIZE;
export const MAX_FLIPPED_INDICES = 4;
export const MAX_ICON_NAME_LENGTH = 64;

export function validateHintRequest(
  data: Partial<HintRequestPayload> | undefined
): HintRequestPayload {
  if (
    !data ||
    !Array.isArray(data.boardSnapshot) ||
    !Array.isArray(data.flippedIndices) ||
    typeof data.gridSize !== "number" ||
    typeof data.cardCount !== "number"
  ) {
    throw new HintValidationError("Missing or invalid hint payload.");
  }

  if (
    !Number.isInteger(data.gridSize) ||
    data.gridSize < MIN_GRID_SIZE ||
    data.gridSize > MAX_GRID_SIZE
  ) {
    throw new HintValidationError("gridSize is out of allowed range.");
  }

  if (
    !Number.isInteger(data.cardCount) ||
    data.cardCount < MIN_GRID_SIZE * MIN_GRID_SIZE ||
    data.cardCount > MAX_CARDS
  ) {
    throw new HintValidationError("cardCount is out of allowed range.");
  }

  if (data.boardSnapshot.length > data.cardCount) {
    throw new HintValidationError("boardSnapshot exceeds cardCount.");
  }

  if (data.flippedIndices.length > MAX_FLIPPED_INDICES) {
    throw new HintValidationError("Too many flipped indices.");
  }

  for (const entry of data.boardSnapshot) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !Number.isInteger(entry.index) ||
      entry.index < 0 ||
      entry.index >= data.cardCount ||
      typeof entry.iconName !== "string" ||
      entry.iconName.length === 0 ||
      entry.iconName.length > MAX_ICON_NAME_LENGTH
    ) {
      throw new HintValidationError("boardSnapshot contains an invalid entry.");
    }
  }

  for (const idx of data.flippedIndices) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= data.cardCount) {
      throw new HintValidationError("flippedIndices contains an invalid index.");
    }
  }

  return data as HintRequestPayload;
}
